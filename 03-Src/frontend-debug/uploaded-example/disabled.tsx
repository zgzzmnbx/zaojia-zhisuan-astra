/** Production build boundary: the uploaded attachment example is debug-only. */
export type ExampleTab='table'|'risks'|'report';
export type ExampleRequest={id:number;tab:ExampleTab};
export type ExampleProps={request:ExampleRequest|null;active:boolean;sourceDetails?:boolean;onOpenProject?:()=>void;onTabChange?:(tab:ExampleTab)=>void};
export default function UploadedExample(_props:ExampleProps){return null;}
