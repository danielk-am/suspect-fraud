export const CHANNEL_REVIEW_DATE='2026-11-06';
const channel=(id,name,country,url,note)=>({id,name,country,url,source:url,reviewedAt:CHANNEL_REVIEW_DATE,type:'official_reporting_reference',email:null,note});
export const channels=[
 channel('sg-scamshield','ScamShield','SG','https://www.scamshield.gov.sg/about-scamshield/scamshield-app/','Use the official app to report suspicious messages, calls or links. This is not a police report. For scam advice call 1799; contact your bank immediately if money or banking access is at risk.'),
 channel('sg-police','Singapore Police Force','SG','https://www.police.gov.sg/','Use the official police site to find the current police-report service. Call 999 only for emergencies.'),
 channel('us-ftc','FTC ReportFraud','US','https://reportfraud.ftc.gov/','Report fraud or a scam; this does not guarantee an individual response or recovery.'),
 channel('us-ic3','FBI Internet Crime Complaint Center','US','https://www.ic3.gov/','Internet crime complaint intake. Contact your bank promptly if a payment or account is affected.'),
 channel('gb-report','Report Fraud','GB','https://www.reportfraud.police.uk/','For England, Wales and Northern Ireland. In Scotland contact Police Scotland on 101. Use the official site to confirm the appropriate current reporting route.'),
 channel('au-scamwatch','Scamwatch','AU','https://www.scamwatch.gov.au/report-a-scam','Report a scam to Australia’s National Anti-Scam Centre. Contact your bank if money or banking access is affected.'),
 channel('global-icann','ICANN Lookup','OTHER','https://lookup.icann.org/','Confirm domain registration details and registrar. ICANN does not adjudicate ordinary fraud allegations.'),
 channel('global-cloudflare','Cloudflare abuse reporting','OTHER','https://abuse.cloudflare.com/','Use only when evidence identifies Cloudflare’s relevant role. A proxy/CDN is not proof of the origin host.'),
];
export function countryChannels(country){return channels.filter(c=>c.country===country||c.country==='OTHER');}
