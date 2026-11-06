// Evidence is rendered only as text. No case material is placed in browser storage.
import {resolveNavigation} from './navigation.mjs';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const val = (id: string) => el<HTMLInputElement>(id).value.trim();
const node = (tag: string, value = '', cls = '') => { const n = document.createElement(tag); n.textContent = value; if (cls) n.className = cls; return n; };
let current: any = null;
let busy = false;
let authenticated = false;
let pendingSection = location.hash.slice(1);
const setStatus = (s: string) => { el('status').textContent = s; };
function navigate(section: string, focus = true) {
  const route = resolveNavigation(section, authenticated, !!current);
  if (!route) return;
  pendingSection = route.target === section ? '' : section;
  el('navigation-notice').textContent = route.message;
  el('navigation-notice').hidden = !route.message;
  document.querySelectorAll<HTMLAnchorElement>('.sf-nav a').forEach(a => {
    if (a.hash === '#' + section) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
  history.replaceState(null, '', '#' + route.target);
  if (focus) {
    el('af-main').dispatchEvent(new CustomEvent('af:focus-task', {bubbles: true}));
    const target = el(route.target);
    target.setAttribute('tabindex', '-1');
    target.scrollIntoView({block: 'start'});
    const field = target.querySelector<HTMLElement>('input, textarea, select');
    (field || target).focus({preventScroll: true});
  }
}
document.querySelectorAll<HTMLAnchorElement>('.sf-nav a').forEach(a => a.addEventListener('click', event => {
  event.preventDefault(); event.stopPropagation(); navigate(a.hash.slice(1));
}));
document.querySelectorAll<HTMLButtonElement>('[data-sf-section]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.sfSection!)));
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
function locked() { authenticated = false; document.dispatchEvent(new CustomEvent('sf:auth',{detail:false})); current = null; el('workspace').hidden = true; el('active-case').hidden = true; el('unlock').hidden = false; el('logout').hidden = true; el('refresh-cases').hidden = true; el('case-list').replaceChildren(node('p', 'Unlock to view your cases.', 'af-hint')); for (const id of ['evidence-list','inspection-list','report-list','training-list','channels','company-check']) el(id).replaceChildren(); }
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, { method, credentials: 'same-origin', headers: body === undefined ? {} : {'content-type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401) locked(); throw new Error(data.error?.message || 'The request could not be completed.'); }
  return data;
}
async function action(task: () => Promise<void>, message: string | (() => string) = 'Saved.') {
  if (busy) return; busy = true; el('global-error').hidden = true; setStatus('Working…');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('#workspace button, #login-form button, #case-list button, #logout, #refresh-cases')];
  const states = buttons.map(b => b.disabled); buttons.forEach(b => b.disabled = true);
  try { await task(); setStatus(typeof message === 'function' ? message() : message); }
  catch (e) { el('global-error').textContent = e instanceof Error ? e.message : 'The operation could not be completed.'; el('global-error').hidden = false; setStatus('Needs attention.'); }
  finally { busy = false; buttons.forEach((b,i) => {if(b.isConnected) b.disabled = states[i];}); }
}
const form = (id: string, task: () => Promise<void>, message?: string) => el(id).addEventListener('submit', e => { e.preventDefault(); void action(task,message); });
function link(label: string, url: string) {
  const a = node('a',label) as HTMLAnchorElement;
  try { const u = new URL(url); if (u.protocol !== 'https:' || u.username || u.password) return node('span',label); a.href=u.href; a.target='_blank'; a.rel='noreferrer noopener'; } catch { return node('span',label); } return a;
}
function card(parent: HTMLElement, title: string) { const n = node('article','','sf-record'); n.append(node('h3',title)); parent.append(n); return n; }
function download(name: string, text: string, type = 'text/plain') { const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
function options(id: string, items: any[], label: (x:any)=>string) { const select=el<HTMLSelectElement>(id); select.replaceChildren(...items.map(x=>new Option(label(x),x.id))); select.dispatchEvent(new Event('change',{bubbles:true})); }
async function listCases() {
  const items=await api('/api/cases'); el('case-list').replaceChildren();
  if (!items.length) el('case-list').append(node('p','No cases yet.','af-hint'));
  for (const c of items) {const b=node('button',c.title,'af-secondary') as HTMLButtonElement;b.type='button';if(c.id===current?.id)b.setAttribute('aria-current','true');b.addEventListener('click',()=>void action(async()=>{render(await api('/api/cases/'+c.id));await listCases();navigate(pendingSection || 'evidence');},'Case opened.'));el('case-list').append(b);}
}
function render(c: any) {
  current=c; el('active-case').hidden=false; el('active-title').textContent=c.title;
  for (const id of ['evidence-list','inspection-list','report-list','training-list','channels','company-check']) el(id).replaceChildren();
  for (const e of c.evidence) {
    const n=card(el('evidence-list'),e.engine?'Screenshot transcript':'Saved text');
    n.append(node('p',new Date(e.createdAt).toLocaleString()));
    if(e.assessment?.signals?.length) {const warning=node('div','','sf-warning');warning.append(node('strong','Pause and verify'));for(const s of e.assessment.signals)warning.append(node('p',s.observation));n.append(warning);}
    n.append(node('pre',e.text),node('p',e.assessment?.notice||''));
    if(e.sha256)n.append(node('p','Original image SHA-256: '+e.sha256));
    if(e.truncated)n.append(node('p','Transcript was truncated. Check the original image.'));
  }
  for (const i of c.inspections) {
    const n=card(el('inspection-list'),i.domain+' · '+i.status);n.append(node('p','Observed '+new Date(i.checkedAt).toLocaleString()));
    const dl=node('dl');for(const [k,v]of [['Registrar',i.registrar||'Unresolved'],['Registered',i.registrationDate||'Unresolved'],['Nameservers',(i.nameservers||[]).join(', ')||'Unresolved'],['Public IPs',(i.addresses||[]).map((a:any)=>a.ip+(a.public?'':' (excluded from network checks)')).join(', ')||'Unresolved'],['Network allocation',(i.networks||[]).map((n:any)=>n.name||'Unresolved').join(', ')||'Unresolved'],['Origin host','Unresolved']])dl.append(node('dt',k),node('dd',v));n.append(dl);
    for(const h of i.cdnHints||[])n.append(node('p',h)); n.append(node('p',i.originNotice));
    for(const err of i.errors||[])n.append(node('p',err.message));
    const d=node('details');d.append(node('summary','Public sources'));for(const src of i.sources||[]) {const p=node('p');p.append(link(src,src));d.append(p);}n.append(d);
  }
  const company=c.companyVerification;
  if(company) {const n=card(el('company-check'),'Check the company independently');n.append(node('p',company.notice));for(const step of company.nextSteps||[])n.append(node('p',step));}
  el('count-summary').replaceChildren(node('strong',String(c.counts.total)+' reports recorded'),node('span',c.counts.scope+' Drafts are excluded. Reports elsewhere: unknown.'));
  for (const channel of c.channels) {
    const n=card(el('channels'),channel.name);n.append(node('p',channel.note||''));
    if(channel.url)n.append(link('Open official reference ↗',channel.url));if(channel.email)n.append(node('p',channel.email));
    const p=node('p','Source: ');if(channel.source)p.append(link(channel.source,channel.source));n.append(p,node('p','Checked '+(channel.reviewedAt||channel.observedAt||'date unavailable')));
  }
  options('report-channel',c.channels,(x)=>x.name);
  options('receipt-report',c.reports,(r)=>r.channel.name+' · '+r.status);
  for (const r of c.reports) {
    const n=card(el('report-list'),r.channel.name+' · '+r.status);n.append(node('p',r.notice),node('pre',r.subject+'\n\n'+r.body));
    const b=node('button','Download draft','af-secondary') as HTMLButtonElement;b.type='button';b.addEventListener('click',()=>download('report-'+r.id+'.txt',r.subject+'\n\n'+r.body));n.append(b);
    if(r.reference)n.append(node('p','Receipt: '+r.reference+' · '+r.provenance));
  }
  if(c.training.length) {const n=card(el('training-list'),c.training.length+' approved redacted examples');n.append(node('p','Separate approval recorded. Review exported copies before sharing.'));const b=node('button','Withdraw all examples from this case','af-secondary') as HTMLButtonElement;b.type='button';b.addEventListener('click',()=>void action(async()=>{await api('/api/cases/'+c.id+'/training','DELETE');render(await api('/api/cases/'+c.id));},'Examples withdrawn from future exports.'));n.append(b);}
}
async function unlocked() {authenticated=true;document.dispatchEvent(new CustomEvent('sf:auth',{detail:true}));el('workspace').hidden=false;el('unlock').hidden=true;el('logout').hidden=false;el('refresh-cases').hidden=false;await listCases();navigate(pendingSection || 'start', false);}
form('login-form',async()=>{await api('/api/login','POST',{token:val('access-token')});el<HTMLInputElement>('access-token').value='';await unlocked();navigate(pendingSection || 'start');},'Workspace unlocked.');
form('case-form',async()=>{render(await api('/api/cases','POST',{title:val('case-title'),country:val('country'),claimedCompany:val('company'),officialDomain:val('official-domain')}));await listCases();navigate(pendingSection || 'evidence');},'Private case created.');
form('evidence-form',async()=>{render(await api('/api/cases/'+current.id+'/evidence','POST',{text:val('evidence-text')}));el<HTMLTextAreaElement>('evidence-text').value='';},'Text saved. Review any warning signs below.');
form('image-form',async()=>{const file=el<HTMLInputElement>('screenshot').files?.[0];if(!file||file.size>8*1024*1024)throw new Error('Choose a screenshot up to 8 MB.');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Use a PNG, JPEG or WebP screenshot.');const imageBase64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('The file could not be read.'));r.readAsDataURL(file);});render(await api('/api/cases/'+current.id+'/evidence','POST',{imageBase64,mimeType:file.type}));el<HTMLInputElement>('screenshot').value='';},'Screenshot text saved. Compare it with the original.');
form('inspect-form',async()=>{render(await api('/api/cases/'+current.id+'/inspect','POST',{domain:val('domain')}));},'Domain observations saved. Review gaps and sources.');
form('report-form',async()=>{await api('/api/cases/'+current.id+'/reports','POST',{channelId:val('report-channel'),requestId:crypto.randomUUID()});render(await api('/api/cases/'+current.id));},'Draft prepared. Nothing has been sent.');
form('receipt-form',async()=>{render(await api('/api/cases/'+current.id+'/receipts','POST',{reportId:val('receipt-report'),status:val('receipt-status'),reference:val('receipt-reference'),submittedAt:new Date().toISOString()}));el<HTMLInputElement>('receipt-reference').value='';},'Your submission receipt has been recorded.');
form('training-form',async()=>{await api('/api/cases/'+current.id+'/training','POST',{text:val('redacted-text'),consent:el<HTMLInputElement>('consent').checked,redactionApproved:true,label:val('training-label'),campaignId:val('campaign-id'),source:'Operator-reviewed redacted case example'});render(await api('/api/cases/'+current.id));el<HTMLFormElement>('training-form').reset();},'Redacted example approved for future offline export.');
el('refresh-cases').addEventListener('click',()=>void action(listCases,'Cases refreshed.'));
el('logout').addEventListener('click',()=>void action(async()=>{await api('/api/logout','POST',{});locked();navigate('unlock');},'Workspace locked.'));
el('export-training').addEventListener('click',()=>{if(confirm('Export all approved redacted examples from this installation? Review the download before sharing.'))void action(async()=>{const r=await fetch('/api/training/export',{credentials:'same-origin'});if(!r.ok)throw new Error('Unlock your workspace to export.');download('approved-training.jsonl',await r.text(),'application/x-ndjson');},'Approved copies exported.');});
el('export-case').addEventListener('click',()=>{if(current)download('case-'+current.id+'.json',JSON.stringify(current,null,2),'application/json');});
el('delete-case').addEventListener('click',()=>{if(current&&confirm('Delete this case, transcripts, drafts and approved training examples? Export a copy first if needed.'))void action(async()=>{await api('/api/cases/'+current.id,'DELETE');current=null;el('active-case').hidden=true;await listCases();navigate('start');},'Case deleted. Exported copies and backups are not removed.');});
void action(async()=>{try{await api('/api/session');await unlocked();}catch(e){locked();if(!(e instanceof Error&&e.message==='Sign in to this private workspace.'))throw e;}if(pendingSection)navigate(pendingSection,false);},()=>authenticated?'Workspace ready. Create or open a private case.':'Unlock to access your private workspace.');

document.addEventListener('sf:session-expired',()=>{locked();navigate(pendingSection || 'unlock',false);setStatus('Session expired. Unlock the workspace to continue.');});
