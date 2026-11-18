import {icon} from '../icons.js';

export default function OfficeSettingsIcon({name}:{name:string}) {
  return <span className="astra-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;
}
