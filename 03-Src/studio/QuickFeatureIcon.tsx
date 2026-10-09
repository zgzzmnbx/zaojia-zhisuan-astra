import {icon} from '../icons.js';
import {capabilityIconNames} from '../icon-catalog.js';

export function QuickFeatureIcon({id}:{id:string}){
 const key=id.startsWith('custom:')?'custom':id;
 const name=capabilityIconNames[key as keyof typeof capabilityIconNames]??'question';
 return <span className="quick-feature-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;
}
