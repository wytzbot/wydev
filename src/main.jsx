import React from "react";
import {createRoot} from "react-dom/client";
import App from "./App";
import "./styles.css";
import {initFullscreen} from "./fullscreen";

// A render error used to unmount the whole tree and leave a blank screen with no clue why
// (worse inside a TWA, where there is no devtools). Show the error instead.
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={error:null}; }
  static getDerivedStateFromError(error){ return {error}; }
  componentDidCatch(error, info){ try{ console.error("WyteLab render error", error, info?.componentStack); }catch{} }
  render(){
    if(!this.state.error) return this.props.children;
    const msg=String(this.state.error?.stack||this.state.error?.message||this.state.error).slice(0,1200);
    return <div style={{padding:"calc(24px + env(safe-area-inset-top,0px)) 20px 24px",color:"#e6edf3",font:"14px system-ui,sans-serif",background:"#0b0e11",minHeight:"100vh"}}>
      <h2 style={{margin:"0 0 8px"}}>WyteLab hit an error</h2>
      <p style={{opacity:.8,margin:"0 0 12px"}}>Tap reload. If it keeps happening, send this text to support.</p>
      <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:12,background:"#161b22",padding:12,borderRadius:8}}>{msg}</pre>
      <button onClick={()=>location.reload()} style={{padding:"12px 18px",borderRadius:10,border:0,background:"#58a6ff",color:"#0b0e11",fontWeight:600}}>Reload</button>
    </div>;
  }
}

createRoot(document.getElementById("root")).render(<ErrorBoundary><App/></ErrorBoundary>);
initFullscreen();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
