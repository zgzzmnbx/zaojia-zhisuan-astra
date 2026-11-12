import {icon} from '../../icons.js';
// Same local Phosphor assets; the standalone demo does not initialize the app's robot store.
export function Icon({name}:{name:string}){return <span className="astra-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;}
