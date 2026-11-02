import { cn } from "@/lib/cn";

/** Portraits vectoriels locaux : aucune image ni requête vers un fournisseur. */
export function AvatarCoach({style="patient",className}:{style?:string;className?:string}){
 const lunettes=style==='socratique',coach=style==='entretien';const peau=style==='pratique'?'hsl(var(--avatar-peau-foncee))':lunettes||coach?'hsl(var(--avatar-peau-medium))':'hsl(var(--avatar-peau))';
 return <svg style={{color:coach||lunettes?"hsl(var(--info))":style==='pratique'?"hsl(var(--warning))":"hsl(var(--accent))"}} viewBox="0 0 160 180" aria-hidden="true" className={cn('shrink-0',className)}>
 <circle cx="80" cy="79" r="70" fill="currentColor" opacity=".12"/>
 <path d="M17 177c0-42 24-63 63-63s63 21 63 63" fill="currentColor"/>
 <path d="m62 114 18 25 18-25" fill="hsl(var(--card))"/><path d="M67 101v19q13 15 26 0v-19" fill={peau}/>
 <ellipse cx="80" cy="73" rx="37" ry="43" fill={peau}/>
 <path d={style==='pratique'?"M42 72q-9-47 31-47 45-10 47 47l-18-28q-19 17-48 12Z":coach?"M42 65q-4-44 36-44 44-3 42 47l-17-24q-24 15-49 10l-12 21Z":"M41 78q-16-57 34-58 53-6 47 62l-16-29q-12 10-28-8-5 17-26 19Z"} fill="hsl(var(--avatar-encre))"/>
 <path d="M63 74h1m31 0h1" stroke="hsl(var(--avatar-encre))" strokeWidth="5" strokeLinecap="round"/>
 <path d="M70 94q10 10 20 0" fill="none" stroke="hsl(var(--avatar-encre))" strokeWidth="3" strokeLinecap="round"/>
 {style==='personnalise'&&<path d="m125 104 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill="currentColor" stroke="hsl(var(--card))" strokeWidth="2"/>}
 {lunettes&&<g fill="none" stroke="hsl(var(--avatar-encre))" strokeWidth="3"><circle cx="63" cy="75" r="13"/><circle cx="97" cy="75" r="13"/><path d="M76 74h8"/></g>}
 {coach?<><path d="m80 139-7 10 7 25 7-25Z" fill="hsl(var(--card))"/><path d="M49 71q-9 28 8 33m46-33q9 28-8 33" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M106 92q0 17-17 17" fill="none" stroke="currentColor" strokeWidth="4"/></>:<><path d="m110 146 22-8 12 32-23 8Z" fill="hsl(var(--card))"/><path d="m116 151 13-5m-10 13 13-5" stroke="currentColor" strokeWidth="2"/></>}
 <circle cx="25" cy="30" r="6" fill="currentColor" opacity=".4"/><path d="M136 36v14m-7-7h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
 </svg>;
}
