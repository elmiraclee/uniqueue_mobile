/** Real request() with isolated transport. No production requests. */
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict'),Module=require('module'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uq-empty-'));
fs.writeFileSync(path.join(tmp,'backend.js'),"exports.API_URL='https://isolated.invalid/api'");
fs.writeFileSync(path.join(tmp,'fetch.js'),'exports.clientFetch=async()=>global.__emptyResponse');
const code=esbuild.buildSync({entryPoints:[path.join(root,'features/portal/api.ts')],bundle:true,platform:'node',format:'cjs',write:false,alias:{'@/constants/backend':path.join(tmp,'backend.js'),'@/utils/client-fetch':path.join(tmp,'fetch.js')}}).outputFiles[0].text;
const filename=path.join(root,'features/portal/api-test.cjs'),mod=new Module(filename,module);mod.paths=module.paths;mod._compile(code,filename);const {request}=mod.exports;
function respond(data,status=200){global.__emptyResponse={ok:status>=200&&status<300,status,text:async()=>typeof data==='string'?data:JSON.stringify(data)}}
const empty={success:false,queues:[],reserved:[]};
(async()=>{let count=0;async function test(name,fn){await fn();count++;console.log('PASS',name)}
await test('legacy student empty queue becomes successful collection',async()=>{respond(empty);const d=await request('get_current_queue.php',{student_id:1});assert.equal(d.success,true);assert.equal(d.queue,null);assert.equal(d.count,0)});
await test('legacy parent empty child queue is normal',async()=>{respond(empty);const d=await request('get_current_queue.php?child_id=1',{parent_id:2,child_id:1});assert.deepEqual(d.queues,[]);assert.equal(d.success,true)});
await test('new backend empty success remains success',async()=>{respond({...empty,success:true,queue:null,count:0});assert.equal((await request('get_current_queue.php')).count,0)});
await test('active ticket is unchanged',async()=>{const active={success:true,queue:{id:41},queues:[{id:41}],reserved:[]};respond(active);assert.deepEqual(await request('get_current_queue.php'),active)});
await test('HTTP 401 is not normalized',async()=>{respond(empty,401);await assert.rejects(request('get_current_queue.php'),/401/)});
await test('HTTP 500 is not normalized',async()=>{respond(empty,500);await assert.rejects(request('get_current_queue.php'),/500/)});
await test('explicit application error is preserved',async()=>{respond({...empty,message:'Account access denied.'});await assert.rejects(request('get_current_queue.php'),/Account access denied/)});
await test('coded failure is preserved',async()=>{respond({...empty,code:'ACCESS_DENIED'});await assert.rejects(request('get_current_queue.php'))});
await test('error field is preserved',async()=>{respond({...empty,error:'Database failed'});await assert.rejects(request('get_current_queue.php'))});
await test('other endpoints are not normalized',async()=>{respond(empty);await assert.rejects(request('get_queue_details.php'))});
await test('invalid JSON remains an error',async()=>{respond('not json');await assert.rejects(request('get_current_queue.php'),/unreadable/)});
console.log(`${count} empty-queue API regression checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{delete global.__emptyResponse;fs.rmSync(tmp,{recursive:true,force:true})});
