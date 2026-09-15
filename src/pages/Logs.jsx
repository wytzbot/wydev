import {useState} from "react";
import {Clipboard,Check,Download,FileText,Trash2} from "lucide-react";
import {getLogs,clearLogs,downloadText,downloadPdf} from "../logs";
import {copyBlob} from "../utils";
import {toastSuccess} from "../toast";

export default function Logs(){
 const [logs,setLogs]=useState(()=>getLogs()),[copied,setCopied]=useState("");
 const copy=async(log)=>{await copyBlob(log.text||"");setCopied(log.id);setTimeout(()=>setCopied(""),1200)};
 const clear=()=>{clearLogs();setLogs([]);toastSuccess("Local logs cleared")};
 const refresh=()=>setLogs(getLogs());
 return <div className="page logsPage">
  <header><div><span className="eyebrow">LOCAL HISTORY</span><h1>Logs</h1><p className="muted">Latest WyteLab logs saved on this device only.</p></div></header>
  <section className="panel logsToolbar">
   <div className="logActions"><button onClick={()=>downloadText(logs)} disabled={!logs.length}><Download size={16}/>TXT</button><button onClick={()=>downloadPdf(logs)} disabled={!logs.length}><Download size={16}/>PDF</button><button onClick={clear} disabled={!logs.length}><Trash2 size={16}/>Clear</button></div>
   <span className="muted">{logs.length} latest log{logs.length===1?"":"s"}</span>
  </section>
  <section className="panel">{!logs.length?<div className="logsEmpty"><FileText size={26}/><p>No logs yet.</p><span className="muted">AI diagnosis results will appear here automatically.</span></div>:<div className="logsList">{logs.map(log=><article className="logCard" key={log.id}><div className="logCardHead"><div><b>{log.type||"Log"}</b><small>{new Date(log.createdAt).toLocaleString()}{log.repo?` · ${log.repo}`:""}{log.branch?` · ${log.branch}`:""}</small></div><button onClick={()=>copy(log)} title="Copy log">{copied===log.id?<Check size={16}/>:<Clipboard size={16}/>}</button></div><pre>{log.text||""}</pre></article>)}</div>}</section>
 </div>
}
