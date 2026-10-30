import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readToolbarPacket,toolbarProtocol} from '../03-Src/modules/digital_cost/toolbar.ts';
const valid=()=>({protocol:toolbarProtocol,type:'state',token:'frame-session',state:{taskId:'task_1',revision:35,tasks:[{id:'task_1',label:'历史演示'}],tabs:['功能点','费用'],selected:'功能点',busy:false,blocked:false,primary:{label:'查看规模',disabled:false}}});
test('toolbar accepts display-only data and copies nested values',()=>{
 const input=valid();const parsed=readToolbarPacket({...input,html:'<script/>'});assert.ok(parsed);input.state.tasks[0].label='changed';assert.equal(parsed.state.tasks[0].label,'历史演示');assert.equal('html' in parsed,false);
});
test('toolbar rejects wrong protocol and incomplete packets',()=>{
 for(const value of [null,{}, {...valid(),protocol:'digital-cost-toolbar/2'},{...valid(),type:'command'},{...valid(),token:''}])assert.equal(readToolbarPacket(value),null);
});
test('toolbar rejects stale task selector, invalid revisions and uncontrolled tabs',()=>{
 for(const change of [{taskId:'other'},{revision:-1},{revision:1.2},{selected:'unknown'},{tabs:['费用','费用']},{tabs:[]},{busy:'false'},{primary:{label:'Go',disabled:'false'}}])assert.equal(readToolbarPacket({...valid(),state:{...valid().state,...change}}),null);
});
test('toolbar bounds payload labels and collection size',()=>{
 for(const change of [{tasks:Array(1001).fill({id:'task_1',label:'x'})},{tasks:[{id:'task_1',label:'x'.repeat(301)}]},{tabs:Array(9).fill('x')}])assert.equal(readToolbarPacket({...valid(),state:{...valid().state,...change}}),null);
});
