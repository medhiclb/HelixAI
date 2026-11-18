/** Modèles à espace de noms, délai Roblox et diagnostics, sans applications ni compte du poste. */
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';import {tmpdir} from 'node:os';
const dossier=mkdtempSync(join(tmpdir(),'helix-1118-'));
Object.assign(process.env,{HELIX_DATA_DIR:join(dossier,'data'),HELIX_WORKSPACE:join(dossier,'travail'),HELIX_CONFIG:join(dossier,'config.json')});writeFileSync(process.env.HELIX_CONFIG,JSON.stringify({chiffrement:'fichier'}));
try{
 const {modeleCodeParDefaut}=await import('../gateway/src/opencode.ts');
 const ms=[{id:'autre',uid:'lmstudio/autre'},{id:'openai/gpt-oss-20b',uid:'lmstudio/openai/gpt-oss-20b'}];
 assert.equal(modeleCodeParDefaut(ms,'lmstudio/openai/gpt-oss-20b'),'openai/gpt-oss-20b');assert.equal(modeleCodeParDefaut(ms,'openai/gpt-oss-20b'),'openai/gpt-oss-20b');assert.equal(modeleCodeParDefaut(ms,'introuvable'),'autre');assert.equal(modeleCodeParDefaut([],'inconnu'),'auto');
 const {delaiInitialisationMcp:delai}=await import('../gateway/src/delaisMcp.ts');
 assert.equal(delai({},60000),60000);assert.equal(delai({delaiDemarrageMs:120000},60000),120000);assert.equal(delai({delaiDemarrageMs:900000},60000),300000);assert.equal(delai({command:'npx'},60000),300000);assert.equal(delai({command:'npx'},1500,'1500'),300000);assert.equal(delai({delaiDemarrageMs:120000},60000,'250'),250);assert.equal(delai({delaiDemarrageMs:120000},60000,'invalide'),120000);
 const {echecConnexionRoblox}=await import('../gateway/src/roblox.ts');const {dansLaLangue}=await import('../gateway/src/langue.ts');
 for(const detail of ['Request timed out','MCP error -32001','timeout']){const msg=dansLaLangue('fr',()=>echecConnexionRoblox(detail));assert.match(msg,/Enable Studio as MCP server/);assert.match(msg,/Réessayer/);assert.match(msg,/témoin vert/)}
 assert.match(dansLaLangue('fr',()=>echecConnexionRoblox('processus arrêté')),/processus arrêté/);
 if(process.platform!=='win32'){
  const panne=spawnSync(process.execPath,['scripts/essai-code-ci.mjs','--modele','openai/gpt-oss-20b','--panne-demarrage','--sortie',join(dossier,'panne')],{encoding:'utf8',timeout:120000});
  assert.equal(panne.status,0,panne.stdout.slice(-1500)+panne.stderr.slice(-500));assert.match(panne.stdout,/5 vérification\(s\) réussie\(s\), 0 échec\(s\)/);
 }
 console.log('Correctifs 18/11 : modèle imposé résolu par uid ou id sans perte de préfixe, délais MCP bornés et délai Roblox spécifique, erreurs de connexion guidées.');
}finally{rmSync(dossier,{recursive:true,force:true})}
