import { z } from 'zod';
const str=(n)=>z.string().trim().min(1).max(n);
export const schemas={
  create:z.object({title:str(160),country:z.enum(['SG','US','GB','AU','OTHER']).default('SG'),claimedCompany:z.string().max(160).default(''),officialDomain:z.string().max(253).default('')}).strict(),
  inspect:z.object({domain:str(253)}).strict(),
  evidence:z.union([z.object({text:str(50000)}).strict(),z.object({imageBase64:str(12000000),mimeType:z.enum(['image/png','image/jpeg','image/webp'])}).strict()]),
  prepare:z.object({channelId:str(160),requestId:z.uuid()}).strict(),
  receipt:z.object({reportId:z.uuid(),status:z.enum(['submitted','acknowledged']),reference:str(500),submittedAt:z.iso.datetime()}).strict(),
  training:z.object({text:str(20000),consent:z.literal(true),redactionApproved:z.literal(true),label:z.enum(['suspected_scam','benign']),campaignId:str(160).regex(/^[A-Za-z0-9_-]+$/).refine(v=>!/^\d{8,}$/.test(v),'Use a campaign slug, not a phone number or account identifier.'),source:str(200)}).strict(),
  login:z.object({token:str(256)}).strict(),
};
export function parse(schema,data){const r=schema.safeParse(data);if(!r.success){const e=new Error('Invalid request: '+r.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));e.status=400;e.code='invalid_input';throw e;}return r.data;}
