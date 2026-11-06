// Explicit integration check against a running private installation; synthetic data only.
// Credentials are read from a file and are never logged or passed in command arguments.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const base=process.env.SMOKE_ORIGIN||'http://127.0.0.1:4327';
const token=readFileSync(process.env.OSINT_TOKEN_FILE||'.local/osint-token','utf8').trim();
const stateFile='.local/container-smoke-state.json';
const request=async(path,method='GET',body)=>{
 const r=await fetch(base+path,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json();assert.ok(r.ok,JSON.stringify({path,status:r.status,error:data.error}));return data;
};
if(process.argv.includes('--after-restart')){
 const {id}=JSON.parse(readFileSync(stateFile,'utf8'));const c=await request('/api/cases/'+id);
 assert.equal(c.title,'Synthetic container integration');assert.equal(c.counts.total,1);assert.equal(c.evidence.length,2);
 await request('/api/cases/'+id,'DELETE');console.log('Persistence across container restart and final deletion: PASS');process.exit(0);
}
assert.equal((await fetch(base+'/api/cases')).status,401);
const login=await fetch(base+'/api/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({token})});
assert.equal(login.status,200);assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
const c=await request('/api/cases','POST',{title:'Synthetic container integration',country:'SG',claimedCompany:'Jazwares LLC',officialDomain:'jazwares.com'});
await request('/api/cases/'+c.id+'/evidence','POST',{text:'Synthetic message: pay a crypto deposit to unlock commission.'});
const ocr=await request('/api/cases/'+c.id+'/evidence','POST',{imageBase64:readFileSync('.local/ocr-fixture.png').toString('base64'),mimeType:'image/png'});
assert.match(ocr.evidence[1].text,/SYNTHETIC.*DEPOSIT.*CRYPTO/i);assert.equal(ocr.evidence[1].engine,'tesseract');
const report=await request('/api/cases/'+c.id+'/reports','POST',{channelId:'sg-scamshield',requestId:randomUUID()});
assert.equal((await request('/api/cases/'+c.id)).counts.total,0);
await request('/api/cases/'+c.id+'/receipts','POST',{reportId:report.id,status:'submitted',reference:'SYNTHETIC-CONTAINER-RECEIPT',submittedAt:new Date(Date.now()-60000).toISOString()});
const example={text:'A synthetic redacted example requests a deposit.',consent:true,redactionApproved:true,label:'suspected_scam',campaignId:'synthetic-container',source:'Synthetic reviewed fixture'};
await request('/api/cases/'+c.id+'/training','POST',example);
const exportResponse=await fetch(base+'/api/training/export',{headers:{authorization:'Bearer '+token}});
const exported=await exportResponse.text();assert.ok(exported.includes(example.text));assert.ok(!exported.includes(c.id));
await request('/api/cases/'+c.id+'/training','DELETE');
assert.equal((await request('/api/cases/'+c.id)).training.length,0);
writeFileSync(stateFile,JSON.stringify({id:c.id}),{mode:0o600});
console.log('Container auth, real OCR, private case, draft/count, receipt, training/export/withdraw: PASS');
