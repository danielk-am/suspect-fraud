import http from 'node:http';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { schemas, parse } from './schemas.mjs';
import { AppError, redactText, assessText } from './domain.mjs';
import { inspectDomain } from './investigate.mjs';
import { countryChannels } from './channels.mjs';
import { handleMcp } from './mcp.mjs';
import {openRouter, connectionSchema, chatSchema} from './assistant.mjs';
const same=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const sessionMs=8*60*60*1000;
async function readJson(req,max=12000000){if(!req.headers['content-type']?.startsWith('application/json'))throw new AppError('content_type','Use application/json.',415);let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>max)throw new AppError('body_limit','Request too large.',413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError('invalid_json','Request contains invalid JSON.');}}
export function createApp({store,token,origin='http://127.0.0.1:4321',dist=resolve('dist'),inspect=inspectDomain,assistantFetch=fetch,ocrUrl=process.env.OSINT_OCR_URL||'http://ocr:8080/ocr'}={}){
 if(typeof token!=='string'||(token.length<32||token.length>256))throw new Error('A secret token of at least 32 characters is required.');
 const expected=new URL(origin);if(!['http:','https:'].includes(expected.protocol)||expected.pathname!=='/'||expected.username||expected.password)throw new Error('PUBLIC_ORIGIN must be an exact origin.');
 const ocrTarget=new URL(ocrUrl);if(!['http:','https:'].includes(ocrTarget.protocol)||ocrTarget.username||ocrTarget.password||ocrTarget.pathname!=='/ocr'||!['ocr','127.0.0.1','localhost'].includes(ocrTarget.hostname))throw new Error('OCR endpoint must use the isolated ocr service or loopback.');
 const sessions=new Map(),rates=new Map(),assistantKeys=new Map(),assistantWork=new Map();let active=0;
 const cookieSid=req=>req.headers.cookie?.match(/(?:^|;\s*)osint_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 const disconnect=sid=>{assistantKeys.delete(sid);assistantWork.get(sid)?.abort();};
 const dropSession=sid=>{disconnect(sid);sessions.delete(sid);};
 const expirySweep=setInterval(()=>{for(const[sid,expiry]of sessions)if(expiry<=Date.now())dropSession(sid);},30000);expirySweep.unref();
 const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const limited=(key,max,window=60000)=>{const now=Date.now();let r=rates.get(key);if(!r||now-r.at>window){r={at:now,n:0};rates.set(key,r);}if(++r.n>max)throw new AppError('rate_limited','Too many requests. Try again later.',429);if(rates.size>10000)for(const[k,v]of rates)if(now-v.at>900000)rates.delete(k);};
 const auth=(req)=>{const auth=req.headers.authorization;if(auth?.startsWith('Bearer ')&&same(auth.slice(7),token))return true;const sid=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('osint_session='))?.slice(14);const expiry=sid&&sessions.get(sid);if(expiry&&expiry>Date.now())return expiry;if(sid)dropSession(sid);throw new AppError('unauthenticated','Sign in to this private workspace.',401);};
 const ocr=async(input)=>{const response=await fetch(ocrTarget,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(35000)});if(!response.ok)throw new AppError('ocr_failed','The screenshot could not be read. Check the format and size, or paste text manually.',422);const raw=await response.text();if(raw.length>100000)throw new AppError('ocr_limit','OCR response exceeded its size limit.',502);let d;try{d=JSON.parse(raw);}catch{throw new AppError('ocr_failed','The OCR worker returned an invalid response.',502);}if(typeof d.text!=='string'||d.text.length>50000||!d.text.trim()||typeof d.sha256!=='string'||!/^[a-f0-9]{64}$/.test(d.sha256)||d.engine!=='tesseract'||typeof d.truncated!=='boolean')throw new AppError('ocr_failed','No supported text was extracted. Paste a corrected transcript manually.',422);return d;};
 const work=async(fn)=>{if(active>=2)throw new AppError('busy','Two investigations are already running. Try again shortly.',429);active++;try{return await fn();}finally{active--;}};
 const app=http.createServer(async(req,res)=>{
  const requestId=randomUUID();res.setHeader('x-request-id',requestId);res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');res.setHeader('x-frame-options','DENY');res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   if(req.headers.host!==expected.host)throw new AppError('invalid_host','Host is not allowed.',403);
   const url=new URL(req.url,origin),path=url.pathname;
   if(req.headers.origin&&req.headers.origin!==expected.origin)throw new AppError('invalid_origin','Origin is not allowed.',403);
   if(path==='/healthz'){send(res,200,{status:'ok',service:'alkamy-suspect-fraud',version:'0.1.0'});return;}
   if(path.startsWith('/api/')||path==='/mcp'){
    limited('all:'+req.socket.remoteAddress,180);
    if(path==='/api/login'&&req.method==='POST'){
     if(req.headers.origin!==expected.origin)throw new AppError('invalid_origin','Open the workspace at its configured origin to sign in.',403);
     limited('login:'+req.socket.remoteAddress,10,900000);const {token:supplied}=parse(schemas.login,await readJson(req));if(!same(supplied,token))throw new AppError('unauthenticated','The access token was not accepted.',401);
     const sid=randomBytes(32).toString('hex'),expiresAt=Date.now()+sessionMs;for(const[k,v]of sessions)if(v<Date.now())dropSession(k);if(sessions.size>=100) dropSession(sessions.keys().next().value);sessions.set(sid,expiresAt);res.setHeader('set-cookie',`osint_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionMs/1000}${expected.protocol==='https:'?'; Secure':''}`);send(res,200,{authenticated:true,expiresAt:new Date(expiresAt).toISOString(),mode:'single-owner-private'});return;
    }
    const authenticated=auth(req);
    if(path==='/mcp'){
      if(!req.headers.authorization?.startsWith('Bearer ')||!same(req.headers.authorization.slice(7),token))throw new AppError('bearer_required','MCP requires its bearer token; browser cookies are not accepted.',401);
      if(req.method!=='POST'){send(res,405,{error:{code:'method_not_allowed',message:'Use stateless MCP POST requests.',requestId}});return;}
      await work(async()=>handleMcp(req,res,await readJson(req),{store,inspect,ocr}));return;
    }
    const bearer=req.headers.authorization?.startsWith('Bearer ')&&same(req.headers.authorization.slice(7),token);
    if(!['GET','HEAD'].includes(req.method)&&!bearer&&req.headers.origin!==expected.origin)throw new AppError('csrf','The request must come from this workspace.',403);
    if(path==='/api/session'&&req.method==='GET'){send(res,200,{authenticated:true,expiresAt:typeof authenticated==='number'?new Date(authenticated).toISOString():null,mode:'single-owner-private'});return;}
    if(path==='/api/logout'&&req.method==='POST'){const sid=req.headers.cookie?.match(/(?:^|;\s*)osint_session=([a-f0-9]+)/)?.[1];if(sid)dropSession(sid);res.setHeader('set-cookie','osint_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(expected.protocol==='https:'?'; Secure':''));send(res,200,{ok:true});return;}
    if(path==='/api/assistant'||path==='/api/assistant/chat'){
      const sid=cookieSid(req);
      if(typeof authenticated!=='number'||!sid)throw new AppError('browser_session_required','Unlock the workspace in this browser before connecting your own AI key.',401);
      if(path==='/api/assistant'&&req.method==='GET'){send(res,200,{connected:assistantKeys.has(sid),model:'openrouter/free'});return;}
      if(path==='/api/assistant'&&req.method==='DELETE'){disconnect(sid);send(res,200,{connected:false});return;}
      if(req.method!=='POST')throw new AppError('method_not_allowed','Method not allowed.',405);
      if(assistantWork.has(sid))throw new AppError('assistant_busy','A connection or chat request is already running. Stop it or wait.',429);
      limited('assistant:'+sid,12);
      // Reserve before reading the body: disconnect must cancel partial uploads too.
      const controller=new AbortController();assistantWork.set(sid,controller);
      const closed=()=>controller.abort();res.once('close',closed);
      try{
        const connecting=path==='/api/assistant';
        const body=parse(connecting?connectionSchema:chatSchema,await readJson(req,48000));
        if(controller.signal.aborted||!sessions.has(sid)||sessions.get(sid)<=Date.now())throw new AppError('assistant_cancelled','Your session ended or the request was stopped.',409);
        const key=connecting?body.key:assistantKeys.get(sid);
        if(!key)throw new AppError('assistant_disconnected','Connect your OpenRouter key in Assistant options first.',409);
        await work(async()=>{
          const data=await openRouter(connecting?'key':'chat/completions',key,{messages:connecting?undefined:body.messages,signal:controller.signal,fetcher:assistantFetch});
          if(controller.signal.aborted||!sessions.has(sid)||sessions.get(sid)<=Date.now())throw new AppError('assistant_cancelled','Your session ended or the request was stopped.',409);
          if(connecting)assistantKeys.set(sid,key);
          if(!res.destroyed)send(res,200,data);
        });
      }catch(e){if(e.code==='assistant_key')assistantKeys.delete(sid);throw e;}
      finally{res.off('close',closed);if(assistantWork.get(sid)===controller)assistantWork.delete(sid);}
      return;
    }
    if(path==='/api/channels'&&req.method==='GET'){const country=url.searchParams.get('country')||'SG';if(!['SG','US','GB','AU','OTHER'].includes(country))throw new AppError('invalid_country','Country is not supported.');send(res,200,countryChannels(country));return;}
    if(path==='/api/assess'&&req.method==='POST'){const d=parse(schemas.evidence,await readJson(req));if(!d.text)throw new AppError('invalid_input','Paste text for assessment.');send(res,200,assessText(d.text));return;}
    if(path==='/api/redact'&&req.method==='POST'){const d=parse(schemas.evidence,await readJson(req));if(!d.text)throw new AppError('invalid_input','Paste text for redaction.');send(res,200,{text:redactText(d.text),notice:'Review manually before sharing or approving training.'});return;}
    if(path==='/api/training/export'&&req.method==='GET'){res.writeHead(200,{'content-type':'application/x-ndjson; charset=utf-8','content-disposition':'attachment; filename="approved-training.jsonl"'});res.end(store.training().map(x=>JSON.stringify(x)).join('\n')+'\n');return;}
    if(path==='/api/cases'){
      if(req.method==='GET'){send(res,200,store.list());return;}
      if(req.method==='POST'){if(store.db.prepare('SELECT COUNT(*) AS n FROM cases').get().n>=500)throw new AppError('case_limit','Workspace case limit reached.');send(res,201,store.create(await readJson(req)));return;}
    }
    const m=path.match(/^\/api\/cases\/([a-f0-9-]{36})(?:\/(inspect|evidence|reports|receipts|training))?$/);
    if(m){const[,id,action]=m;
      if(!action&&req.method==='GET'){send(res,200,store.get(id));return;}
      if(!action&&req.method==='DELETE'){store.remove(id);send(res,200,{ok:true});return;}
      if(action==='training'&&req.method==='DELETE'){store.revoke(id);send(res,200,{ok:true});return;}
      if(req.method==='POST'){
        const body=await readJson(req);store.get(id);
        if(action==='inspect'){const d=parse(schemas.inspect,body);const data=await work(()=>inspect(d.domain));send(res,200,store.inspection(id,data));return;}
        if(action==='evidence'){const d=parse(schemas.evidence,body);send(res,201,store.evidence(id,d.text?{text:d.text}:await work(()=>ocr(d))));return;}
        if(action==='reports'){send(res,201,store.prepare(id,body));return;}
        if(action==='receipts'){const{reportId,...d}=parse(schemas.receipt,body);send(res,200,store.receipt(id,reportId,d));return;}
        if(action==='training'){send(res,201,store.train(id,body));return;}
      }
    }
    throw new AppError('not_found','API route not found.',404);
   }
   if(!['GET','HEAD'].includes(req.method))throw new AppError('method_not_allowed','Method not allowed.',405);
   const route=path==='/'||/^\/tools\/suspect-fraud\/?$/.test(path)||/^\/tools\/suspect-fraud\/recruitment-scams\/?$/.test(path)?'/index.html':path;
   let decoded;try{decoded=decodeURIComponent(route);}catch{throw new AppError('invalid_path','Invalid path.');}
   const file=resolve(dist,'.'+decoded);if(!file.startsWith(resolve(dist)+sep))throw new AppError('invalid_path','Invalid path.');
   const info=await stat(file).catch(()=>null);if(!info?.isFile())throw new AppError('not_found','Page not found.',404);
   const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp'};res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch(e){if(!res.headersSent)send(res,e.status||500,{error:{code:e.code||'operation_failed',message:e.status?e.message:'The operation could not be completed. Retry or use the manual route.',requestId}});else res.end();}
 });
 app.on('close',()=>{clearInterval(expirySweep);for(const controller of assistantWork.values())controller.abort();assistantKeys.clear();sessions.clear();});
 app.requestTimeout=45000;app.headersTimeout=10000;app.keepAliveTimeout=5000;return app;
}
