import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(tmpdir()+'/bgt-cn-test-');
try{
 await build({entryPoints:['lib/admin-session.ts','lib/pricing.ts','lib/datetime-rome.ts'],bundle:true,platform:'node',format:'esm',outdir:dir});
 const {createAdminSession,validAdminSession}=await import(pathToFileURL(dir+'/admin-session.js'));
 process.env.ADMIN_PASSWORD='test-only-password-not-a-real-secret';
 const token=await createAdminSession();assert(await validAdminSession(token));assert.equal(await validAdminSession('1'),false);assert.equal(await validAdminSession(token.slice(0,-1)+(token.endsWith('0')?'1':'0')),false);
 const {calcTotalCents,rescheduledTotal}=await import(pathToFileURL(dir+'/pricing.js'));
 assert.equal(calcTotalCents('Palazzetto',60,'2026-11-12T19:00:00Z'),6000);
 assert.equal(calcTotalCents('Tendone',60,'2026-11-12T19:00:00Z'),5500);
 assert.equal(rescheduledTotal({source:'BGT_MATCH:abc',resource_id:'same',start_ts:'2026-11-12T19:00:00Z',end_ts:'2026-11-12T20:00:00Z',total_amount_cents:4000},'same','Palazzetto',60,'2026-11-13T19:00:00Z'),4000);
 const {buildRomeIso}=await import(pathToFileURL(dir+'/datetime-rome.js'));
 assert.equal(new Date(buildRomeIso('2026-11-12','20:00')).toISOString(),'2026-11-12T19:00:00.000Z');
 assert.equal(new Date(buildRomeIso('2027-07-12','20:00')).toISOString(),'2027-07-12T18:00:00.000Z');
 console.log('PASS: signed admin sessions, forged cookie rejection, ordinary tariffs unchanged, negotiated BGT price preserved, Rome DST');
}finally{await rm(dir,{recursive:true,force:true})}
