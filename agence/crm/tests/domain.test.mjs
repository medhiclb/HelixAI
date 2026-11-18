import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,isOverdue,pipelineTotal,exportCsv} from '../src/domain.mjs';
test('les relances terminées et futures ne sont pas en retard',()=>{const now=new Date('2026-11-12T12:00:00Z');assert.equal(isOverdue({due_at:'2026-11-11',done:true},now),false);assert.equal(isOverdue({due_at:'2026-11-13'},now),false);assert.equal(isOverdue({due_at:'2026-11-11'},now),true)});
test('le pipeline exclut gagné/perdu et additionne les montants',()=>assert.equal(pipelineTotal([{stage:'Gagné',amount:20},{stage:'Perdu',amount:100},{stage:'Proposition',amount:'1200'},{stage:'Premier contact',amount:300}]),1500));
test('export CSV préserve les guillemets et séparateurs',()=>assert.ok(exportCsv([{name:'Cabinet "A"; B'}]).includes('"Cabinet ""A""; B"')));
test('aucune donnée fictive au démarrage',()=>assert.ok(Object.values(blank()).every(x=>x.length===0)));

test('export CSV : les versions internes de collaboration ne sont pas exportées',()=>{const csv=exportCsv([{name:'Cabinet',_revision:2,_base:{name:'Ancien nom'}}]);assert.ok(csv.includes('Cabinet'));assert.ok(!csv.includes('_revision'));assert.ok(!csv.includes('_base'));});
