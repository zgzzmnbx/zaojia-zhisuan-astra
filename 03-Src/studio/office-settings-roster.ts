import {api} from './api';
import {officeDirectory} from './office-review';
import type {ReviewOptions} from './review-flow';

export type OfficeProfile={id:string;name:string;gender:string;trade:string;expertise:string;appearance:string;colors:Record<string,string>;seatId:string};
type Roster={revision:number;people:OfficeProfile[];seats:{id:string;label:string}[]};
const modelUrl='/office-twin/viewer/workstation-roster.js';
export async function loadOfficeRoster(signal:AbortSignal){
  const directory=Promise.allSettled(['default','weact_cost'].map(async profileId=>({
    profileId,options:await api<ReviewOptions>('/api/collaboration/external-dispatch/options?profile_id='+profileId,{signal}),
  })));
  const [config,platforms,model]=await Promise.all([api<Roster>('/api/astra/office-workstations',{signal}),directory,import(/* @vite-ignore */ modelUrl)]);
  const accounts=platforms.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
  const people:OfficeProfile[]=model.workstationRoster(officeDirectory(accounts),config).map(model.profile);
  return {...config,people};
}
