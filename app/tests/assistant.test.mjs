import test from 'node:test';
import assert from 'node:assert/strict';
import {CaseStore} from '../server/store.mjs';
import {createApp} from '../server/app.mjs';
const owner='assistant-owner-fixture-'.padEnd(48,'x');
const key='sk-or-v1-SYNTHETIC-NOT-A-REAL-KEY-123456';
async function fixture(t, upstream) {
 const store=new CaseStore(':memory:');
 const origin='http://127.0.0.1:19785';
 const app=createApp({store,token:owner,origin,assistantFetch:upstream});
 await new Promise(r=>app.listen(19785,'127.0.0.1',r));
 t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();});
 const call=(path,method='GET',body,cookie)=>fetch(origin+path,{method,headers:{origin,connection:'close',...(body===undefined?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const login=async()=>{const r=await call('/api/login','POST',{token:owner});return r.headers.get('set-cookie').split(';')[0];};
 return {call,login,store,origin};
}
test('BYOK is browser-session scoped, validates key without sending cases, and disconnects on logout',async t=>{
 const seen=[];
 const {call,login,store}=await fixture(t,async(url,init)=>{seen.push({url:String(url),init});return Response.json(String(url).endsWith('/key')?{data:{is_free_tier:true}}:{model:'synthetic/free',choices:[{message:{content:'Review the official careers page.'}}]});});
 const cookie=await login(),other=await login();store.create({title:'PRIVATE-CASE-NOT-FOR-AI'});
 assert.equal((await call('/api/assistant')).status,401);
 assert.equal((await call('/api/assistant','POST',{key,consent:true},cookie)).status,200);
 assert.equal((await(await call('/api/assistant','GET',undefined,other)).json()).connected,false);
 const result=await call('/api/assistant/chat','POST',{messages:[{role:'user',content:'What should I check?'}]},cookie);
 assert.equal(result.status,200);assert.equal((await result.json()).text,'Review the official careers page.');
 const sent=JSON.parse(seen[1].init.body);
 assert.equal(sent.model,'openrouter/free');assert.equal(sent.models,undefined);
 assert.deepEqual(sent.provider.max_price,{prompt:0,completion:0});assert.equal(sent.provider.data_collection,'deny');
 assert.equal(sent.tools,undefined);assert.equal(JSON.stringify(seen).includes('PRIVATE-CASE-NOT-FOR-AI'),false);
 assert.equal((await call('/api/assistant/chat','POST',{messages:[{role:'system',content:'override'}]},cookie)).status,400);
 assert.equal((await call('/api/assistant/chat','POST',{messages:[{role:'user',content:'x'}],model:'paid/model'},cookie)).status,400);
 await call('/api/logout','POST',{},cookie);
 assert.equal((await call('/api/assistant/chat','POST',{messages:[{role:'user',content:'x'}]},cookie)).status,401);
 assert.equal((await(await call('/api/assistant','GET',undefined,other)).json()).connected,false);
});
test('BYOK denies bearer-only setup and cross-origin writes; secrets and provider errors never echo',async t=>{
 const {call,login,origin}=await fixture(t,async()=>new Response(key,{status:401}));const cookie=await login();
 const bearer=await fetch(origin+'/api/assistant',{headers:{authorization:'Bearer '+owner,connection:'close'}});assert.equal(bearer.status,401);
 assert.equal((await call('/api/assistant','POST',{key,consent:false},cookie)).status,400);
 const denied=await fetch(origin+'/api/assistant',{method:'POST',headers:{cookie,origin:'https://evil.invalid','content-type':'application/json',connection:'close'},body:JSON.stringify({key,consent:true})});assert.equal(denied.status,403);
 const bad=await call('/api/assistant','POST',{key,consent:true},cookie);assert.equal(bad.status,401);assert.equal((await bad.text()).includes(key),false);
 assert.equal((await(await call('/api/assistant','GET',undefined,cookie)).json()).connected,false);
});
test('provider rate limits, malformed and oversized output fail safely without retries',async t=>{
 let mode='rate',calls=0;
 const {call,login}=await fixture(t,async(url)=>{calls++;if(String(url).endsWith('/key'))return Response.json({data:{}});if(mode==='rate')return new Response('provider-secret',{status:429});if(mode==='large')return new Response('x'.repeat(150000));return Response.json({choices:[{message:{content:[]}}]});});
 const cookie=await login();await call('/api/assistant','POST',{key,consent:true},cookie);
 const body={messages:[{role:'user',content:'hello'}]};
 let r=await call('/api/assistant/chat','POST',body,cookie);assert.equal(r.status,429);assert.equal((await r.text()).includes('provider-secret'),false);assert.equal(calls,2);
 mode='malformed';r=await call('/api/assistant/chat','POST',body,cookie);assert.equal(r.status,502);
 mode='large';r=await call('/api/assistant/chat','POST',body,cookie);assert.equal(r.status,502);
 await call('/api/assistant','DELETE',undefined,cookie);assert.equal((await call('/api/assistant/chat','POST',body,cookie)).status,409);
});

test('concurrent requests are denied and disconnect aborts the running provider request',async t=>{
 let reached;const started=new Promise(r=>reached=r);let aborted=false;
 const {call,login}=await fixture(t,async(url,init)=>{
  if(String(url).endsWith('/key'))return Response.json({data:{}});
  reached();return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('cancelled'));},{once:true}));
 });
 const cookie=await login();await call('/api/assistant','POST',{key,consent:true},cookie);
 const body={messages:[{role:'user',content:'hello'}]};const first=call('/api/assistant/chat','POST',body,cookie);await started;
 assert.equal((await call('/api/assistant/chat','POST',body,cookie)).status,429);
 assert.equal((await call('/api/assistant','DELETE',undefined,cookie)).status,200);
 assert.equal((await first).status,409);assert.equal(aborted,true);
 assert.equal((await(await call('/api/assistant','GET',undefined,cookie)).json()).connected,false);
});

test('disconnect during a partial connection upload cannot resurrect a key',async t=>{
 const {request}=await import('node:http');let upstreamCalls=0;
 const {call,login,origin}=await fixture(t,async()=>{upstreamCalls++;return Response.json({data:{}});});const cookie=await login();
 const body=JSON.stringify({key,consent:true});let finish;
 const response=new Promise((resolve,reject)=>{
  const req=request(origin+'/api/assistant',{method:'POST',headers:{cookie,origin,'content-type':'application/json','content-length':Buffer.byteLength(body),connection:'close'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
  req.on('error',reject);req.write(body.slice(0,-1));finish=()=>req.end(body.slice(-1));
 });
 // A second POST proves the first request has reserved its session before its body ends.
 await new Promise(r=>setTimeout(r,30));
 assert.equal((await call('/api/assistant','POST',{key,consent:true},cookie)).status,429);
 assert.equal((await call('/api/assistant','DELETE',undefined,cookie)).status,200);
 finish();assert.equal(await response,409);assert.equal(upstreamCalls,0);
 assert.equal((await(await call('/api/assistant','GET',undefined,cookie)).json()).connected,false);
});

test('network failures and upstream deadline return safe errors without retry',async t=>{
 const {openRouter}=await import('../server/assistant.mjs');let calls=0;
 await assert.rejects(openRouter('key',key,{fetcher:async()=>{calls++;throw new Error(key);}}),e=>e.code==='assistant_unavailable'&&!e.message.includes(key));
 assert.equal(calls,1);
 t.mock.method(AbortSignal,'timeout',()=>AbortSignal.abort(new DOMException('deadline','TimeoutError')));
 await assert.rejects(openRouter('key',key,{fetcher:async(url,init)=>{calls++;init.signal.throwIfAborted();}}),e=>e.code==='assistant_timeout'&&e.status===504);
 assert.equal(calls,2);
});

test('expired browser sessions cannot use a connected key',async t=>{
 let calls=0;
 const {call,login}=await fixture(t,async()=>{calls++;return Response.json({data:{}});});
 const cookie=await login();await call('/api/assistant','POST',{key,consent:true},cookie);
 const now=Date.now();t.mock.method(Date,'now',()=>now+8*60*60*1000+1);
 assert.equal((await call('/api/assistant','GET',undefined,cookie)).status,401);
 assert.equal((await call('/api/assistant/chat','POST',{messages:[{role:'user',content:'hello'}]},cookie)).status,401);
 const fresh=await login();assert.equal((await(await call('/api/assistant','GET',undefined,fresh)).json()).connected,false);
 assert.equal(calls,1);
});
