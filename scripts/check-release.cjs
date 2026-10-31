/* Configuration-only release gate; never calls a remote service. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const cfg=require('../deployment.generated.json');
const failures=[];
for(const key of ['web_url','api_url']){
 try{const u=new URL(cfg[key]);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)failures.push(`${key} must be a credential-free HTTPS URL`);}
 catch{failures.push(`${key} is invalid`);}
}
if(cfg.allow_insecure_http)failures.push('Production profile must set allow_insecure_http=false');
const webArg=process.argv.indexOf('--web-dir');
if(webArg>=0){
 try{const web=JSON.parse(fs.readFileSync(path.resolve(process.argv[webArg+1],'deployment.json')));const active=web.profiles[web.profile];
 for(const key of ['web_url','api_url','allow_insecure_http'])if(active[key]!==cfg[key])failures.push(`PHP/mobile deployment mismatch: ${key}`);
 if(web.profile!==cfg.profile)failures.push('PHP/mobile profile name mismatch');
 }catch{failures.push('Cannot read --web-dir deployment.json');}
}
if(process.argv.includes('--ios')){
 const id=process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID||'';
 if(!id.endsWith('.apps.googleusercontent.com')||/placeholder|YOUR_/i.test(id))failures.push('Set the actual EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID for iOS Google sign-in');
}
if(fs.existsSync(path.join(root,'mobile'))||fs.existsSync(path.join(root,'mobile.zip')))failures.push('Legacy nested mobile project/archive must not be packaged');
if(failures.length){console.error('RELEASE BLOCKED (configuration):\n- '+failures.join('\n- '));process.exitCode=1;}
else console.log('Configuration checks passed. Device, live API/DB, signing and push tests still required.');
