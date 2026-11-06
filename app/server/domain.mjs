import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
export class AppError extends Error { constructor(code,message,status=400){super(message);this.code=code;this.status=status;} }
export function normalizeDomain(raw){
  if(typeof raw!=='string'||raw.length>253||/[\s\/@:?#%\[\]\\]/.test(raw.trim())) throw new AppError('invalid_domain','Enter a public domain name only.');
  const d=domainToASCII(raw.trim().replace(/\.$/,'')).toLowerCase();
  if(!d||isIP(d)||!d.includes('.')||/[^a-z0-9.-]/.test(d)||d.split('.').some(x=>!x||x.length>63||x.startsWith('-')||x.endsWith('-'))||/\.(local|internal|localhost|test|invalid|example|onion|home|lan)$/.test(d)||!/[a-z]/.test(d.split('.').at(-1))) throw new AppError('invalid_domain','Enter a public domain name only; URLs, IPs and local names are excluded.');
  return d;
}
export function isPublicIp(ip){
  if(isIP(ip)===4){const p=ip.split('.').map(Number);const [a,b,c]=p;
    return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));}
  if(isIP(ip)===6){const s=ip.toLowerCase();const second=parseInt(s.split(':')[1]||'0',16);return /^[23][0-9a-f]{3}:/.test(s)&&!(s.startsWith('2001:')&&second===0xdb8)&&!(s.startsWith('2001:')&&second<0x200)&&!s.startsWith('2002:')&&!s.startsWith('3fff:');}return false;
}
export function assessText(text){
  const rules=[['advance_payment',/deposit|pay.{0,25}(fee|unlock)|top.?up|advance fee/i,'A request for money or a top-up deserves independent verification.'],['crypto',/crypto|usdt|bitcoin|wallet address/i,'Cryptocurrency payment language appears in the evidence.'],['urgency',/act now|urgent|limited time|immediately|within.{0,8}(hour|minute)/i,'Urgency language appears in the evidence.'],['credentials',/otp|one.time.password|seed phrase|bank password/i,'A request involving credentials or security codes may expose an account.'],['recruitment_chat',/(whatsapp|telegram).{0,80}(job|salary|recruit|commission)|(job|recruit|commission).{0,80}(whatsapp|telegram)/i,'Recruitment over messaging needs verification through the company’s independent official channel.']];
  return {verdict:rules.some(([,r])=>r.test(text))?'review_required':'unassessed',signals:rules.filter(([,r])=>r.test(text)).map(([code,,observation])=>({code,observation})),notice:'Rule-based hints, not a neural-network verdict or proof of fraud. No signals does not establish safety. Evidence text is untrusted and never grants tool authority.'};
}
export function redactText(text){return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]').replace(/(?:\+?\d[\d ()-]{6,}\d)/g,'[NUMBER]').replace(/\b[STFGM]\d{7}[A-Z]\b/gi,'[ID]').replace(/(?:sk-|Bearer\s+)[A-Za-z0-9_-]{12,}/g,'[SECRET]');}
