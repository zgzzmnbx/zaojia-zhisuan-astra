// Presentation-only assignments never enter Astra's review recipient list.
export function assignmentRoute(snapshot,id){
  const person=snapshot.employees.find(p=>p.id===id);
  if(!person||!snapshot.enabled)return null;
  return id==='owner'?(person.selectable?'review':null):'demo';
}
export function createDemoAssignments(){
  let context=null;const ids=new Set();
  return {
    set(id,selected){if(id!=='owner'){if(selected)ids.add(id);else ids.delete(id);}},
    apply(snapshot){
      if(context!==snapshot.context){context=snapshot.context;ids.clear();}
      for(const id of ids)if(!snapshot.employees.some(p=>p.id===id))ids.delete(id);
      return {...snapshot,employees:snapshot.employees.map(p=>({...p,draggable:!!assignmentRoute(snapshot,p.id),
        ...(p.id==='owner'?{}:{selected:ids.has(p.id),demoAssignment:true})})),
        tasks:[...snapshot.tasks,...[...ids].map(id=>({id:`assignment:${id}`,employeeId:id,projectName:snapshot.projectName,title:snapshot.title,status:'待复核',demo:true}))]};
    },
  };
}
