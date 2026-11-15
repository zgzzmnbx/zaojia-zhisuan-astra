import fs from 'node:fs';
import {createInteriorLightPlan} from '../../public/office-twin/viewer/interior-light-plan.js';
const layout=JSON.parse(fs.readFileSync(new URL('../../public/office-twin/data/office_layout.json',import.meta.url),'utf8'));
fs.mkdirSync(new URL('../../Codex-Temp/office-night-bake/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../../Codex-Temp/office-night-bake/lights.json',import.meta.url),JSON.stringify(createInteriorLightPlan(layout),null,2));
