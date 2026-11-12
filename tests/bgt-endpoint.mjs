import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const tmp=await mkdtemp(tmpdir()+'/cn-route-');
const field='2dde6968-69ff-4efc-853e-9a58eb25e6ce';
const date=new Date(Date.now()+3*86400000).toLocaleDateString('sv-SE',{timeZone:'Europe/Rome'});
globalThis.cnTest={bookings:[],admin_blocks:[],resources:[{id:field,is_active:true}],emails:0};
const fixture=`export const supabase={from(table){let filters=[],one=false,insert;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},lt(k,v){filters.push(r=>Date.parse(r[k])<Date.parse(v));return q},gt(k,v){filters.push(r=>Date.parse(r[k])>Date.parse(v));return q},single(){one=true;return q},maybeSingle(){one=true;return q},order(){return q},limit(){return q},insert(v){insert=v;return q},then(resolve){const state=globalThis.cnTest;if(insert){state[table].push(insert);return Promise.resolve({error:null}).then(resolve)}const rows=state[table].filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:one?rows[0]||null:rows,error:null}).then(resolve)}};return q}};`;
try{
 await build({entryPoints:['app/api/integrations/bgt-match/route.ts'],bundle:true,platform:'node',format:'esm',outfile:tmp+'/route.mjs',plugins:[{name:'fixture',setup(b){b.onLoad({filter:/lib\/supabase.ts$/},()=>({contents:fixture,loader:'js'}));b.onLoad({filter:/lib\/booking-notify.ts$/},()=>({contents:`export const formatBookingTimeLabel=()=>'';export async function notifyBookingConfirmed(){globalThis.cnTest.emails++}`,loader:'js'}));}}]});
 const {POST}=await import(pathToFileURL(tmp+'/route.mjs'));
 process.env.BGT_MATCH_HMAC_KEY='fixture-secret-only';
 const member='a'.repeat(64);
 async function request(data,stamp=String(Math.floor(Date.now()/1000)),tamper=false){const raw=JSON.stringify({member,resourceId:field,date,minutes:60,...data});const signature=createHmac('sha256',process.env.BGT_MATCH_HMAC_KEY).update('POST\n/api/integrations/bgt-match\n'+stamp+'\n'+raw).digest('hex');return POST(new Request('https://example.test/api/integrations/bgt-match',{method:'POST',headers:{'X-BGT-Timestamp':stamp,'X-BGT-Signature':tamper?'0'.repeat(64):signature},body:raw}));}
 assert.equal((await request({action:'availability'},undefined,true)).status,401);
 assert.equal((await request({action:'availability'},'1000000000')).status,401);
 assert.equal((await request({action:'availability',resourceId:'basket'})).status,400);
 const free=await (await request({action:'availability'})).json();assert.equal(free.ok,true);assert.equal(free.baseCents,5000);assert(free.items.length>0);
 const slot=free.items[0];globalThis.cnTest.admin_blocks.push({resource_id:field,start_ts:slot.startISO,end_ts:slot.endISO});
 const blocked=await (await request({action:'availability'})).json();assert(!blocked.items.some(x=>x.startISO===slot.startISO));
 const booking={action:'book',...slot,totalCents:4000,requestId:'11111111-1111-4111-8111-111111111111',name:'Test User',email:'test@example.invalid',phone:'3331234567'};
 assert.equal((await request(booking)).status,409);assert.equal(globalThis.cnTest.bookings.length,0);
 globalThis.cnTest.admin_blocks=[];
 assert.equal((await request(booking)).status,201);assert.equal(globalThis.cnTest.bookings.length,1);
 const repeated=await (await request(booking)).json();assert.equal(repeated.repeated,true);assert.equal(globalThis.cnTest.bookings.length,1);assert.equal(globalThis.cnTest.emails,1);
 assert.equal((await request({...booking,member:'b'.repeat(64)})).status,409);
 const mine=await (await request({action:'mine',member:'b'.repeat(64)})).json();assert.equal(mine.items.length,0);
 console.log('PASS: valid/expired/forged HMAC, excluded resources, calendar blocks, discounted total, idempotent booking, one notification, account isolation');
}finally{await rm(tmp,{recursive:true,force:true});delete globalThis.cnTest}
