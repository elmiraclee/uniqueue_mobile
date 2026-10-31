/* Executes the actual helper with native/provider boundaries mocked.
 * Verifies missing native modules cannot abort Login/Signup's auth import. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),Module=require('node:module'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');const results=[];
async function load(options={}){
 const h=globalThis.__GOOGLE_RUNTIME_TEST={os:'android',missing:[],providerLoads:0,browserLoads:0,completeCalls:0,providerThrows:false,configured:true,...options};
 const sources={
  expo:`exports.requireOptionalNativeModule=n=>global.__GOOGLE_RUNTIME_TEST.missing.includes(n)?null:{};`,
  rn:`exports.Platform={get OS(){return global.__GOOGLE_RUNTIME_TEST.os}};`,
  router:`exports.router={push(){}};`,
  backend:`const id=global.__GOOGLE_RUNTIME_TEST.configured?'test.apps.googleusercontent.com':'';exports.API={googleAuth:'https://example.test/google_auth.php'};exports.GOOGLE_ANDROID_CLIENT_ID=id;exports.GOOGLE_IOS_CLIENT_ID=id;exports.GOOGLE_WEB_CLIENT_ID=id;`,
  api:`exports.fetchJsonOrNull=async()=>null;`,
  google:`global.__GOOGLE_RUNTIME_TEST.providerLoads++;if(global.__GOOGLE_RUNTIME_TEST.providerThrows)throw Error("Cannot find native module 'ExpoApplication'");exports.useAuthRequest=c=>[{clientId:c.androidClientId||c.webClientId},null,async()=>({type:'cancel'})];`,
  browser:`global.__GOOGLE_RUNTIME_TEST.browserLoads++;exports.maybeCompleteAuthSession=()=>global.__GOOGLE_RUNTIME_TEST.completeCalls++;`,
 };
 const map={'expo':'expo','react-native':'rn','expo-router':'router','@/constants/backend':'backend','@/utils/api':'api','expo-auth-session/providers/google':'google','expo-web-browser':'browser'};
 const entry=path.join(root,'utils/google-auth.ts');
 const build=await esbuild.build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'mock-native-boundaries',setup(b){b.onResolve({filter:/.*/},a=>map[a.path]?{path:map[a.path],namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:sources[a.path],loader:'js'}));}}]});
 const m=new Module(entry,module);m.filename=entry;m.paths=Module._nodeModulePaths(root);m._compile(build.outputFiles[0].text,entry);return {auth:m.exports,h};
}
async function test(name,fn){await fn();results.push({test:name,passed:true});console.log('PASS '+name);}
(async()=>{
 for(const missing of ['ExpoApplication','ExpoCrypto','ExpoWebBrowser'])await test(`${missing} absent: auth helper imports safely and explains rebuild`,async()=>{const {auth,h}=await load({missing:[missing]});const state=auth.useGoogleAuthRequest();assert.equal(state.ready,false);assert.equal(state.request,null);assert.equal(h.providerLoads,0);assert.equal(h.browserLoads,0);assert.match(state.unavailableReason,new RegExp(missing));await assert.rejects(()=>state.promptAsync(),/Rebuild/);});
 await test('Native modules available: real provider boundary selected once',async()=>{const {auth,h}=await load();assert.equal(auth.useGoogleAuthRequest().ready,true);assert.equal(auth.useGoogleAuthRequest().ready,true);assert.equal(h.providerLoads,1);assert.equal(h.completeCalls,1);});
 await test('Unexpected native import failure does not abort auth helper',async()=>{const {auth}=await load({providerThrows:true});const state=auth.useGoogleAuthRequest();assert.equal(state.ready,false);assert.match(state.unavailableReason,/rebuild\/reinstall/);});
 await test('Web auth does not require Android/iOS native modules',async()=>{const {auth}=await load({os:'web',missing:['ExpoApplication','ExpoCrypto','ExpoWebBrowser']});assert.equal(auth.useGoogleAuthRequest().ready,true);});
 await test('Unconfigured iOS Google does not evaluate a native Google provider',async()=>{const {auth,h}=await load({os:'ios',configured:false});const state=auth.useGoogleAuthRequest();assert.equal(state.ready,false);assert.equal(h.providerLoads,0);assert.match(state.unavailableReason,/EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/);});
 await test('Login and Signup still export default route components',async()=>{const ts=require('typescript');for(const rel of ['app/login.tsx','app/signup.tsx']){const source=ts.createSourceFile(rel,fs.readFileSync(path.join(root,rel),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);assert(source.statements.some(s=>ts.isFunctionDeclaration(s)&&s.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword)),rel);}});
 fs.mkdirSync(path.join(root,'validation/2026-10-30-native-hotfix'),{recursive:true});fs.writeFileSync(path.join(root,'validation/2026-10-30-native-hotfix/google-runtime-results.json'),JSON.stringify({scope:'Actual auth helper with mocked native/provider boundaries; not a native binary test',passed:results.length,tests:results},null,2)+'\n');console.log(`\n${results.length} tests passed.`);
})().catch(e=>{console.error(e);process.exitCode=1});
