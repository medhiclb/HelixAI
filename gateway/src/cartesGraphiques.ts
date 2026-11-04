import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export interface CarteGraphique {gpuFabricant:'amd'|'intel';gpuNom:string;gpuVramGb?:number;gpuDedie:boolean}
/** Le DWORD AdapterRAM de Windows ne sait pas représenter les cartes de plus de 4 Go.
 * La valeur QWORD du pilote prévaut ; une valeur tronquée ne devient jamais « 16 Go ». */
export function carteWindows(brut:string):CarteGraphique|undefined{
 let donnees:unknown;try{donnees=JSON.parse(brut.replace(/^\uFEFF/,''))}catch{return undefined}
 const cartes=(Array.isArray(donnees)?donnees:[donnees]).flatMap(c=>{
  if(!c||typeof c!=='object')return[];const {nom,id,octets}=c as Record<string,unknown>;if(typeof nom!=='string')return[];
  const amd=/AMD|Radeon/i.test(nom)||typeof id==='string'&&/VEN_1002/i.test(id);const intel=/Intel/i.test(nom)||typeof id==='string'&&/VEN_8086/i.test(id);if(!amd&&!intel)return[];
  const go=typeof octets==='number'&&Number.isFinite(octets)&&octets>0&&octets<1024**4?Math.round(octets/1024**3*10)/10:undefined;
  const dedie=amd?/\b(RX\s*\d[\w-]*|Radeon\s+PRO|FirePro)\b/i.test(nom):/\bArc(?:\(TM\))?\s+(?:Pro\s+)?[AB]\d{2,3}\b/i.test(nom);
  return[{gpuFabricant:amd?'amd' as const:'intel' as const,gpuNom:nom.slice(0,160),gpuDedie:dedie,...(go&&dedie?{gpuVramGb:go}:{})}];
 });return cartes.sort((a,b)=>Number(b.gpuDedie)-Number(a.gpuDedie)||(b.gpuVramGb??0)-(a.gpuVramGb??0))[0];
}
const SCRIPT_WINDOWS=String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$cartes=@(Get-CimInstance Win32_VideoController)
$reg=@(Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Video' -ErrorAction SilentlyContinue | ForEach-Object { Get-ChildItem $_.PSPath -ErrorAction SilentlyContinue } | ForEach-Object { Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue })
@($cartes | ForEach-Object {
 $nom=$_.Name; $id=$_.PNPDeviceID; $octets=$null
 $r=$reg | Where-Object { ($_.'HardwareInformation.AdapterString' -is [string] -and $_.'HardwareInformation.AdapterString' -eq $nom) -or $_.DriverDesc -eq $nom } | Select-Object -First 1
 if($r -and $r.'HardwareInformation.qwMemorySize' -gt 0){$octets=[double]$r.'HardwareInformation.qwMemorySize'}
 elseif($_.AdapterRAM -gt 0 -and $_.AdapterRAM -lt 4000000000){$octets=[double]$_.AdapterRAM}
 [PSCustomObject]@{nom=$nom;id=$id;octets=$octets}
}) | ConvertTo-Json -Compress
`;
export function lireCarteNonNvidia(plateforme:NodeJS.Platform):CarteGraphique|undefined{
 try{if(plateforme==='win32')return carteWindows(execFileSync(join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command',SCRIPT_WINDOWS],{encoding:'utf8',timeout:5000,windowsHide:true,stdio:['ignore','pipe','ignore']}));
 if(plateforme==='linux'){
  const cartes:CarteGraphique[]=[];for(const nom of readdirSync('/sys/class/drm').filter(n=>/^card\d+$/.test(n))){try{const d=join('/sys/class/drm',nom,'device');const fabricant=readFileSync(join(d,'vendor'),'utf8').trim();if(fabricant!=='0x1002'&&fabricant!=='0x8086')continue;const octets=Number(readFileSync(join(d,'mem_info_vram_total'),'utf8').trim());if(!Number.isFinite(octets)||octets<4*1024**3)continue;cartes.push({gpuFabricant:fabricant==='0x1002'?'amd':'intel',gpuNom:fabricant==='0x1002'?'AMD Radeon':'Intel',gpuDedie:true,gpuVramGb:Math.round(octets/1024**3*10)/10})}catch{/* Un iGPU sans mémoire dédiée garde le calcul prudent au processeur. */}}
  return cartes.sort((a,b)=>(b.gpuVramGb??0)-(a.gpuVramGb??0))[0];
 }}catch{/* Pilote absent ou interrogation refusée : aucun matériel inventé. */}return undefined;
}
