import {officeExamples,indexPersonTasks,taskPriority,taskState} from './duty-board.js';
export {officeExamples,indexPersonTasks,taskState};
export {workstationRoster} from './workstation-roster.js';

export const planEndpoint='/api/astra/office-task-settings';
export const planNotice='astra.office.task-plan.v1';
export const emptyMember=()=>({revision:0,tasks:[],adjustments:{}});

export function taskKey(task) {
  if (task.dispatchId) return `review:${task.dispatchId}:${task.reviewRound || 0}`;
  if (task.manual || task.example) return task.id;
  return '';
}

// A projected entry never mutates its host receipt, the office board or the review selection.
export function memberEntries(tasks,personId,member=emptyMember()) {
  // Use the existing editable note so earlier office releases can still read the worklist.
  const manual=member.tasks.map(t=>{
    const project=t.description?.match(/^所属项目：([^\r\n]+)/u)?.[1]?.trim();
    return {...t,...(project?{projectName:project}:{}),manual:true,employeeId:personId,demo:false};
  });
  return [...manual,...tasks].map(original=>{
    const key=taskKey(original);
    const patch=member.adjustments[key] || {};
    const state=taskState(original).label;
    const entry={...original,key,hidden:!!patch.hidden,originalTitle:original.title,originalStatus:state,
      originalDescription:original.description || '',adjusted:false};
    if (patch.title!==undefined) entry.title=patch.title;
    if (patch.description!==undefined) entry.description=patch.description;
    if (patch.status!==undefined) {
      entry.personStatus=patch.status;
      entry.status=patch.status;
      entry.roundStatus='';
    }
    entry.adjusted=entry.title!==original.title || taskState(entry).label!==state ||
      (entry.description || '')!==(original.description || '');
    return entry;
  }).sort((a,b)=>taskPriority(a)-taskPriority(b));
}

export function applyTaskPlan(rawIndex,members={}) {
  if (!Object.keys(members).length) return rawIndex;
  const visible=new Map(rawIndex);
  for (const [personId,member] of Object.entries(members)) {
    visible.set(personId,memberEntries(rawIndex.get(personId) || [],personId,member).filter(t=>!t.hidden));
  }
  return visible;
}

// Use the latest saved receipt in each named project; manual entries and other rounds are independent.
export function olderProjectReviewKeys(entries) {
  const projects=new Map();
  for (const entry of entries) {
    if (entry.hidden || !entry.dispatchId || !entry.projectName || !entry.createdAt || taskState(entry).done || taskState({status:entry.originalStatus}).done) continue;
    const time=Date.parse(entry.createdAt);
    if (!Number.isFinite(time)) continue;
    if (!projects.has(entry.projectName)) projects.set(entry.projectName,[]);
    projects.get(entry.projectName).push({key:entry.key,time});
  }
  return [...projects.values()].flatMap(rows=>rows.sort((a,b)=>b.time-a.time || a.key.localeCompare(b.key)).slice(1).map(r=>r.key));
}
