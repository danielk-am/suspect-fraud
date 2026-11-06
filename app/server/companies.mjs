// Entries require an independently checked primary company page. No guessed inboxes.
export const verifiedCompanies=[{
 names:['jazwares','jazwares llc'],officialDomain:'jazwares.com',name:'Jazwares',
 channel:{id:'company-jazwares-contact',name:'Jazwares official general contact',url:'https://www.jazwares.com/contact-us/',email:null,source:'https://www.jazwares.com/contact-us/',reviewedAt:'2026-11-06',type:'official_company_general_contact',note:'Official general contact route, not a verified dedicated recruitment-fraud/legal inbox. Ask the company to route the concern and authenticate the vacancy. No response is guaranteed.'}
}];
export function companyContext(c){
 const normalized=c.claimedCompany?.toLowerCase().replace(/[.,]/g,'').trim();
 const match=verifiedCompanies.find(x=>x.names.includes(normalized)&&(!c.officialDomain||c.officialDomain===x.officialDomain));
 return {claimedCompany:c.claimedCompany,officialDomain:c.officialDomain,officialSite:match?'https://'+match.officialDomain+'/':c.officialDomain?'https://'+c.officialDomain+'/':null,status:match?'official_contact_reference_available':'unverified_user_nomination',channel:match?.channel||null,nextSteps:['Find the company through a known independent source, not the recruiter’s link.','Confirm its official careers page and published legal/security contact.','Ask whether the recruiter and vacancy are authorised; a messaging badge does not authenticate a vacancy.'],verifiedEmail:null,notice:'A sourced company contact does not authenticate the recruiter, domain under investigation or vacancy.'};
}
