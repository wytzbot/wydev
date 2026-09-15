import {useEffect,useMemo,useState} from "react";
import {Activity,CheckCircle2,Clock3,Play,RefreshCw,RotateCcw,Square,Terminal,TriangleAlert,XCircle} from "lucide-react";
import {github} from "../github";
import {billing} from "../billing";
import {loadState,saveState} from "../storage";
import {toastError,toastSuccess,toastInfo} from "../toast";
import Select from "../components/Select";

const statusLabel=(run)=>String(run?.conclusion||run?.status||"unknown").replaceAll("_"," ");
const isRunning=run=>["queued","in_progress","waiting","requested","pending"].includes(String(run?.status||"").toLowerCase());
const isFailed=run=>String(run?.conclusion||"").toLowerCase()==="failure";
const fmtDate=v=>v?new Date(v).toLocaleString():"—";

export default function Actions({repos}){
 const [repoId,setRepoId]=useState(()=>loadState("actionsRepo","")||"");
 const [runs,setRuns]=useState([]),[workflows,setWorkflows]=useState([]),[jobs,setJobs]=useState([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(""),[selectedRun,setSelectedRun]=useState(null),[showDispatch,setShowDispatch]=useState(false);
 const [workflowId,setWorkflowId]=useState(""),[ref,setRef]=useState("main"),[message,setMessage]=useState(""),[plan,setPlan]=useState("free");
 const repo=useMemo(()=>repos.find(r=>String(r.id)===String(repoId))||repos[0]||null,[repos,repoId]);
 useEffect(()=>{if(repo&&!repoId){setRepoId(String(repo.id));saveState("actionsRepo",String(repo.id));}},[repo,repoId]);
 const load=async()=>{if(!repo)return;setLoading(true);try{const [r,w]=await Promise.all([github.actionsRuns(repo.owner?.login||repo.full_name.split("/")[0],repo.name),github.workflows(repo.owner?.login||repo.full_name.split("/")[0],repo.name)]);setRuns(r.runs||[]);setWorkflows(w.workflows||[]);if(!workflowId&&w.workflows?.[0]){setWorkflowId(String(w.workflows[0].id));setRef(repo.default_branch||"main");}setMessage("");}catch(e){setMessage(e.message||"Could not load GitHub Actions.");toastError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[repo?.id]);
 useEffect(()=>{billing.status().then(x=>setPlan(x?.plan||"free")).catch(()=>setPlan("free"))},[]);
 const owner=repo?.owner?.login||repo?.full_name?.split("/")[0];
 const selectRepo=e=>{setRepoId(e.target.value);saveState("actionsRepo",e.target.value);setSelectedRun(null);setJobs([])};
 const runAction=async(key,fn)=>{setBusy(key);try{await fn();toastSuccess("GitHub Actions updated");await load()}catch(e){toastError(e.message||"GitHub Actions request failed")}finally{setBusy("")}};
 const inspect=async run=>{setSelectedRun(run);setBusy(`jobs:${run.id}`);try{const d=await github.actionsJobs(owner,repo.name,run.id);setJobs(d.jobs||[])}catch(e){toastError(e.message)}finally{setBusy("")}};
 const rerun=(run,debug=false)=>{if(plan!=="pro"){toastInfo("Retrying a workflow is a Pro feature. Upgrade to Pro to rerun failed jobs.");return}return runAction(`rerun:${run.id}`,()=>github.rerunFailed(owner,repo.name,run.id,{debug}))};
 const cancel=(run,force=false)=>runAction(`cancel:${run.id}`,()=>github.cancelRun(owner,repo.name,run.id,force));
 const dispatch=async()=>{if(!workflowId||!ref.trim())return;await runAction("dispatch",async()=>{await github.dispatchWorkflow(owner,repo.name,workflowId,{ref:ref.trim(),inputs:{}});setShowDispatch(false)})};
 if(!repo)return <div className="page"><header><div><span className="eyebrow">ACTIONS</span><h1>Actions Control Center</h1></div></header><section className="panel"><p className="muted">Create or open a GitHub repository first. WyteLab will show its workflow runs here.</p></section></div>;
 return <div className="page actionsPage">
   <header><div><span className="eyebrow">GITHUB ACTIONS</span><h1>Actions Control Center</h1><p className="muted">See builds, retry failures and control workflows without opening GitHub.</p></div><button className="ghost" onClick={load} disabled={loading}><RefreshCw size={16}/>Refresh</button></header>
   <section className="panel"><h3>REPOSITORY</h3><Select value={repoId} onChange={selectRepo} options={repos.map(r=>({value:String(r.id),label:r.full_name}))} label="Repository" /><div className="actionQuick"><button className="primary" onClick={()=>setShowDispatch(v=>!v)}><Play size={16}/>{showDispatch ? "Close runner" : "Run workflow"}</button><span className="muted">Free: view, inspect, dispatch and cancel workflows · Pro: rerun failed jobs</span></div>{showDispatch&&<div className="inlineDispatch"><Select value={workflowId} onChange={setWorkflowId} options={workflows.map(w=>({value:String(w.id),label:w.name}))} label="Workflow" /><input className="searchInput" value={ref} onChange={e=>setRef(e.target.value)} placeholder="Branch or tag, e.g. main"/><p className="muted">Workflow must support workflow_dispatch.</p><button className="primary" disabled={busy==="dispatch"||!workflowId||!ref.trim()} onClick={dispatch}>{busy==="dispatch"?"Starting…":"Start workflow"}</button></div>}</section>
   {message&&<section className="panel"><p className="error">{message}</p></section>}
   <section className="panel"><div className="panelTitleRow"><h3>RECENT RUNS</h3><span className="muted">{runs.length} shown</span></div>{loading&&!runs.length?<p className="muted">Loading workflow runs…</p>:!runs.length?<p className="muted">No GitHub Actions runs found for this repository.</p>:<div className="actionRuns">{runs.map(run=><article className={`actionRun ${selectedRun?.id===run.id?"selected":""}`} key={run.id} onClick={()=>inspect(run)}><div className="runIcon">{isRunning(run)?<Activity size={18}/>:isFailed(run)?<XCircle size={18}/>:run.conclusion==="success"?<CheckCircle2 size={18}/>:<Clock3 size={18}/>}</div><div className="runMain"><b>{run.name||run.workflow_id||"Workflow run"}</b><span>{statusLabel(run)} · {run.head_branch||run.head_sha?.slice(0,8)||"unknown ref"}</span><small>{fmtDate(run.updated_at||run.created_at)} · #{run.run_number??run.id}</small></div><div className="runActions"><button title="View jobs" onClick={e=>{e.stopPropagation();inspect(run)}} disabled={busy===`jobs:${run.id}`}><Terminal size={15}/></button>{isFailed(run)&&<button title="Retry failed jobs (Pro)" onClick={e=>{e.stopPropagation();rerun(run,false)}} disabled={!!busy}><RotateCcw size={15}/><span className="proPill">PRO</span></button>}{isRunning(run)&&<button title="Cancel workflow" onClick={e=>{e.stopPropagation();cancel(run,false)}} disabled={!!busy}><Square size={14}/></button>}</div></article>)}</div>}</section>
   {selectedRun&&<section className="panel"><div className="panelTitleRow"><div><h3>RUN DETAILS</h3><b>{selectedRun.name||"Workflow"} #{selectedRun.run_number??selectedRun.id}</b></div><span className="muted">{statusLabel(selectedRun)}</span></div><div className="runMeta"><span>Branch: {selectedRun.head_branch||"—"}</span><span>Started: {fmtDate(selectedRun.run_started_at||selectedRun.created_at)}</span><span>Updated: {fmtDate(selectedRun.updated_at)}</span></div>{isFailed(selectedRun)&&<div className="actionTools"><button disabled={!!busy} title="Pro required" onClick={()=>rerun(selectedRun,false)}><RotateCcw size={16}/>Retry failed jobs <span className="proPill">PRO</span></button><button disabled={!!busy} title="Pro required" onClick={()=>rerun(selectedRun,true)}><TriangleAlert size={16}/>Debug rerun <span className="proPill">PRO</span></button></div>}{jobs.length>0&&<div className="jobsList">{jobs.map(j=><div className="jobRow" key={j.id}><span>{j.conclusion==="success"?<CheckCircle2 size={15}/>:j.conclusion==="failure"?<XCircle size={15}/>:<Clock3 size={15}/>}</span><div><b>{j.name}</b><small>{j.status}{j.conclusion?` · ${j.conclusion}`:""}</small></div></div>)}</div>}<a className="inlineLink" href={selectedRun.html_url} target="_blank" rel="noreferrer">Open full run on GitHub ↗</a></section>}

 </div>;
}
