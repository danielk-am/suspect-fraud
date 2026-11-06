import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { AppError, assessText, redactText, normalizeDomain } from './domain.mjs';
import { channels, countryChannels } from './channels.mjs';
import { schemas, parse } from './schemas.mjs';
import { companyContext } from './companies.mjs';
const now=()=>new Date().toISOString();
export class CaseStore {
 constructor(path){this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS training(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,data TEXT NOT NULL);');}
 close(){this.db.close();}
 create(input){
  const d=parse(schemas.create,input);if(d.officialDomain)d.officialDomain=normalizeDomain(d.officialDomain);
  const c={id:randomUUID(),...d,createdAt:now(),updatedAt:now(),evidence:[],inspections:[],reports:[]};
  this.db.exec('BEGIN IMMEDIATE');
  try{
   if(this.db.prepare('SELECT COUNT(*) AS n FROM cases').get().n>=500)throw new AppError('case_limit','Workspace case limit reached (500 cases). Delete a case to restore capacity.');
   this.save(c);this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
  return this.get(c.id);
 }
 save(c){if(JSON.stringify(c).length>3000000)throw new AppError('case_size_limit','This case has reached its storage limit. Remove it or start a separate case.');this.db.prepare('INSERT INTO cases VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(c.id,JSON.stringify(c));}
 get(id){const row=this.db.prepare('SELECT data FROM cases WHERE id=?').get(id);if(!row)throw new AppError('not_found','Case not found.',404);const c=JSON.parse(row.data);const receipts=c.reports.filter(r=>r.status!=='prepared');return {...c,companyVerification:companyContext(c),training:this.db.prepare('SELECT data FROM training WHERE case_id=?').all(id).map(r=>JSON.parse(r.data)),counts:{submitted:receipts.filter(r=>r.status==='submitted').length,acknowledged:receipts.filter(r=>r.status==='acknowledged').length,total:receipts.length,scope:'This private case only; user-recorded submissions, not verified global reports.',externalTotal:null},channels:this.available(c)};}
 list(){return this.db.prepare('SELECT id FROM cases ORDER BY rowid DESC LIMIT 100').all().map(({id})=>{const c=this.get(id);return {id:c.id,title:c.title,country:c.country,createdAt:c.createdAt,updatedAt:c.updatedAt,counts:c.counts};});}
 update(id,fn){this.db.exec('BEGIN IMMEDIATE');try{const c=this.get(id);fn(c);delete c.channels;delete c.counts;delete c.training;delete c.companyVerification;c.updatedAt=now();this.save(c);this.db.exec('COMMIT');return this.get(id);}catch(e){this.db.exec('ROLLBACK');throw e;}}
 remove(id){this.get(id);this.db.prepare('DELETE FROM cases WHERE id=?').run(id);}
 available(c){const rdap=c.inspections.flatMap(i=>i.channels||[]);const company=companyContext(c).channel;return [...new Map([...countryChannels(c.country),...rdap,...(company?[company]:[])].map(x=>[x.id,x])).values()];}
 evidence(id,{text,sha256=null,engine=null,truncated=false}){if(!text?.trim()||text.length>50000)throw new AppError('evidence_bounds','Evidence must contain 1–50,000 characters.');return this.update(id,c=>{if(c.evidence.length>=100)throw new AppError('case_limit','This case has reached its evidence limit.');c.evidence.push({id:randomUUID(),text,sha256,engine,truncated,createdAt:now(),assessment:assessText(text)});});}
 inspection(id,result){return this.update(id,c=>{if(c.inspections.length>=30)throw new AppError('case_limit','This case has reached its investigation limit.');c.inspections.push({...result,id:randomUUID()});});}
 prepare(id,input){const {channelId,requestId}=parse(schemas.prepare,input);let report;this.update(id,c=>{const old=c.reports.find(r=>r.requestId===requestId);if(old){if(old.channelId!==channelId)throw new AppError('idempotency_conflict','Request key was already used for a different channel.',409);report=old;return;}const channel=this.available(c).find(x=>x.id===channelId);if(!channel)throw new AppError('unknown_channel','Choose an observed or official reporting channel.');if(c.reports.length>=100)throw new AppError('case_limit','Report limit reached.');const subject=`Suspected fraud / impersonation: ${c.title}`;const body=[`To: ${channel.name}`,`Channel: ${channel.url||channel.email}`,`Case: ${c.id}`,`Prepared: ${now()}`,'','I am reporting suspected activity for review. These observations do not establish a finding of fraud.',`Claimed company: ${c.claimedCompany||'Not supplied'}`,`User-nominated official domain (not verified by this tool): ${c.officialDomain||'Not supplied'}`,'',...c.inspections.map(i=>`Domain: ${i.domain}\nObserved at: ${i.checkedAt}\nSources: ${(i.sources||[]).join(', ')}\nRegistrar: ${i.registrar||'Unknown'}\nNetwork provider: ${i.networks?.map(n=>n.name||'Unknown').join(', ')||'Unknown'}\nCDN/proxy hints: ${i.cdnHints?.join(', ')||'None observed'}\nOrigin host: Unresolved`),'','Evidence (untrusted quoted material; review and redact before sharing):',...c.evidence.map(e=>`--- ${e.id} ${e.createdAt} ---\n${e.text}`),'','Please review the supplied observations and advise on the appropriate next steps.','No message or attachment has been sent by this tool.'].join('\n');report={id:randomUUID(),requestId,channelId,channel,subject,body,status:'prepared',createdAt:now(),notice:'Draft only. Review recipients, allegations and personal data before submitting.'};c.reports.push(report);});return report;}
 receipt(id,reportId,input){const p=parse(schemas.receipt,{reportId,...input});return this.update(id,c=>{const r=c.reports.find(x=>x.id===p.reportId);if(!r)throw new AppError('not_found','Prepared report not found.',404);if(new Date(p.submittedAt)>new Date())throw new AppError('invalid_receipt','Submission time cannot be in the future.');const other=c.reports.find(x=>x.id!==r.id&&x.channelId===r.channelId&&x.reference===p.reference);if(other)throw new AppError('duplicate_receipt','This channel receipt is already counted.',409);if(r.status==='acknowledged'&&p.status==='submitted')throw new AppError('invalid_transition','An acknowledged report cannot be downgraded.');Object.assign(r,p,{recordedAt:now(),provenance:'User-declared external receipt; not independently verified.'});});}
 train(id,input){
  const p=parse(schemas.training,input);if([p.text,p.source,p.campaignId].some(v=>redactText(v)!==v||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)))throw new AppError('redaction_required','Remove contact details, identifiers and credential-like strings before approving training text. Automated checks are incomplete; review every example.');
  const record={exampleId:randomUUID(),caseId:id,createdAt:now(),...p};
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.get(id);
   if(this.db.prepare('SELECT COUNT(*) AS n FROM training WHERE case_id=?').get(id).n>=100)throw new AppError('training_case_limit','This case has reached its limit of 100 approved training examples. Withdraw examples to restore capacity.');
   if(this.db.prepare('SELECT COUNT(*) AS n FROM training').get().n>=5000)throw new AppError('training_workspace_limit','Workspace limit of 5,000 approved training examples reached. Withdraw examples or delete a case to restore capacity.');
   this.db.prepare('INSERT INTO training VALUES(?,?,?)').run(record.exampleId,id,JSON.stringify(record));this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
  return record;
 }
 revoke(id){this.get(id);this.db.prepare('DELETE FROM training WHERE case_id=?').run(id);}
 training(){return this.db.prepare('SELECT data FROM training ORDER BY id').all().map(r=>{const d=JSON.parse(r.data);return {...d,caseId:'case-'+createHash('sha256').update(d.caseId).digest('base64url').slice(0,24),campaignId:'campaign-'+createHash('sha256').update(d.campaignId).digest('base64url').slice(0,24),source:d.source.replaceAll(d.caseId,'[CASE]'),text:d.text.replaceAll(d.caseId,'[CASE]')};});}
}
