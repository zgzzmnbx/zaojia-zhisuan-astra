import test from 'node:test';
import assert from 'node:assert/strict';
import {readBackgrounds,backgroundKey,validBackground} from '../03-Src/studio/project-sandbox/scene-theme.ts';
test('legacy background keys preserve current V11 migration values',()=>{
 const values=new Map([[backgroundKey,JSON.stringify({classic:'#FFFFFF',solid:'#123456'})]]);globalThis.localStorage={getItem:(k:string)=>values.get(k)??null} as any;
 try{assert.deepEqual(readBackgrounds(),{classic:'#ffffff'});assert.equal(validBackground('url(test)'),null)}finally{delete (globalThis as any).localStorage}
});
