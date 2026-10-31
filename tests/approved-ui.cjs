/** Local-only UI contract regressions for approved fixes; all remote requests intercepted. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),{createFixture}=require('./fixtures/api.cjs');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=process.env.UQ_TEST_OUTPUT||path.join(root,'validation/approved-fixes');fs.mkdirSync(out,{recursive:true});
const api=require('../deployment.generated.json').api_url;
const server=http.createServer((req,res)=>{let p=path.join(dist,decodeURIComponent(new URL(req.url,'http://local').pathname));if(!p.startsWith(dist)){res.writeHead(403);return res.end();}if(!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(dist,'index.html');res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.wav':'audio/wav'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/local/bin/chromium',headless:true});const errors=[],checks=[];
try{for(const width of [320,390,1440]){
const state=createFixture();const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',timezoneId:'Asia/Manila'});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
await ctx.route('**/*',async route=>{const req=route.request(),url=req.url();if(url.startsWith(api+'/')){let body={};try{body=req.postDataJSON()||{}}catch{};let answer=state.handle(url,body,req.method());
if(url.includes('get_parent_link_requests.php'))answer={status:200,data:{success:true,requests:[{id:5,first_name:'Alex',last_name:'Santos'}]}};
return route.fulfill({status:answer.status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(answer.data)});}
if(url.startsWith(base)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();return route.abort();});
const key='uniqueue-session-v3.'+api.split('').map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
async function go(role,route){
 if(!page.url().startsWith(base))await page.goto(base+'/login');
 await page.evaluate(({key,role,user,api})=>{localStorage.setItem('deployment_api_origin',api);localStorage.setItem('role',role);localStorage.setItem('user',JSON.stringify(user));localStorage.setItem(key,'isolated-fixture-token');},{key,role,api,user:role==='student'?state.student:state.parent});
 await page.goto(base+route);await page.waitForTimeout(1200);
}
async function snap(label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' horizontal overflow');await page.screenshot({path:path.join(out,`${width}-${label}.png`)});checks.push(`${width} ${label}`);}
await go('parent','/parent/home');await page.getByText('Pending parent links · 1',{exact:true}).waitFor();await snap('parent-pending-links');
state.ticket={...state.ticket,status:'completed',has_feedback:true,done_at:'2026-10-31 13:20:00',service_items:[{item_id:1,name:'Document request',quantity:1,requirements:[]}]};
await go('student','/student/ticket?ticketId=41');await page.getByText('View submitted CSM in History',{exact:true}).waitFor();assert.equal(await page.getByText('Complete CSM',{exact:true}).count(),0);await page.getByText('No specific requirements listed.',{exact:true}).waitFor();await snap('ticket-completed-feedback');
state.ticket={...state.ticket,status:'waiting',has_feedback:false,people_ahead:0};state.notifications=[{id:95,event_id:'fixture-next-'+width,ticket_id:41,type:'next_in_line',title:"You're next in line",message:'Get ready at Window 1.',is_read:false,expires_at:Math.floor(Date.now()/1000)+120}];
await go('student','/student/home');await page.getByText("You're Next in Line",{exact:true}).waitFor({timeout:10000}).catch(async e=>{await page.screenshot({path:path.join(out,'failure.png')});console.log((await page.locator('body').innerText()).slice(0,1500));throw e;});await snap('waiting-next-alert');await ctx.close();}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:checks.length,checks,runtimeErrors:errors},null,2));console.log(`${checks.length} approved UI states passed at 320/390/1440px; zero page exceptions.`);
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
