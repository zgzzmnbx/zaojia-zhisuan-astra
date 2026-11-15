export const SETTINGS_KEY='officeTwin.H1.localSettings.v1';
export const DEFAULT_PEOPLE=Object.freeze([
{id:'demo-01',name:'演示员工 01',role:'土建',seat:'SEAT_NW_01',state:'复核中',task:'办公楼土建工程量复核',progress:65},
{id:'demo-02',name:'演示员工 02',role:'安装',seat:'SEAT_NW_03',state:'待复核',task:'给排水清单一致性检查',progress:30},
{id:'demo-03',name:'演示员工 03',role:'电气',seat:'SEAT_N_01',state:'复核中',task:'电气设备数量核对',progress:80},
{id:'demo-04',name:'演示员工 04',role:'造价',seat:'SEAT_E_01',state:'可分配',task:'综合单价复核准备',progress:0},
{id:'demo-05',name:'演示员工 05',role:'工艺',seat:'SEAT_SE_01',state:'待复核',task:'工艺安装清单检查',progress:45},
{id:'demo-06',name:'演示员工 06',role:'审核',seat:'SEAT_SW_01',state:'已完成',task:'材料价格核对',progress:100},
]);
export function defaults(){return {schemaVersion:1,officeName:'H1 办公室',roomNames:{},people:DEFAULT_PEOPLE.map(({id,name,role,seat})=>({id,name,role,seat}))};}
function text(value,label,max=60){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error(`${label}须为1–${max}个字符，不能包含控制字符`);return value.trim();}
export function availableSeats(layout){return layout.workstations.filter(w=>w.assignable!==false);}
export function allocationConflicts(config,layout){return config.people.filter(p=>layout.workstations.find(w=>w.seat_id===p.seat)?.assignable===false).map(p=>({id:p.id,name:p.name,seat:p.seat,reason:"原工位已停用，请重新选择工位"}));}
export function validateSettings(input,layout,{allowInactive=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.schemaVersion!==1)throw Error('不支持的配置格式或版本');
 const seats=new Set(layout.workstations.map(w=>w.seat_id)),rooms=new Set(layout.rooms.map(r=>r.id));
 const result={schemaVersion:1,officeName:text(input.officeName,'办公室名称'),roomNames:{},people:[]};
 if(!input.roomNames||typeof input.roomNames!=='object'||Array.isArray(input.roomNames))throw Error('房间名称格式错误');
 for(const [id,name] of Object.entries(input.roomNames)){if(!rooms.has(id))throw Error(`未知房间：${id}`);result.roomNames[id]=text(name,'房间名称');}
 if(!Array.isArray(input.people)||input.people.length>seats.size)throw Error(`同事数量不能超过${seats.size}个工位`);
 const usedSeats=new Set(),ids=new Set();
 for(const person of input.people){
  if(!person||typeof person!=='object'||!/^((demo-\d{2})|(local-[a-zA-Z0-9-]{1,70}))$/.test(person.id))throw Error('同事ID格式错误');
  if(ids.has(person.id))throw Error('同事ID重复');ids.add(person.id);
  if(!seats.has(person.seat))throw Error(`未知工位：${person.seat}`);
  if(!allowInactive&&layout.workstations.find(w=>w.seat_id===person.seat)?.assignable===false)throw Error(`${person.name} 的原工位 ${person.seat} 已停用，请重新分配；姓名未删除`);
  if(usedSeats.has(person.seat))throw Error(`工位 ${person.seat} 已分配给另一位同事`);usedSeats.add(person.seat);
  result.people.push({id:person.id,name:text(person.name,'同事姓名',40),role:text(person.role||'同事','岗位',40),seat:person.seat});
 }
 return result;
}
export function readSettings(layout,storage){
 try{storage??=globalThis.localStorage;const raw=storage.getItem(SETTINGS_KEY);const config=raw?validateSettings(JSON.parse(raw),layout,{allowInactive:true}):defaults();const conflicts=allocationConflicts(config,layout);return {config,saved:!!raw,conflicts,error:conflicts.length?`${conflicts.length}位同事的原工位已停用，姓名与原分配已保留，请进入办公室设置重新分配。`:null};}
 catch(error){return {config:defaults(),saved:false,conflicts:[],error:`本地配置未能读取，暂用演示默认值；原存储未覆盖：${error.message}`};}
}
export function saveSettings(input,layout,storage=globalThis.localStorage){const config=validateSettings(input,layout);storage.setItem(SETTINGS_KEY,JSON.stringify(config));return config;}
export function resetSettings(storage=globalThis.localStorage){storage.removeItem(SETTINGS_KEY);return defaults();}
export function applyRoomLabels(layout,config){return {...layout,rooms:layout.rooms.map(room=>({...room,label:config.roomNames[room.id]||room.label}))};}
export function configuredPeople(config,layout){return config.people.map(person=>{const demo=DEFAULT_PEOPLE.find(p=>p.id===person.id);const seat=layout.workstations.find(s=>s.seat_id===person.seat);const room=layout.rooms.find(r=>r.id===seat?.room_id);return {...(demo||{state:'未接业务',task:'尚未连接任务服务',progress:0}),...person,roomLabel:config.roomNames[room?.id]||room?.label||'9楼',allocationStatus:seat?.assignable===false?'needs-reassignment':'assigned',anchorName:seat?.assignable===false?null:`PersonAnchor_${person.seat}`};});}
export function applyOfficeNameDOM(config,doc=document){doc.title=`${config.officeName} · Astra 数字孪生`;for(const el of doc.querySelectorAll('[data-office-name]'))el.textContent=config.officeName;}
let layoutPromise;
export async function getOfficePeople(layout){if(!layout){layoutPromise??=fetch(new URL('../data/office_layout.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('无法读取工位');return r.json();});layout=await layoutPromise;}const {config}=readSettings(layout);return configuredPeople(config,layout);}
export function announceSettings(config){globalThis.dispatchEvent?.(new CustomEvent('office-config-changed',{detail:config}));}
