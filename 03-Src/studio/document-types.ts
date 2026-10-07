export type DocumentSource={kind:'asset'|'report';source_id:string;name:string;revision?:string};
export type FormattedDocument={id:string;name:string;sha256:string;source_id:string;source_sha256:string;kind:'asset'|'report';conversation_id:string;status:string;warnings:string[]};
export type DocumentState={source:DocumentSource;output?:FormattedDocument;showOriginal?:boolean};
export const sourceKey=(source:DocumentSource)=>`${source.kind}:${source.source_id}`;
export function documentDownload(id:string,conversation:string){return `/api/astra/documents/${encodeURIComponent(id)}/download?conversation_id=${encodeURIComponent(conversation)}`;}
