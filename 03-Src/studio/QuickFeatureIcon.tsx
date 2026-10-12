import {icon} from '../icons.js';
import {capabilityIconNames} from '../icon-catalog.js';

export function QuickFeatureIcon({id}:{id:string}){
 const key=id.startsWith('custom:')?'custom':id;
 const name=capabilityIconNames[key as keyof typeof capabilityIconNames]??'question';
 const motion=['settings','configuration','collaboration-settings'].includes(key)?'gear':['analysis','review-progress'].includes(key)?'turn':['warning','risk'].includes(key)?'sway':key==='collaboration'?'greet':'lift';
 return <span data-motion={motion} className="quick-feature-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;
}
