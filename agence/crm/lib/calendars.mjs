import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {createDAVClient} from 'tsdav';
import ICAL from 'ical.js';
import {publicAddress} from './imap.mjs';
import {AppError,stableId} from './crm.mjs';
import {check,decrypt} from './server.mjs';
export function calendarUrl(value) {
 const u=new URL(String(value).replace(/^webcal:/,'https:'));
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw new AppError('Utilisez une adresse HTTPS sans identifiants dans l’URL.');
 return u;
}
export async function safeCalendarFetch(input,options={},redirects=0) {
 const u=calendarUrl(typeof input==='string'?input:input.url);
 const addresses=await lookup(u.hostname,{all:true});
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new AppError('Serveur d’agenda non autorisé.');
 return new Promise((resolve,reject)=>{
  const req=https.request(u,{method:options.method||'GET',headers:Object.fromEntries(new Headers(options.headers).entries()),lookup:(_host,_opts,cb)=>cb(null,addresses[0].address,addresses[0].family),servername:u.hostname,timeout:12000},res=>{
   const chunks=[];let size=0;
   res.on('data',b=>{size+=b.length;if(size>10*1024*1024)res.destroy(new AppError('Agenda trop volumineux (10 Mo maximum).'));else chunks.push(b);});
   res.on('error',reject);res.on('end',async()=>{if([301,302,307,308].includes(res.statusCode)&&res.headers.location){try{const target=new URL(res.headers.location,u);if(redirects>=3||!(options.allowRedirect?options.allowRedirect(target.href):target.origin===u.origin))throw new AppError('Redirection de l’agenda refusée.');return resolve(await safeCalendarFetch(target.href,options,redirects+1));}catch(e){return reject(e);}}const response=new Response([204,205,304].includes(res.statusCode)?null:Buffer.concat(chunks),{status:res.statusCode,headers:res.headers});Object.defineProperty(response,'url',{value:u.href});resolve(response);});
  });
  req.on('timeout',()=>req.destroy(new AppError('Le serveur d’agenda ne répond pas.')));req.on('error',reject);if(options.body)req.write(options.body);req.end();
 });
}
export async function discoverCalendars(settings) {
 const root=calendarUrl(settings.url).origin;
 const allowed=u=>{const host=calendarUrl(u).hostname;return new URL(root).hostname===host || (new URL(root).hostname.endsWith('.icloud.com')&&host.endsWith('.icloud.com'));};
 const dav=await createDAVClient({serverUrl:calendarUrl(settings.url).href,credentials:{username:settings.username,password:settings.password},authMethod:'Basic',defaultAccountType:'caldav',fetch:(u,o)=>{if(!allowed(u))throw new AppError('Redirection de l’authentification refusée.');return safeCalendarFetch(u,{...o,allowRedirect:allowed});}});
 return {dav,calendars:await dav.fetchCalendars()};
}
function occurrenceDate(time,component,property) {
 if(time.zone?.tzid&&time.zone.tzid!=="floating")return time.toJSDate();
 const zone=component.getFirstProperty(property)?.getParameter('tzid')||component.getFirstProperty('dtstart')?.getParameter('tzid')||'Europe/Paris';
 let fmt;try{fmt=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}catch{throw new AppError('Fuseau horaire inconnu : '+zone);}
 const wall=Date.UTC(time.year,time.month-1,time.day,time.hour,time.minute,time.second);let utc=wall;
 for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(utc)).map(x=>[x.type,x.value]));const displayed=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);const delta=wall-displayed;if(!delta)break;utc+=delta;}
 return new Date(utc);
}
export function parseCalendar(text,from=new Date(Date.now()-30*864e5),until=new Date(Date.now()+180*864e5)) {
 const root=new ICAL.Component(ICAL.parse(text));
 for(const z of root.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(z.getFirstPropertyValue('tzid'),new ICAL.Timezone(z));
 const result=[];let steps=0;
 for(const component of root.getAllSubcomponents('vevent')) {
  if(component.hasProperty('recurrence-id'))continue;
  const event=new ICAL.Event(component);
  for(const ex of root.getAllSubcomponents('vevent'))if(ex.getFirstPropertyValue('uid')===event.uid&&ex.hasProperty('recurrence-id'))event.relateException(new ICAL.Event(ex));
  const add=(start,end,key,instance=event)=>{if(end>from&&start<until&&instance.component.getFirstPropertyValue('status')!=='CANCELLED')result.push({external_id:event.uid+':'+key,starts_at:start.toISOString(),ends_at:end.toISOString(),title:instance.summary||event.summary||'Rendez-vous',private:['PRIVATE','CONFIDENTIAL'].includes(instance.component.getFirstPropertyValue('class')||component.getFirstPropertyValue('class'))});};
  if(event.isRecurring()) {
   const it=event.iterator();let next;
   while((next=it.next())) {if(++steps>50000)throw new AppError('Agenda trop complexe : utilisez un flux limité à la période récente.');if(occurrenceDate(next,component,'dtstart')>until)break;const details=event.getOccurrenceDetails(next);add(occurrenceDate(details.startDate,details.item.component,'dtstart'),occurrenceDate(details.endDate,details.item.component,'dtend'),next.toString(),details.item);}
  }else if(event.startDate&&event.endDate)add(occurrenceDate(event.startDate,component,'dtstart'),occurrenceDate(event.endDate,component,'dtend'),event.startDate.toString());
  if(result.length>3000)throw new AppError('Plus de 3 000 occurrences : choisissez un agenda plus ciblé.');
 }
 return result;
}
export async function syncExternalCalendar(client,account) {
 const secret=decrypt(account.encrypted_credentials);let texts;
 if(account.kind==='ics') {const res=await safeCalendarFetch(secret.url);if(!res.ok)throw new AppError('Flux ICS inaccessible. Vérifiez son adresse privée.',422);texts=[await res.text()];}
 else {const {dav,calendars}=await discoverCalendars(secret);const calendar=calendars.find(c=>c.url===account.calendar_url);if(!calendar)throw new AppError('Agenda introuvable. Reconnectez-le.',422);const objects=await dav.fetchCalendarObjects({calendar,timeRange:{start:new Date(Date.now()-30*864e5).toISOString(),end:new Date(Date.now()+180*864e5).toISOString()}});texts=objects.map(o=>o.data);}
 const slots=texts.flatMap(t=>parseCalendar(t)).map(s=>({id:stableId(account.id+':'+s.external_id),workspace_id:account.workspace_id,account_id:account.id,user_id:account.user_id,external_id:s.external_id,starts_at:s.starts_at,ends_at:s.ends_at,title:account.share_details&&!s.private?s.title:null}));
 // Commit the complete generation atomically; a failed import preserves the previous planning.
 check(await client.rpc('crm_replace_external_slots',{account:account.id,slots,expected_sync:account.last_sync_at||null}));
 return {count:slots.length};
}
