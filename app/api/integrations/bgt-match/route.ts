import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabase } from '@/lib/supabase';
import { buildRomeIso } from '@/lib/datetime-rome';
import { formatBookingTimeLabel, notifyBookingConfirmed } from '@/lib/booking-notify';
export const runtime='nodejs';
const resources:Record<string,{name:string;hour:number}>={
 '2dde6968-69ff-4efc-853e-9a58eb25e6ce':{name:'Palazzetto',hour:5000},
 '63e4d3bb-b89e-4714-b446-0cc927020553':{name:'Tendone',hour:4000}
};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const day=(d:Date)=>d.toLocaleDateString('sv-SE',{timeZone:'Europe/Rome'});
async function available(resourceId:string,date:string,minutes:number){
 const start=buildRomeIso(date,'09:00'),end=buildRomeIso(date,'23:00');
 const [r,b,k]=await Promise.all([
 supabase.from('resources').select('is_active').eq('id',resourceId).single(),
 supabase.from('bookings').select('start_ts,end_ts').eq('resource_id',resourceId).in('status',['PENDING_PAYMENT','CONFIRMED']).lt('start_ts',end).gt('end_ts',start),
 supabase.from('admin_blocks').select('start_ts,end_ts').eq('resource_id',resourceId).lt('start_ts',end).gt('end_ts',start)
 ]);
 if(r.error||b.error||k.error)throw new Error('calendar');
 if(!r.data.is_active)return [];
 const occupied=[...(b.data||[]),...(k.data||[])];const slots=[];
 for(let t=Date.parse(start);t+minutes*60000<=Date.parse(end);t+=1800000){const until=t+minutes*60000;if(t<=Date.now()||occupied.some(x=>Date.parse(x.start_ts)<until&&Date.parse(x.end_ts)>t))continue;slots.push({startISO:new Date(t).toISOString(),endISO:new Date(until).toISOString()});}
 return slots;
}
export async function POST(req:Request){
 const secret=process.env.BGT_MATCH_HMAC_KEY;
 if(!secret)return json({error:'Collegamento non ancora attivo.'},503);
 const raw=await req.text();if(raw.length>8000)return json({error:'Richiesta troppo grande.'},413);
 const ts=req.headers.get('X-BGT-Timestamp')||'',sig=req.headers.get('X-BGT-Signature')||'';
 if(!/^\d{10}$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300||!/^[a-f0-9]{64}$/.test(sig))return json({error:'Non autorizzato.'},401);
 const expected=createHmac('sha256',secret).update('POST\n/api/integrations/bgt-match\n'+ts+'\n'+raw).digest();
 if(!timingSafeEqual(expected,Buffer.from(sig,'hex')))return json({error:'Non autorizzato.'},401);
 try{
 const b=JSON.parse(raw),member=String(b.member||'');
 if(!/^[a-f0-9]{64}$/.test(member))return json({error:'Account non valido.'},400);
 const source='BGT_MATCH:'+member;
 if(b.action==='mine'){
 const {data,error}=await supabase.from('bookings').select('id,resource_id,start_ts,end_ts,status,total_amount_cents').eq('source',source).order('start_ts',{ascending:false}).limit(100);
 if(error)throw error;return json({ok:true,items:data});
 }
 if(!resources[b.resourceId])return json({error:'Campo non abilitato.'},400);
 const minutes=Number(b.minutes),date=String(b.date||'');
 if(![60,90].includes(minutes)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||day(new Date(date+'T12:00:00Z'))!==date||date<day(new Date())||date>day(new Date(Date.now()+90*86400000)))return json({error:'Scegli una data entro 90 giorni e una durata di 60 o 90 minuti.'},400);
 if(b.action==='availability')return json({ok:true,items:await available(b.resourceId,date,minutes),baseCents:resources[b.resourceId].hour*minutes/60});
 if(b.action!=='book'||!uuid.test(b.requestId)||typeof b.name!=='string'||b.name.trim().length<2||b.name.length>80||typeof b.email!=='string'||b.email.length>254||!/^\S+@\S+\.\S+$/.test(b.email)||typeof b.phone!=='string'||!/^\+?[\d ()-]{7,25}$/.test(b.phone))return json({error:'Dati della prenotazione non validi.'},400);
 const total=Number(b.totalCents),base=resources[b.resourceId].hour*minutes/60;
 if(!Number.isInteger(total)||total<0||total>base)return json({error:'Tariffa non valida.'},400);
 const existing=await supabase.from('bookings').select('id,source,resource_id,start_ts,end_ts,total_amount_cents,status').eq('id',b.requestId).maybeSingle();
 if(existing.error)throw existing.error;
 if(existing.data){const x=existing.data;if(x.source!==source||x.resource_id!==b.resourceId||Date.parse(x.start_ts)!==Date.parse(b.startISO)||Date.parse(x.end_ts)!==Date.parse(b.endISO))return json({error:'Identificativo già utilizzato.'},409);return json({ok:true,id:x.id,status:x.status,totalCents:x.total_amount_cents,repeated:true});}
 const slots=await available(b.resourceId,date,minutes);
 if(!slots.some(x=>x.startISO===b.startISO&&x.endISO===b.endISO))return json({error:'Orario non più disponibile. Scegline un altro.'},409);
 const {error}=await supabase.from('bookings').insert({id:b.requestId,resource_id:b.resourceId,user_name:b.name.trim(),user_email:b.email.toLowerCase(),user_phone:b.phone.trim(),start_ts:b.startISO,end_ts:b.endISO,status:'CONFIRMED',pay_mode:'BAR',total_amount_cents:total,deposit_amount_cents:0,currency:'eur',source,sport:'CALCETTO',payment_note:'BGT Match'+(total<base?' · offerta speciale':'')});
 if(error){if(error.code==='23505')return json({error:'Prenotazione in elaborazione: riprova senza cambiare orario.'},409);if(error.code==='23P01'||error.code==='P0001')return json({error:'Orario appena occupato. Scegline un altro.'},409);throw error;}
 await notifyBookingConfirmed({customerEmail:b.email,customerName:b.name.trim(),fieldName:resources[b.resourceId].name,timeLabel:formatBookingTimeLabel(b.startISO,b.endISO),bookingId:b.requestId,totalCents:total});
 return json({ok:true,id:b.requestId,status:'CONFIRMED',totalCents:total},201);
 }catch{return json({error:'Calendario temporaneamente non disponibile. Riprova con la stessa richiesta.'},503);}
}
