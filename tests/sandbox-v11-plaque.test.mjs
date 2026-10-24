import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {projectPlaqueState} from '../03-Src/studio/project-sandbox/project-plaque-state.ts';
import {clearPlaqueFootprint} from '../03-Src/studio/project-sandbox/project-plaque.mjs';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import manifest from '../05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v1/manifest.json' with {type:'json'};
const empty={ready:true,project:null,result:null,filename:'当前清单.xlsx',sheets:[],busy:'',qaRunning:false,needsRecalculate:false,riskLoading:false,riskError:'',reportReady:false,citations:0,reviewTasks:[],reviewError:''};
const result={job_id:'current',input_filename:'真正的项目文件.xlsx',summary:{matching_status:'completed',total_data_rows:100,matched_rows:99}};
const project={jobId:'current',riskLoaded:true,riskTotal:0,severity:{high:0,medium:0,low:0,other:0}};
test('plaque never borrows a result from another job or from restoring state',()=>{
 const input={...empty,result,project:{...project,jobId:'other'},reportReady:true};
 assert.equal(projectPlaqueState(input).completed,0);assert.equal(projectPlaqueState(input).filename,'当前清单.xlsx');
 const restoring=projectPlaqueState({...input,ready:false});assert.equal(restoring.completed,0);assert.equal(restoring.filename,'正在恢复项目…');
});
test('only published milestones fill the four segments; running, failure and cancellation do not',()=>{
 const input={...empty,result,project};
 assert.equal(projectPlaqueState(input).completed,3);
 const running=projectPlaqueState({...input,busy:'正在生成报告'});assert.equal(running.completed,3);assert.equal(running.running,'report');
 for(const phase of ['error','cancelled']){const state=projectPlaqueState(input,{phase,zone:'report'});assert.equal(state.completed,3);assert.match(state.status,phase==='error'?/失败/:/已停止/)}
 const finished=projectPlaqueState({...input,reportReady:true});assert.equal(finished.completed,4);assert.match(finished.status,/待审阅/);
 const dirty=projectPlaqueState({...input,reportReady:true,needsRecalculate:true});assert.equal(dirty.completed,1);assert.match(dirty.status,/待更新/);
});
test('clearing the five footprint blocks uses disposable geometry and leaves heroes and shared source intact',()=>{
 const root=new Group(),source=new BoxGeometry(1,1,1),material=new MeshBasicMaterial();
 const city=new Mesh(source,material);city.userData.role='background_city';const b=manifest.removedCityBounds[0];city.position.fromArray(b.min.map((v,i)=>(v+b.max[i])/2));root.add(city);
 const hero=new Mesh(source,material);hero.position.copy(city.position);hero.userData.role='hero_site';root.add(hero);
 const originalIndex=Array.from(source.index.array),cut=clearPlaqueFootprint(root);
 assert(cut.removedTriangles>0);assert.notEqual(city.geometry,source);assert.equal(hero.geometry,source);assert.deepEqual(Array.from(source.index.array),originalIndex);
 cut.dispose();assert.equal(city.geometry,source);source.dispose();material.dispose();
});
test('Blender stone has a 20 degree face below the main platform and verifiable exported assets',async()=>{
 assert.equal(manifest.angleDegrees,20);assert(manifest.top<0&&manifest.bottom>=-1.22);assert.equal(manifest.removedCityBounds.length,5);
 assert(Math.abs((manifest.top-(-1.10))/manifest.depth-Math.tan(Math.PI/9))<1e-9);
 for(const [file,sha] of Object.entries(manifest.hashes)){const bytes=await fs.readFile(new URL('../05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v1/'+file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha)}
});
