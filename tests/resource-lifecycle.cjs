/* Executes the actual focus-aware resource hook with native/router boundaries mocked. */
const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module'),React=require('react'),Renderer=require('react-test-renderer'),esbuild=require('esbuild');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
(async()=>{const state=globalThis.__UQ_RESOURCE={listeners:new Set(),app:'active'};
const result=await esbuild.build({entryPoints:[path.resolve(__dirname,'../features/portal/use-resource.ts')],bundle:true,platform:'node',format:'cjs',write:false,external:['react'],plugins:[{name:'boundaries',setup(build){build.onResolve({filter:/^(react-native|expo-router)$/},a=>({path:a.path,namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='react-native'?`exports.AppState={get currentState(){return global.__UQ_RESOURCE.app},addEventListener:(name,fn)=>{global.__UQ_RESOURCE.listeners.add(fn);return {remove:()=>global.__UQ_RESOURCE.listeners.delete(fn)}}};`:`const React=require('react');exports.useFocusEffect=cb=>React.useEffect(cb,[cb]);`,loader:'js'}));}}]});
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(result.outputFiles[0].text,__filename);const {useResource}=m.exports;
let view,requests=[],root,tests=0;const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function Probe({child}){const loader=React.useCallback(signal=>{const d=deferred();requests.push({child,signal,...d});signal.addEventListener('abort',()=>d.reject(Error('Aborted')),{once:true});return d.promise},[child]);view=useResource(loader,10000);return null;}
const act=Renderer.act;
await act(async()=>{root=Renderer.create(React.createElement(Probe,{child:7}))});assert.equal(requests.length,1);assert.equal(view.loading,true);tests++;
await act(async()=>{root.update(React.createElement(Probe,{child:8}))});assert.equal(requests[0].signal.aborted,true);assert.equal(requests.length,2);tests++;
await act(async()=>requests[1].resolve({child:8}));assert.deepEqual(view.data,{child:8});tests++;
await act(async()=>requests[0].resolve({child:7}));assert.deepEqual(view.data,{child:8});tests++;
await act(async()=>{await Promise.all([view.reload(),view.reload(),Promise.resolve().then(()=>requests[2].resolve({child:8,refresh:1}))])});assert.equal(requests.length,3);tests++;
await act(async()=>{state.app='background';for(const fn of state.listeners)fn('background')});assert.equal(requests[2].signal.aborted,true);tests++;
await act(async()=>{state.app='active';for(const fn of state.listeners)fn('active')});assert.equal(requests.length,4);tests++;
await act(async()=>requests[3].reject(Error('Offline')));assert.equal(view.error,'Offline');assert.deepEqual(view.data,{child:8,refresh:1});tests++;
await act(async()=>{const promise=view.reload();requests[4].resolve({child:8,refresh:2});await promise});assert.equal(view.error,'');assert(view.updated instanceof Date);tests++;
await act(async()=>root.unmount());assert.equal(state.listeners.size,0);assert.equal(requests[4].signal.aborted,true);tests++;
console.log(`${tests} resource lifecycle checks passed (scope changes, cancellation, no overlaps, foreground, stale data, recovery, cleanup).`);
})().catch(e=>{console.error(e);process.exitCode=1});
