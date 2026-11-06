import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';

// Exercise the actual request helper with delayed responses, without a DOM clone.
test('stale unauthorized assistant response cannot lock a newer authenticated generation',async()=>{
 const source=readFileSync(new URL('../src/scripts/assistant.ts',import.meta.url),'utf8');
 const helper=source.slice(source.indexOf('  async function request('),source.indexOf('  async function refresh('));
 let release;const pending=new Promise(r=>release=r);let expired=0;
 const api=runInNewContext(stripTypeScriptTypes(`(()=>{let generation=1,authenticated=true,ready=true;${helper};return {request,advance(){generation++},state(){return {authenticated,ready}}}})()`),{
  fetch:()=>pending,document:{dispatchEvent:()=>expired++},Event,
 });
 const request=api.request('/api/assistant');api.advance();
 release({ok:false,json:async()=>({error:{code:'unauthenticated',message:'Expired'}})});
 await assert.rejects(request,/Expired/);assert.equal(expired,0);
 assert.equal(api.state().authenticated,true);assert.equal(api.state().ready,true);
 await assert.rejects(api.request('/api/assistant'),/Expired/);
 assert.equal(expired,1);assert.equal(api.state().authenticated,false);
});
