import type {ExampleData} from './model';
/** No user-uploaded workbook or derived rows are distributed in this handoff.
 * Local integration may replace this provider only with explicitly authorized
 * data. Never import production secrets, private attachments or runtime files.
 */
export async function loadExampleData():Promise<ExampleData|null>{return null;}
