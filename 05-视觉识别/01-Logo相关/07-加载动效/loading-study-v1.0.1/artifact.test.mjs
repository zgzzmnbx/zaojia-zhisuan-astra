import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

test('delivered HTML has exactly one executable script without template contamination',()=>{
 const html=readFileSync(new URL('./造价智算-波浪加载.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 assert.equal(html.split('<script>').length,2);
 assert.equal(html.split('<!doctype html>').length,2);
 assert.doesNotThrow(()=>new Script(scripts[0][1]));
 assert.ok(!html.includes('/*SCRIPT*/'));
 assert.ok(!html.includes('class="status"'));
});
