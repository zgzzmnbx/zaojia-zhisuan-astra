import "./astra-bridge";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./compact-touch.css";
import "./agent-primary-layout.css";
import "./astra-professional.css";
import "../studio/appearance.css";

class ProfessionalBoundary extends React.Component<React.PropsWithChildren,{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="professional-error" role="alert"><h2>专业工具未能载入</h2><p>当前对话和已生成的成果仍保留。重新载入后继续。</p><button type="button" onClick={()=>location.reload()}>重新载入工具</button></main>:this.props.children;}
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProfessionalBoundary><App /></ProfessionalBoundary>
  </React.StrictMode>,
);
