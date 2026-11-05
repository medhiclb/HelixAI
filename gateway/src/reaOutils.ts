import { toolsForModel } from "./mcp.ts";
import type { DefinitionOutil } from "./outils.ts";
import { t } from "./langue.ts";
const disponibles=()=>toolsForModel().filter(x=>x.function.name.startsWith('rea__'));
/** Deux entrées légères, au lieu des 229 schémas de REA envoyés à chaque tour. */
export function outilsReaCode():DefinitionOutil[]{if(!disponibles().length)return[];return[
 {type:'function',function:{name:'rea__chercher',description:t("Chercher les outils REA disponibles. Fournir recherche pour une liste courte, puis outil pour obtenir son schéma exact avant de l'appeler."),parameters:{type:'object',properties:{recherche:{type:'string'},outil:{type:'string'}},additionalProperties:false}}},
 {type:'function',function:{name:'rea__appeler',description:t("Appeler un outil REA après consultation de son schéma. Fournir son nom court et ses arguments. L'analyse locale demande une validation, et les moteurs externes doivent être disponibles."),parameters:{type:'object',required:['outil','arguments'],properties:{outil:{type:'string'},arguments:{type:'object',additionalProperties:true}},additionalProperties:false}}}
]}
export function chercherRea(args:Record<string,unknown>){const liste=disponibles();if(typeof args.outil==='string'&&args.outil){const nom='rea__'+args.outil;const outil=liste.find(x=>x.function.name===nom)?.function;if(!outil)throw Error(t("Cet outil REA n'est pas disponible."));const texte=JSON.stringify({outil:args.outil,description:outil.description,schema:outil.parameters});if(texte.length>48000)throw Error(t("Le schéma de cet outil REA dépasse la taille admise."));return texte}
 const q=typeof args.recherche==='string'?args.recherche.trim().slice(0,120).toLowerCase():'';
 const utiles=['binary_session','analyze_javascript_application','open_binary','inspect_desktop_application','inspect_model_artifact','close_binary'];
 const correspondances=liste.filter(x=>q?(x.function.name+' '+x.function.description).toLowerCase().includes(q):utiles.includes(x.function.name.slice(5)));
 return JSON.stringify({total:correspondances.length,outils:correspondances.slice(0,8).map(x=>({outil:x.function.name.slice(5),description:x.function.description.slice(0,400)}))});
}
export function resoudreRea(args:Record<string,unknown>){if(typeof args.outil!=='string'||!args.outil||args.outil.length>150||!args.arguments||typeof args.arguments!=='object'||Array.isArray(args.arguments))throw Error(t("Indiquez l'outil REA et ses arguments."));const nom='rea__'+args.outil;if(!disponibles().some(x=>x.function.name===nom))throw Error(t("Cet outil REA n'est pas disponible."));return{nom,args:args.arguments as Record<string,unknown>}}
