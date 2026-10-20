import test from 'node:test';
import assert from 'node:assert/strict';
import {modelValidation,modelConfigurationStatus,saveModelCredential} from '../03-Src/studio/model-settings.ts';
const model={provider:'deepseek',model:'chosen-model',baseUrl:'https://model.example/v1',temperature:.2,maxTokens:1800};
test('model configuration accepts compatible endpoints but rejects embedded credentials and invalid parameters',()=>{
 assert.equal(modelValidation(model),'');
 for(const baseUrl of ['http://model.example','https://key@model.example','https://model.example?key=secret','not-a-url'])assert.ok(modelValidation({...model,baseUrl}));
 for(const maxTokens of [NaN,0,1.5,200000])assert.ok(modelValidation({...model,maxTokens}));
 assert.ok(modelValidation({...model,model:' '}));
 assert.ok(modelValidation({...model,temperature:NaN}));
 assert.ok(modelValidation({...model,provider:'unimplemented-company-provider'}));
});
test('credential presence never claims that a model is connected',()=>{
 assert.equal(modelConfigurationStatus(null,null),'尚未读取');
 assert.equal(modelConfigurationStatus({models:{}},model),'通道未启用');
 assert.equal(modelConfigurationStatus({models:{deepseek:{enabled:true,key_file:'key'}}},model),'待配置凭证');
 assert.equal(modelConfigurationStatus({models:{deepseek:{enabled:true,key_file:'key',configured:true}}},model),'凭证已读取 · 待业务验证');
});
test('saving one credential preserves latest unrelated platform and model settings',async()=>{
 const original=globalThis.fetch;
 const latest={models:{deepseek:{enabled:false,key_file:'old'},siliconflow:{enabled:true,key_file:'other'}},external_enabled:true,collaboration_file:'latest-profile',weknora:{enabled:true,base_url:'http://127.0.0.1:18091',api_key_file:'latest-wiki'}};
 const writes:unknown[]=[];
 globalThis.fetch=async(_url,init)=>{if(init?.method==='PUT'){const body=JSON.parse(String(init.body));writes.push(body);return new Response(JSON.stringify(body));}return new Response(JSON.stringify(latest));};
 try{
  const result=await saveModelCredential('deepseek',{enabled:true,key_file:' new-path ',configured:false});
  assert.deepEqual(writes,[{...latest,models:{...latest.models,deepseek:{enabled:true,key_file:'new-path'}}}]);
  assert.deepEqual(result.weknora,latest.weknora);
 }finally{globalThis.fetch=original;}
});
