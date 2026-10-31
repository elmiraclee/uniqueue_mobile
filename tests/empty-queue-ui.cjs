/** Local-only UI contract regressions for approved fixes; all remote requests intercepted. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),{createFixture}=require('./fixtures/api.cjs');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=process.env.UQ_TEST_OUTPUT||path.join(root,'validation/empty-queue');fs.mkdirSync(out,{recursive:true});
const api=require('../deployment.generated.json').api_url;
const server=http.createServer((req,res)=>{let p=path.join(dist,decodeURIComponent(new URL(req.url,'http://local').pathname));if(!p.startsWith(dist)){res.writeHead(403);return res.end();}if(!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(dist,'index.html');res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.wav':'audio/wav'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/local/bin/chromium',headless:true});const errors=[],checks=[];
try{for(const width of [320,390]){for(const legacy of [true,false]){
const state=createFixture();state.children=state.children.map(c=>({...c,active_count:0,active_ticket_id:null,active_queue_number:null,active_office:null}));const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',timezoneId:'Asia/Manila'});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
await ctx.route('**/*',async route=>{const req=route.request(),url=req.url();if(url.startsWith(api+'/')){let body={};try{body=req.postDataJSON()||{}}catch{};let answer=state.handle(url,body,req.method());
if(url.includes('get_current_queue.php'))answer={status:200,data:{success:!legacy,queue:null,queues:[],reserved:[],count:0}};
return route.fulfill({status:answer.status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(answer.data)});}
if(url.startsWith(base)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();return route.abort();});
const key='uniqueue-session-v3.'+api.split('').map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
for(const role of ['student','parent']){
 if(!page.url().startsWith(base))await page.goto(base+'/login');
 await page.evaluate(({key,role,user,api})=>{localStorage.setItem('deployment_api_origin',api);localStorage.setItem('role',role);localStorage.setItem('user',JSON.stringify(user));localStorage.setItem(key,'isolated-fixture-token');},{key,role,api,user:role==='student'?state.student:state.parent});
 await page.goto(base+'/'+role+'/home');
 await page.getByText(role==='student'?'No active queue right now':'No active queue',{exact:true}).first().waitFor({timeout:15000});
 assert(!/Request failed|HTTP 200/.test(await page.locator('body').innerText()));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const label=`${width}-${role}-${legacy?'legacy':'current'}-empty`;
 await page.screenshot({path:path.join(out,label+'.png')});checks.push(label);
}await ctx.close();}}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:checks.length,checks,runtimeErrors:errors},null,2));console.log(`${checks.length} empty-queue UI states passed at 320/390px; zero page exceptions.`);
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
