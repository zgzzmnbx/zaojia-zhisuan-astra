// Display overrides cannot supply accounts, selected state or sending permissions.
import {normalizeAppearance} from './people/appearances.js';
export const genderLabel=value=>({male:'男',female:'女',unspecified:'未设置'}[value]||'未设置');
export function profile(person){
  return {id:person.id,name:person.name,gender:person.gender||'unspecified',appearance:normalizeAppearance(person.appearance),trade:person.trade||'',expertise:person.expertise||'',seatId:person.seatId||''};
}
export function workstationRoster(directory,config){
  if(!config)return directory;
  const saved=new Map(config.people.map(p=>[p.id,p])),people=directory.map(p=>({...p,...(saved.has(p.id)?profile(saved.get(p.id)):{} )}));
  for(const p of config.people)if(!people.some(item=>item.id===p.id))people.push({...profile(p),accounts:[],selected:false,selectable:false});
  const seats=config.seats.map(s=>s.id),used=new Set();
  for(const p of people){if(saved.has(p.id)&&seats.includes(p.seatId)&&!used.has(p.seatId))used.add(p.seatId);else p.seatId='';}
  for(const p of people)if(!p.seatId){p.seatId=seats.find(id=>!used.has(id))||'';if(p.seatId)used.add(p.seatId);}
  return people;
}
