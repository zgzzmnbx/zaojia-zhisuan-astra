import test from 'node:test';
import assert from 'node:assert/strict';
import {selectAvailableSkill,skillSubmission,type SkillCatalog} from '../03-Src/studio/professional-skills.ts';
const active={id:'survey',display_name:'勘察测量',version:'1.0.0',status:'active',status_label:'已上线',description:'',capabilities:[],can_create_task:true};
const planned={...active,id:'services',status:'planned',status_label:'规划中',can_create_task:false};
const catalog:SkillCatalog={default_skill_id:'survey',items:[planned,active]};
test('saved unavailable or removed skill falls back to the live registry default',()=>{
 assert.equal(selectAvailableSkill(catalog,'services')?.id,'survey');assert.equal(selectAvailableSkill(catalog,'deleted')?.id,'survey');
 assert.equal(selectAvailableSkill({...catalog,items:[planned]},'services'),null);
 assert.equal(selectAvailableSkill({...catalog,items:[{...active,status:'disabled'}]},'survey'),null);
});
test('selected enabled skill submits its precise ID and version; planned skills cannot create tasks',()=>{
 const second={...active,id:'other',version:'2.0.1'};assert.deepEqual(skillSubmission(selectAvailableSkill({...catalog,items:[active,second]},'other')),{skill_id:'other',skill_version:'2.0.1'});
 assert.throws(()=>skillSubmission(planned));assert.throws(()=>skillSubmission(null));assert.throws(()=>skillSubmission({...active,status:'disabled'}));
});
