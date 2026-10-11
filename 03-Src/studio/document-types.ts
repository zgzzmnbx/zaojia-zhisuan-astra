export type DocumentSource={kind:'asset'|'report'|'risk-markdown';source_id:string;name:string;revision?:string;reportRevision?:string};
export type FormattedDocument={id:string;name:string;sha256:string;source_id:string;source_sha256:string;kind:DocumentSource['kind'];conversation_id:string;status:string;warnings:string[]};
export type GongwenPrepared={id:string;sha256:string;name:string;suggested:string|null;candidates:{id:string;text:string;selectable:boolean;role:string}[];defaults:Record<string,boolean>};
export type GongwenDraft={prepared:GongwenPrepared;options:Record<string,boolean>;titleMode:'suggested'|'other'|'none'|'manual';selected:string;manualTitle:string};
export type DocumentState={source:DocumentSource;output?:FormattedDocument;showOriginal?:boolean;formatDraft?:GongwenDraft};
export const sourceKey=(source:DocumentSource)=>`${source.kind}:${source.source_id}`;
export function documentDownload(id:string,conversation:string){return `/api/astra/documents/${encodeURIComponent(id)}/download?conversation_id=${encodeURIComponent(conversation)}`;}
