import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeDomain, isPublicIp, assessText, redactText } from '../server/domain.mjs';
import { CaseStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';

test('domain parsing rejects private targets, credentials and URLs with paths', () => {
  assert.equal(normalizeDomain('Example.COM'), 'example.com');
  for (const x of ['localhost','127.0.0.1','[::1]','example.local','user@example.com','https://x.com/a','a.com?x=1','-a.com']) assert.throws(()=>normalizeDomain(x));
});
test('IP public boundary handles mapped and special IPv4/IPv6 ranges', () => {
  for (const x of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','192.0.2.3','198.18.1.1','224.0.0.1','::1','::ffff:8.8.8.8','fc00::1','fe80::1','2001:db8::1']) assert.equal(isPublicIp(x), false,x);
  for (const x of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111']) assert.equal(isPublicIp(x),true,x);
});
test('risk hints are observations, never legitimacy clearance', () => {
  assert.equal(assessText('Deposit crypto to unlock earnings').signals.length > 0,true);
  assert.equal(assessText('Hello').verdict,'unassessed');
  assert.ok(redactText('email me test@example.com or +65 9123 4567').includes('[EMAIL]'));
});
test('case isolation, report retry dedupe, evidence and consent withdrawal', () => {
  const dir=mkdtempSync(join(tmpdir(),'osint-')); const db=new CaseStore(join(dir,'db.sqlite'));
  try {
    const c=db.create({title:'Test',country:'SG'}); assert.equal(db.list().length,1);
    const r=db.prepare(c.id,{channelId:'sg-scamshield',requestId:'12345678-1234-4123-8123-123456789abc'});
    assert.equal(db.prepare(c.id,{channelId:'sg-scamshield',requestId:'12345678-1234-4123-8123-123456789abc'}).id,r.id);
    assert.equal(db.get(c.id).counts.total,0);
    db.receipt(c.id,r.id,{status:'submitted',reference:'receipt-1',submittedAt:'2026-11-06T00:00:00.000Z'});
    assert.equal(db.get(c.id).counts.total,1);
    assert.throws(()=>db.receipt(c.id,r.id,{status:'submitted',reference:'',submittedAt:'2026-11-06T00:00:00.000Z'}));
    db.train(c.id,{text:'An example with [EMAIL] removed',consent:true,redactionApproved:true,label:'suspected_scam',campaignId:'campaign-1',source:'reviewed synthetic example'});
    assert.equal(db.training().length,1); db.revoke(c.id); assert.equal(db.training().length,0);
    db.remove(c.id); assert.throws(()=>db.get(c.id));
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
test('case capacity is enforced by the shared store across connections and restored on deletion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'osint-'));const path=join(dir,'db.sqlite');const store=new CaseStore(path);const other=new CaseStore(path);
 try{
  let first;for(let i=0;i<500;i++){const c=store.create({title:'Capacity fixture',country:'SG'});first??=c.id;}
  assert.throws(()=>other.create({title:'Over capacity',country:'SG'}),e=>e.code==='case_limit');
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM cases').get().n,500);
  store.remove(first);assert.ok(other.create({title:'Restored capacity',country:'SG'}).id);
 }finally{other.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
test('training capacity is bounded per case and workspace and restored on withdrawal or deletion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'osint-'));const store=new CaseStore(join(dir,'db.sqlite'));
 const example={text:'Human-reviewed synthetic advance fee request.',consent:true,redactionApproved:true,label:'suspected_scam',campaignId:'synthetic-campaign',source:'Synthetic fixture'};
 try{
  const cases=[];for(let i=0;i<51;i++)cases.push(store.create({title:'Training capacity fixture',country:'SG'}).id);
  for(let i=0;i<100;i++)store.train(cases[0],example);
  assert.throws(()=>store.train(cases[0],example),e=>e.code==='training_case_limit');
  assert.equal(store.get(cases[0]).training.length,100);
  for(let c=1;c<50;c++)for(let i=0;i<100;i++)store.train(cases[c],example);
  assert.throws(()=>store.train(cases[50],example),e=>e.code==='training_workspace_limit');
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM training').get().n,5000);
  store.revoke(cases[0]);assert.ok(store.train(cases[0],example).exampleId);
  store.remove(cases[1]);assert.ok(store.train(cases[50],example).exampleId);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('HTTP denies unauthenticated/host/origin requests and authenticates UI session', async () => {
  const dir=mkdtempSync(join(tmpdir(),'osint-')); const store=new CaseStore(join(dir,'db.sqlite'));
  const app=createApp({store,token:'test-token-abcdefghijklmnopqrstuvwxyz123456',origin:'http://127.0.0.1:18765',dist:dir});
  await new Promise(resolve=>app.listen(18765,'127.0.0.1',resolve));
  const base='http://127.0.0.1:18765';
  try {
    assert.equal((await fetch(base+'/api/cases')).status,401);
    assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json','origin':'http://evil.test'},body:JSON.stringify({token:'test-token-abcdefghijklmnopqrstuvwxyz123456'})})).status,403);
    const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json','origin':base},body:JSON.stringify({token:'test-token-abcdefghijklmnopqrstuvwxyz123456'})});
    assert.equal(login.status,200); const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base+'/api/cases',{headers:{cookie}})).status,200);
    assert.equal((await fetch(base+'/api/cases',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{"title":"X","country":"SG"}'})).status,403);
    assert.equal((await fetch(base+'/api/cases',{method:'POST',headers:{cookie,'content-type':'application/json',origin:base},body:'{"title":"X","country":"SG","extra":true}'})).status,400);
    const good=await fetch(base+'/api/cases',{method:'POST',headers:{cookie,'content-type':'application/json',origin:base},body:'{"title":"X","country":"SG"}'}); assert.equal(good.status,201);
    assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
  } finally {await new Promise(r=>app.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
test('stateless MCP initialization, tools list and read call require bearer auth', async()=>{
 const dir=mkdtempSync(join(tmpdir(),'osint-'));const store=new CaseStore(join(dir,'db.sqlite'));const token='test-token-abcdefghijklmnopqrstuvwxyz123456';const app=createApp({store,token,origin:'http://127.0.0.1:18766',dist:dir});await new Promise(r=>app.listen(18766,'127.0.0.1',r));
 const call=async(body,extra={})=>fetch('http://127.0.0.1:18766/mcp',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',accept:'application/json, text/event-stream',...extra},body:JSON.stringify(body)});
 try{
  const init=await call({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});assert.equal(init.status,200);assert.equal((await init.json()).result.serverInfo.name,'alkamy-suspect-fraud');
  const list=await call({jsonrpc:'2.0',id:2,method:'tools/list',params:{}});const tools=(await list.json()).result.tools;assert.ok(tools.some(t=>t.name==='inspect_domain'));assert.ok(tools.every(t=>!['send_email','submit_report'].includes(t.name)));
  const read=await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'find_reporting_channels',arguments:{country:'SG'}}});assert.equal(read.status,200);assert.ok(JSON.parse((await read.json()).result.content[0].text).some(c=>c.id==='sg-scamshield'));
  assert.equal((await call({jsonrpc:'2.0',id:4,method:'tools/list'}, {origin:'http://evil.test'})).status,403);
 }finally{await new Promise(r=>app.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
test('passive inspection never visits suspect website or looks up private networks',async()=>{
 const {inspectDomain}=await import('../server/investigate.mjs');const urls=[];
 const fetchJson=async url=>{urls.push(url);if(url.includes('dns.json'))return {services:[[ ['com'],['https://rdap.verisign.com/com/v1/'] ]]};if(url.includes('type=NS'))return {Status:0,Answer:[{type:2,data:'ns.cloudflare.com.'}]};if(url.includes('type=A'))return {Status:0,Answer:[{type:1,data:'127.0.0.1'}]};if(url.includes('type=AAAA'))return {Status:0,Answer:[]};return {entities:[],events:[]};};
 const result=await inspectDomain('suspicious.com',{fetchJson});assert.equal(result.originHost,null);assert.equal(result.addresses[0].public,false);assert.equal(urls.some(x=>new URL(x).hostname==='suspicious.com'),false);assert.equal(urls.some(x=>x.includes('/ip/127.0.0.1')),false);assert.ok(result.cdnHints.length);
});
test('HTTP evidence/OCR, redacted training export, withdrawal and persistence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'osint-'));let store=new CaseStore(join(dir,'db.sqlite'));const token='test-token-abcdefghijklmnopqrstuvwxyz123456';
 const ocr=await import('node:http').then(({default:http})=>http.createServer(async(req,res)=>{for await(const c of req){}res.setHeader('content-type','application/json');res.end(JSON.stringify({text:'OCR evidence transcript',sha256:'a'.repeat(64),engine:'tesseract',truncated:false}));}));await new Promise(r=>ocr.listen(18768,'127.0.0.1',r));
 const app=createApp({store,token,origin:'http://127.0.0.1:18767',dist:dir,ocrUrl:'http://127.0.0.1:18768/ocr'});await new Promise(r=>app.listen(18767,'127.0.0.1',r));
 const call=async(path,method='GET',body)=>fetch('http://127.0.0.1:18767'+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  const created=await call('/api/cases','POST',{title:'Training test',country:'SG',claimedCompany:'Example',officialDomain:'example.com'});const c=await created.json();assert.equal(created.status,201);
  assert.equal((await call(`/api/cases/${c.id}/evidence`,'POST',{imageBase64:'YWJj',mimeType:'image/png'})).status,201);assert.equal(store.get(c.id).evidence[0].text,'OCR evidence transcript');assert.equal(store.training().length,0);
  const train={text:'[EMAIL] requested an advance fee.',consent:true,redactionApproved:true,label:'suspected_scam',campaignId:'campaign-a',source:'Human-reviewed synthetic fixture'};
  assert.equal((await call(`/api/cases/${c.id}/training`,'POST',{...train,consent:false})).status,400);
  assert.equal((await call(`/api/cases/${c.id}/training`,'POST',{...train,text:'Contact user@example.com'})).status,400);
  assert.equal((await call(`/api/cases/${c.id}/training`,'POST',train)).status,201);
  const exported=await(await call('/api/training/export')).text();assert.equal(exported.includes(c.id),false);assert.equal(exported.includes('OCR evidence transcript'),false);assert.equal(JSON.parse(exported.trim()).consent,true);
  assert.equal((await call(`/api/cases/${c.id}/training`,'DELETE')).status,200);assert.equal(store.training().length,0);
  store.close();store=new CaseStore(join(dir,'db.sqlite'));assert.equal(store.get(c.id).evidence.length,1);
 }finally{await new Promise(r=>app.close(r));await new Promise(r=>ocr.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
test('dependency failure returns partial sourced results and no invented reputation',async()=>{
 const {inspectDomain}=await import('../server/investigate.mjs');const result=await inspectDomain('example.com',{fetchJson:async()=>{throw new Error('offline');}});assert.equal(result.status,'partial');assert.equal(result.originHost,null);assert.equal(result.registrar,null);assert.equal(result.channels.length,0);assert.equal(result.errors.length,4);
});
test('malformed upstream registration and DNS data remain partial',async()=>{
 const {inspectDomain}=await import('../server/investigate.mjs');
 const result=await inspectDomain('example.com',{fetchJson:async url=>url.includes('dns.json')?{services:[[['com'],['https://rdap.verisign.com/com/v1/']]]}:url.includes('dns-query')?{Status:'bad',Answer:[{type:1,data:{nested:true}}]}:{objectClassName:'unrelated',ldhName:'different.com',registrar:'invented'}});
 assert.equal(result.status,'partial');assert.equal(result.registrar,null);assert.equal(result.addresses.length,0);assert.equal(result.channels.length,0);
});
test('DNS-over-HTTPS requests advertise the DNS JSON media type',async()=>{
 const {inspectDomain}=await import('../server/investigate.mjs');const saved=globalThis.fetch;
 globalThis.fetch=async(u,options)=>{const url=String(u);if(url.includes('dns-query'))return options.headers.accept==='application/dns-json'?new Response(JSON.stringify({Status:0,Answer:[]}),{status:200}):new Response('',{status:415});if(url.includes('dns.json'))return new Response(JSON.stringify({services:[[['com'],['https://rdap.verisign.com/com/v1/']]]}));return new Response(JSON.stringify({objectClassName:'domain',ldhName:'example.com',entities:[],events:[]}));};
 try{const result=await inspectDomain('example.com');assert.equal(result.errors.filter(e=>e.stage.startsWith('dns_')).length,0);}finally{globalThis.fetch=saved;}
});
