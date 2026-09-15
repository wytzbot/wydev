import { useRef, useState } from "react";
import { Stethoscope, X, Copy as CopyIcon, Check, Loader2, ArrowLeft } from "lucide-react";
import { diagnoseRepo } from "../ai";
import { copyBlob } from "../utils";
import { addLog, formatLog } from "../logs";

const BINARY_EXT = new Set(["png","jpg","jpeg","gif","webp","ico","bmp","svg","woff","woff2","ttf","otf","eot","pdf","zip","gz","tar","7z","rar","mp3","mp4","mov","wasm","map"]);
const SKIP_NAMES = new Set(["package-lock.json","yarn.lock","pnpm-lock.yaml"]);
const MAX_FILE_SIZE = 220 * 1024;
const CONCURRENCY = 6;

function pickTargets(fileIndex) {
  return (fileIndex || []).filter((f) => {
    const name = f.path.split("/").pop() || "";
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    return !SKIP_NAMES.has(name) && !BINARY_EXT.has(ext) && Number(f.size || 0) <= MAX_FILE_SIZE;
  });
}

function formatReport(result, meta) {
  const issues = (result.issues || []).slice(0, 5);
  const lines = [
    `Wyte AI Diagnosis`,
    `Repo: ${meta.repoName || "—"} · Branch: ${meta.branch || "—"}`,
    `Files: ${result.filesAnalyzed ?? "?"}/${result.filesTotal ?? "?"}`,
    `Risk: ${result.overall_risk || "unknown"}`,
    ``,
    `Summary: ${result.summary || "No clear issue found."}`,
  ];
  issues.forEach((iss, i) => {
    lines.push(``, `${i + 1}. ${iss.title || "Issue"} [${iss.severity || "unknown"}]`);
    if (iss.root_cause) lines.push(`Cause: ${iss.root_cause}`);
    if (iss.recommended_action) lines.push(`Action: ${iss.recommended_action}`);
  });
  if (!issues.length) lines.push(``, `No concrete issues identified.`);
  return lines.join("\n");
}

export default function AIDiagnostics({ repo, branch, fileIndex, files, fetchFileContent }) {
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const busy = phase === "fetching" || phase === "analyzing";
  const abortRef = useRef(null);
  const cancelledRef = useRef(false);

  const run = async () => {
    setError(""); setResult(null); setCopied(false);
    const targets = pickTargets(fileIndex);
    if (!targets.length) { setError("No readable code files were found to diagnose."); setPhase("error"); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;
    setPhase("fetching"); setProgress({ done: 0, total: targets.length });
    const collected = []; let idx = 0;
    const worker = async () => {
      while (idx < targets.length && !cancelledRef.current) {
        const i = idx++, f = targets[i];
        try { collected.push({ path: f.path, content: files?.[f.path] ?? ((await fetchFileContent(f.path)) || "") }); } catch {}
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) || 1 }, worker));
    if (cancelledRef.current) return;
    setPhase("analyzing");
    try {
      const out = await diagnoseRepo({ repo: repo?.full_name, branch, files: collected }, controller.signal);
      setResult(out);
      addLog({ type: "AI diagnosis", repo: repo?.full_name || "", branch: branch || "", text: formatReport(out, { repoName: repo?.full_name, branch }) });
      setPhase("done");
    } catch (e) {
      if (cancelledRef.current || e.name === "AbortError") return;
      setError(e.message || "Repository diagnosis failed"); setPhase("error");
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setPhase("idle");
    setProgress({ done: 0, total: 0 });
  };

  const doCopy = async () => {
    if (!result) return;
    await copyBlob(formatLog({createdAt:new Date().toISOString(),type:"AI diagnosis",repo:repo?.full_name||"",branch:branch||"",text:formatReport(result,{repoName:repo?.full_name,branch})}));
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };

  // Return the diagnosis card to its original idle state without running
  // another diagnosis or removing the saved diagnosis log.
  const restorePreviousState = () => {
    cancelledRef.current = false;
    abortRef.current = null;
    setResult(null);
    setError("");
    setCopied(false);
    setProgress({ done: 0, total: 0 });
    setPhase("idle");
  };

  return (
    <div className="aiDiagnosisInline">
      <button onClick={run} disabled={busy} title="Short AI diagnosis across the repository">
        <Stethoscope size={16} /> {busy ? "Processing…" : "Diagnose Repo"}
      </button>
      {busy && <div className="aiDiagnosisInlineState"><Loader2 size={16} className="spin" /><span>{phase === "fetching" ? `Reading files ${progress.done}/${progress.total || "?"}` : "Analyzing…"}</span><button type="button" className="aiDiagnosisCancel" onClick={cancel} title="Cancel diagnosis"><X size={14} /> Cancel</button></div>}
      {phase === "error" && <p className="error aiDiagnosisInlineError">{error}</p>}
      {phase === "done" && result && (
        <div className="aiDiagnosisInlineResult">
          <div className="panelTitleRow"><div><h3>AI DIAGNOSIS</h3><span className="muted">{result.filesAnalyzed}/{result.filesTotal} files · {result.usage ? `${result.usage.remaining}/${result.usage.limit} left today` : ""}</span></div><div className="aiDiagnosisResultActions"><button type="button" onClick={doCopy}>{copied ? <Check size={16} /> : <CopyIcon size={16} />} {copied ? "Copied" : "Copy"}</button><button type="button" onClick={restorePreviousState} title="Return to the diagnosis card"><ArrowLeft size={16} /> Back</button></div></div>
          <pre className="diagnosis">{formatReport(result, { repoName: repo?.full_name, branch })}</pre>
        </div>
      )}
    </div>
  );
}
