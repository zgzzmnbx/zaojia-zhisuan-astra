import fs from 'node:fs';
import {createFocusGlow} from '../03-Src/studio/project-sandbox/focus-glow.mjs';
const glow=createFocusGlow(), shaders=glow.scene.children[0].children.map(m=>m.material.fragmentShader);glow.dispose();
// Emits a Playwright CLI run-code callback using the current production shaders.
// Float readback catches NaN/Infinity that screenshots and JS math tests miss.
const fn=async(page,shaders)=>{const results=await page.evaluate(shaders=>{
 const c=document.createElement('canvas'),gl=c.getContext('webgl2');gl.getExtension('EXT_color_buffer_float');c.width=c.height=128;
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,128,128);const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
 const depth=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,depth);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,1,1);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,1,1,gl.RGBA,gl.FLOAT,new Float32Array([1,1,1,1]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const vertex=compile(gl.VERTEX_SHADER,'#version 300 es\nuniform vec2 uvRange;out vec2 vUv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p*uvRange.x+uvRange.y;gl_Position=vec4(p*2.-1.,0.,1.);}');
 const results=[];
 for(let index=0;index<shaders.length;index++){
  const f=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;\n#define varying in\n#define texture2D texture\nout vec4 outColor;\n#define gl_FragColor outColor\n'+shaders[index]);const p=gl.createProgram();gl.attachShader(p,vertex);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
  gl.uniform2f(gl.getUniformLocation(p,'resolution'),128,128);gl.uniform2f(gl.getUniformLocation(p,'size'),12,12);gl.uniform2f(gl.getUniformLocation(p,'halfFootprint'),3,3);gl.uniform3f(gl.getUniformLocation(p,'tint'),.1,.5,1);gl.uniform1f(gl.getUniformLocation(p,'alpha'),1);gl.uniform1i(gl.getUniformLocation(p,'sceneDepth'),0);
  for(const [label,scale,offset] of [['surface',1,0],['edge',1.02,-.01],['top-ulp',0,1.00000012],['center',0,.5]])for(const time of [0,.01,1,3,6,9.99,10,24.5]){gl.uniform2f(gl.getUniformLocation(p,'uvRange'),scale,offset);gl.uniform1f(gl.getUniformLocation(p,'time'),time);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.viewport(0,0,128,128);gl.drawArrays(gl.TRIANGLES,0,3);const values=new Float32Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.FLOAT,values);results.push({index,label,time,nonFinite:values.filter(v=>!Number.isFinite(v)).length,max:Math.max(...values.filter(Number.isFinite)),error:gl.getError()});}
  gl.deleteProgram(p);gl.deleteShader(f);
 }
 gl.deleteShader(vertex);gl.deleteTexture(tex);gl.deleteTexture(depth);gl.deleteFramebuffer(fb);gl.getExtension('WEBGL_lose_context')?.loseContext();return results;
},shaders);
 const failures=results.filter(r=>r.nonFinite||r.error);
 if(failures.length)throw Error(`Non-finite focus shader output: ${JSON.stringify(failures)}`);
 return {passed:true,cases:results.length,results};
};
const output=process.argv[2]??'Codex-Temp/focus-gpu-check.cjs';
fs.writeFileSync(output,`async page=>(${fn.toString()})(page,${JSON.stringify(shaders)})`);

console.log(`GPU regression callback: ${output}`);
