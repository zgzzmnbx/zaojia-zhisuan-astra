import {reviewPeople, nextRound, type ReviewPlatform, type ReviewRequest, type ReviewTask} from './review-flow.ts';
import {reviewParticipants} from '../professional/components/agent-workspace/reviewProgress.ts';

export type OfficePerson = {id:string; name:string; selectable:boolean; selected:boolean; accounts:{platform:string;name:string}[]};
export type OfficeTask = {id:string; employeeId:string; title:string; artifactName?:string; status:string; personStatus?:string; roundStatus?:string; platformLabel?:string; demo:boolean; comment?:string};
export type OfficeSnapshot = {
  context:string; revision:number; request:ReviewRequest; people:OfficePerson[]; tasks:OfficeTask[];
  toggle:(id:string,selected:boolean)=>void;
};
export function createOfficeBridge() {
  let snapshot:OfficeSnapshot|null=null;
  let revision=0;
  const listeners=new Set<()=>void>();
  return {
    getSnapshot:()=>snapshot,
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    publish(value:Omit<OfficeSnapshot,'revision'>){snapshot={...value,revision:++revision};listeners.forEach(fn=>fn());},
    clear(context:string){if(snapshot?.context===context){snapshot=null;listeners.forEach(fn=>fn());}},
  };
}
export type OfficeBridge=ReturnType<typeof createOfficeBridge>;

// These directory aliases identify the user's two accounts. Actual selections use
// only the stable person_ref returned by the current, validated platform directory.
export function isOfficeOwner(platform:string,name:string) {
  return (platform==='default'&&name==='大尾巴')||(platform==='weact_cost'&&name==='石萌');
}
export function officeRoster(platforms:ReviewPlatform[],busy:boolean):OfficePerson[] {
  const people=new Map<string,OfficePerson>();
  for(const platform of platforms) {
    const available=reviewPeople(platform);
    for(const person of platform.options?.directory.people||[]) {
      const owner=isOfficeOwner(platform.profileId,person.display_name);
      const id=owner?'owner':`${platform.profileId}:${person.person_ref}`;
      const previous=people.get(id);
      const selectable=owner&&!busy&&platform.enabled&&platform.configurationOk&&
        (!platform.task||nextRound(platform.task))&&available.some(p=>p.person_ref===person.person_ref);
      people.set(id,{id,name:owner?'石萌':person.display_name,selectable:!!previous?.selectable||selectable,
        selected:!!previous?.selected||platform.selectedReviewers.includes(person.person_ref),accounts:[...(previous?.accounts||[]),{platform:platform.profileId,name:person.display_name}]});
    }
  }
  return [...people.values()].sort((a,b)=>Number(b.id==='owner')-Number(a.id==='owner'));
}
export function officeTasks(tasks:ReviewTask[],request:ReviewRequest,people:OfficePerson[]=[]):OfficeTask[] {
  return tasks.flatMap(task=>reviewParticipants(task).map((person,index)=>({
    id:`${task.task_id}:${index}`,employeeId:isOfficeOwner(task.platform,person.name)?'owner':people.find(p=>p.accounts.some(a=>a.platform===task.platform&&a.name===person.name))?.id||`${task.platform}:${person.name}`,
    title:request.projectName||request.fileName,status:`${task.platform==='default'?'飞书':'WeAct'} · ${person.status} · ${task.status_label}`,
    artifactName:request.fileName,personStatus:person.status,roundStatus:task.status_label,platformLabel:task.platform==='default'?'飞书':'WeAct',demo:false,comment:person.comment,
  })));
}
