import {Component,type ReactNode} from 'react';

/** Keep a failed lazy import inside the document pane, outside Suspense. */
export class DocumentPreviewBoundary extends Component<{children:ReactNode;onReload:()=>Promise<void>},{failed:boolean;reloading:boolean;reloadError:string}>{
 state={failed:false,reloading:false,reloadError:''};
 static getDerivedStateFromError(){return {failed:true};}
 reload=async()=>{
  if(this.state.reloading)return;
  this.setState({reloading:true,reloadError:''});
  try{await this.props.onReload();}
  catch{this.setState({reloadError:'草稿尚未保存，请先处理聊天中的保存提示。'});}
  finally{this.setState({reloading:false});}
 };
 render(){
  if(!this.state.failed)return this.props.children;
  return <div className="empty-state document-load-error" role="alert"><p>Word 预览未能加载，可刷新页面或下载 Word 查看。</p><button className="btn btn-primary btn-sm" disabled={this.state.reloading} onClick={this.reload}>{this.state.reloading?'正在保存草稿…':'保存草稿并刷新'}</button>{this.state.reloadError&&<p>{this.state.reloadError}</p>}</div>;
 }
}
