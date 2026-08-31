import { useState } from "react";
import { Stethoscope, X, Copy as CopyIcon, Check, Loader2 } from "lucide-react";
import { diagnoseRepo } from "../ai";
import { copyBlob } from "../utils";

// Files that never help a diagnosis and only burn context budget / AI credit.
const BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "svg",
  "woff", "woff2", "ttf", "otf", "eot",
  "pdf", "zip", "gz", "tar", "7z", "rar",
  "mp3", "mp4", "mov", "wasm", "map",
]);
const SKIP_NAMES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);
const MAX_FILE_SIZE = 220 * 1024;
const CONCURRENCY = 6;

function pickTargets(fileIndex) {
  return (fileIndex || []).filter((f) => {
    const name = f.path.split("/").pop() || "";
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    if (SKIP_NAMES.has(name)) return false;
    if (BINARY_EXT.has(ext)) return false;
    if (Number(f.size || 0) > MAX_FILE_SIZE) return false;
    return true;
  });
}

function formatReport(result, meta) {
  const lines = [
    `WyDev AI Repository Diagnosis`,
    `Repo: ${meta.repoName || "—"}   Branch: ${meta.branch || "—"}`,
    `Files analyzed: ${result.filesAnalyzed ?? "?"} / ${result.filesTotal ?? "?"}`,
    ``,
    `SUMMARY`,
    result.summary || "—",
    ``,
    `OVERALL RISK: ${result.overall_risk || "unknown"}`,
    ``,
  ];
  (result.issues || []).forEach((iss, i) => {
    lines.push(`ISSUE ${i + 1}: ${iss.title || "Untitled issue"} [${iss.severity || "unknown"}]`);
    if (iss.affected_files?.length) lines.push(`Files: ${iss.affected_files.join(", ")}`);
    if (iss.root_cause) lines.push(`Root cause: ${iss.root_cause}`);
    if (iss.evidence?.length) lines.push(`Evidence:\n  - ${iss.evidence.join("\n  - ")}`);
    if (iss.recommended_action) lines.push(`Recommended action: ${iss.recommended_action}`);
    lines.push(``);
  });
  if (result.architecture_notes) lines.push(`ARCHITECTURE NOTES`, result.architecture_notes, ``);
  if (result.confidence != null) lines.push(`Confidence: ${result.confidence}`);
  if (result.omittedFiles?.length) {
    lines.push(``, `Note: ${result.omittedFiles.length} file(s) were skipped to stay within the diagnosis budget:`, result.omittedFiles.join(", "));
  }
  return lines.join("\n");
}

// Toolbar-triggered, whole-repository AI diagnosis. Renders as a single tool
// button (drop straight into .projectTools) plus a bottom sheet that opens on
// click, shows a "processing" state while files are fetched and analyzed,
// then the deep explanation with a copy-to-clipboard action.
export default function AIDiagnostics({ repo, branch, fileIndex, files, fetchFileContent }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | fetching | analyzing | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const busy = phase === "fetching" || phase === "analyzing";

  const run = async () => {
    setOpen(true);
    setError("");
    setResult(null);
    setCopied(false);
    const targets = pickTargets(fileIndex);
    setPhase("fetching");
    setProgress({ done: 0, total: targets.length });
    const collected = [];
    let idx = 0;
    const worker = async () => {
      while (idx < targets.length) {
        const i = idx++;
        const f = targets[i];
        try {
          const content = files?.[f.path] ?? (await fetchFileContent(f.path));
          collected.push({ path: f.path, content: content || "" });
        } catch {
          // A single unreadable file shouldn't sink the whole diagnosis —
          // it's just left out of the context sent to the model.
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) || 1 }, worker));
    setPhase("analyzing");
    try {
      const out = await diagnoseRepo({ repo: repo?.full_name, branch, files: collected });
      setResult(out);
      setPhase("done");
    } catch (e) {
      setError(e.message || "Repository diagnosis failed");
      setPhase("error");
    }
  };

  const doCopy = async () => {
    if (!result) return;
    await copyBlob(formatReport(result, { repoName: repo?.full_name, branch }));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <button onClick={run} disabled={busy} title="Deep AI diagnosis across the whole repository">
        <Stethoscope size={16} />
        {busy ? "Processing…" : "Diagnose Repo"}
      </button>
      {open && (
        <div className="sheet aiDiagnosisSheet">
          <div className="row aiDiagnosisHead">
            <h3>AI REPOSITORY DIAGNOSIS</h3>
            <button aria-label="Close" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          {busy && (
            <div className="aiDiagnosisProgress">
              <Loader2 size={16} className="spin" />
              <span>
                {phase === "fetching"
                  ? `Processing… reading files ${progress.done}/${progress.total || "?"}`
                  : "Processing… analyzing the repository"}
              </span>
            </div>
          )}
          {phase === "error" && <p className="error">{error}</p>}
          {phase === "done" && result && (
            <>
              <p className="muted aiDiagnosisMeta">
                {result.filesAnalyzed}/{result.filesTotal} files analyzed
                {result.usage ? ` · ${result.usage.remaining}/${result.usage.limit} diagnoses left today` : ""}
              </p>
              <pre className="diagnosis">{formatReport(result, { repoName: repo?.full_name, branch })}</pre>
              <div className="sheetActions">
                <button onClick={doCopy}>
                  {copied ? <Check size={16} /> : <CopyIcon size={16} />}
                  {copied ? "Copied" : "Copy explanation"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
