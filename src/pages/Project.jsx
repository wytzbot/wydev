import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, FilePlus, FolderPlus, ExternalLink, Upload, Trash2, Move, GitBranch, RefreshCw, ChevronDown, Loader2, Undo2, History, Download, FileText, Share2 } from "lucide-react";
import CodeEditor from "../components/CodeEditor";
import FileExplorer from "../components/FileExplorer";
import CommitPanel from "../components/CommitPanel";
import AIDiagnostics from "../components/AIDiagnostics";
import { github } from "../github";
import { billing } from "../billing";
import { buildChangeSet, renameFolder } from "../git";
import { copy, saveFile, openExternal } from "../utils";
import { nativeShareText } from "../wybuildBridge";
import { loadState, saveState } from "../storage";
import { shouldSkipUpload, readUploadedFile, isZipFile, extractZipEntries, stripCommonRoot, safeRepoPath } from "../files";
import { promptDialog, confirmDialog } from "../dialog";
import { LICENSES, fillLicensePlaceholders } from "../licenses";
import { toastSuccess, toastError, toastInfo } from "../toast";
import Select from "../components/Select";
import UploadPicker from "../components/UploadPicker";

// Vercel slugifies the imported repo name into the default project domain
// (lowercase, non-alphanumerics collapsed to single hyphens, trimmed) unless
// the person picked a custom project name or domain on vercel.com.
function vercelDomain(repoName) {
  const slug = String(repoName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "app"}.vercel.app`;
}

export default function Project({ repo, onBack, onWorkingState, openPath, onDeleteRepo, pendingShareText, onConsumeShare }) {
  const key = `project:${repo.id}`;
  const cached = loadState(key, null);
  const editorFontSize = loadState("fontSize", 16);
  const editorWordWrap = loadState("wordWrap", true);
  const [branch, setBranch] = useState(cached?.branch || repo.default_branch || "main"),
    [branches, setBranches] = useState([]),
    [files, setFiles] = useState(cached?.files || {}),
    [fileIndex, setFileIndex] = useState(cached?.fileIndex || Object.keys(cached?.files || {}).map((path) => ({ path, sha: null, size: 0 }))),
    [fileLoading, setFileLoading] = useState(false),
    [base, setBase] = useState(cached?.base || {}),
    [baseSha, setBaseSha] = useState(cached?.baseSha || ""),
    [selected, setSelected] = useState(cached?.selected || ""),
    [busy, setBusy] = useState(false),
    [changesOpen, setChangesOpen] = useState(false),
    [history, setHistory] = useState([]),
    [renamePreview, setRenamePreview] = useState(null),
    [editorView, setEditorView] = useState(null),
    [times, setTimes] = useState(cached?.times || {}),
    [loadedAt, setLoadedAt] = useState(cached?.loadedAt || Date.now()),
    [plan, setPlan] = useState("free"),
    [prs, setPrs] = useState([]),
    [prOpen, setPrOpen] = useState(false),
    [prBusy, setPrBusy] = useState(false),
    [remoteConflict, setRemoteConflict] = useState(null),
    [historyOpen, setHistoryOpen] = useState(false),
    [uploadPickerOpen, setUploadPickerOpen] = useState(false),
    [commitHistory, setCommitHistory] = useState([]),
    [historyBusy, setHistoryBusy] = useState(false),
    [revertBusy, setRevertBusy] = useState(false),
    loadGeneration = useRef(0);
  useEffect(() => {
    billing.status().then((s) => setPlan(s.plan)).catch(() => {});
  }, []);
  const changes = useMemo(() => buildChangeSet(base, files), [base, files]);
  const selectedBinary = Boolean(files[selected] && typeof files[selected] === "object" && files[selected].__wydevBinary);
  const displayTimes = useMemo(() => {
    const out = {};
    for (const p of Object.keys(files)) out[p] = times[p] || loadedAt;
    return out;
  }, [files, times, loadedAt]);
  useEffect(() => {
    onWorkingState?.({ repo, branch, files, base, changes, openFile: setSelected, discard });
    saveState(key, { branch, files, fileIndex, base, baseSha, selected, times, loadedAt });
  }, [repo, branch, files, base, baseSha, selected, changes.length, times, loadedAt]);

  // Every discrete file/folder action (not raw keystrokes — CodeMirror already
  // has its own text-edit undo) records a snapshot here first, so the Undo
  // button can step it back and restore exactly what was there before.
  // Pro keeps the full session history; Free is capped so memory stays bounded.
  // "Last modified" times are tracked here too, in one place, so every action
  // that goes through applyFiles gets a timestamp for free: unchanged content
  // keeps its existing time, anything new or changed gets "now".
  const applyFiles = (next, label) => {
    setHistory((h) => [...(plan === "pro" ? h : h.slice(-19)), { label, snapshot: files, selectedBefore: selected, timesSnapshot: times }]);
    setTimes((t) => {
      const now = Date.now();
      const nt = {};
      for (const p of Object.keys(next)) nt[p] = files[p] !== undefined && files[p] === next[p] && t[p] ? t[p] : now;
      return nt;
    });
    setFiles(next);
  };
  const undo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setFiles(last.snapshot);
    setTimes(last.timesSnapshot || {});
    setSelected(last.selectedBefore);
    setHistory((h) => h.slice(0, -1));
    toastSuccess(`Undid: ${last.label}`);
  };

  const createBranch = async () => {
    const result = await promptDialog({
      title: "New branch",
      confirmLabel: "Create branch",
      fields: [{ key: "name", label: "Branch name", placeholder: "feature/my-change" }],
    });
    if (!result) return;
    const name = result.name.trim();
    if (!name) return;
    try {
      setBusy(true);
      await github.createBranch(repo.owner.login, repo.name, { name, from: branch });
      setBranch(name);
      toastSuccess(`Branch ${name} created`);
      await loadBranches();
    } catch (e) {
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const loadBranches = async () => {
    try {
      const b = await github.branches(repo.owner.login, repo.name);
      setBranches(b || []);
    } catch (e) {
      toastError(e.message);
    }
  };
  const load = async ({silent=false,retries=4} = {}) => {
    const generation = ++loadGeneration.current;
    try {
      setBusy(true);
      let lastError;
      let t;
      for(let attempt=0; attempt<=retries; attempt++){
        try {
          t = await github.tree(repo.owner.login, repo.name, branch);
          break;
        } catch(e) {
          lastError=e;
          // GitHub can take a moment to expose the branch immediately after
          // repository creation. Retry 404s instead of presenting a dead repo.
          if(e.status!==404 || attempt===retries) throw e;
          await new Promise(r=>setTimeout(r, 600*(attempt+1)));
        }
      }
      if (generation !== loadGeneration.current) return t;
      const index = (t.files || []).filter((x) => Number(x.size || 0) <= 10*1024*1024).map((x) => ({ path: x.path, sha: x.sha, size: x.size || 0 }));
      const empty = Object.fromEntries(index.map((x) => [x.path, null]));
      setFileIndex(index);
      setFiles(empty);
      setBase({ ...empty });
      setBaseSha(t.baseSha);
      setSelected("");
      setHistory([]);
      setTimes({});
      setLoadedAt(Date.now());
      if(!silent) toastSuccess(`Repository loaded · ${index.length} files ready`);
      return t;
    } catch (e) {
      if(!silent) toastError(e.message);
      throw e;
    } finally {
      if (generation === loadGeneration.current) setBusy(false);
    }
  };
  useEffect(() => {
    let cancelled=false;
    (async()=>{
      try { await loadBranches(); } catch {}
      if (!cancelled && (!Object.keys(files).length || !baseSha)) {
        try { await load(); } catch {}
      }
    })();
    return ()=>{cancelled=true};
  }, [repo.id, branch]);
  useEffect(() => {
    if (openPath) setSelected(openPath);
  }, [openPath]);
  useEffect(() => {
    if (!selected || files[selected] !== null && files[selected] !== undefined) return;
    let cancelled = false;
    setFileLoading(true);
    github.file(repo.owner.login, repo.name, selected, branch).then((f) => {
      if (cancelled) return;
      const content = f.content ?? "";
      setFiles((x) => ({ ...x, [selected]: content }));
      setBase((x) => ({ ...x, [selected]: content }));
    }).catch((e) => { if (!cancelled) { setSelected(""); toastError(e.message); } }).finally(() => { if (!cancelled) setFileLoading(false); });
    return () => { cancelled = true; };
  }, [selected, branch, repo]);
  // Used by the repo-wide AI diagnosis to pull in files that haven't been
  // opened (and therefore aren't cached in `files` yet) without disturbing
  // the normal lazy-load/edit state for the currently open file.
  const fetchFileContent = async (path) => {
    const f = await github.file(repo.owner.login, repo.name, path, branch);
    if (f.content && typeof f.content === "object" && f.content.__wydevBinary) return "";
    return f.content ?? "";
  };
  const edit = (v) => {
    if (!selected) return;
    setFiles((x) => ({ ...x, [selected]: v }));
    setTimes((t) => ({ ...t, [selected]: Date.now() }));
  };
  const commit = async (msg) => {
    setBusy(true);
    try {
      if(!changes.length){ toastInfo("There are no changes to commit."); return; }
      // Do not block a valid push just because GitHub moved after this
      // project was loaded. The server performs a safe three-way check using
      // the original file SHAs, then rebases these local changes on top of the
      // latest remote tree when the changed paths do not conflict. This is
      // important for ZIP uploads and for files added directly on GitHub.
      const sha = baseSha;
      // Upload file contents as Git blobs first. Keeping blob creation out of
      // the final commit request prevents large ZIP imports from exceeding the
      // Vercel request-body limit and makes failures retryable per file.
      const prepared = [];
      const queue = changes.filter(c => c.status !== "D");
      let cursor = 0;
      const worker = async () => {
        while (cursor < queue.length) {
          const i = cursor++;
          const c = queue[i];
          const binary = c.content && typeof c.content === "object" && c.content.__wydevBinary === true;
          const payload = binary
            ? { content: String(c.content.base64 || ""), encoding: "base64" }
            : { content: String(c.content ?? ""), encoding: "utf-8" };
          if (binary && !payload.content) throw new Error(`Binary file ${c.path} has no data.`);
          const b = await github.blob(repo.owner.login, repo.name, { path: c.path, ...payload });
          prepared[i] = { path: c.path, status: c.status, blobSha: b.sha };
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, Math.max(1, queue.length)) }, () => worker()));
      const commitChanges = [
        ...prepared.filter(Boolean),
        ...changes.filter(c => c.status === "D").map(c => ({ path: c.path, status: "D" }))
      ];
      const r = await github.commit(repo.owner.login, repo.name, {
        branch,
        message: msg,
        expectedSha: sha,
        baseFiles: fileIndex,
        changes: commitChanges
      });
      if (r.branch && r.branch !== branch) setBranch(r.branch);
      setBase({ ...files });
      setBaseSha(r.commitSha);
      setChangesOpen(false);
      toastSuccess(`Committed and pushed successfully · ${r.commitSha.slice(0, 7)}`);
      try { await load({silent:true,retries:2}); } catch {}
      localStorage.removeItem("wydev:project:" + repo.id);
    } catch (e) {
      // A missing branch is an actionable push error, not a remote-change
      // conflict. The server now repairs stale/missing branch refs when safe;
      // if GitHub still rejects it, show the real error instead of the generic
      // "REMOTE CHANGES DETECTED" sheet.
      if (e.code === "BRANCH_NOT_FOUND") {
        toastError(e.message || `Branch "${branch}" could not be found on GitHub.`);
      } else if (e.status === 409 || e.code === "REMOTE_CHANGED" || e.code === "REMOTE_CONFLICT" || e.code === "PUSH_RACE") {
        // Keep every local edit intact. Refresh only the remote metadata so the
        // conflict sheet can tell the user what happened without overwriting
        // their working tree.
        let remoteSha = e.details?.remoteSha || "";
        try {
          const remote = await github.tree(repo.owner.login, repo.name, branch);
          remoteSha = remote?.baseSha || remoteSha;
        } catch {}
        const conflicts = Array.isArray(e.details?.conflicts) ? e.details.conflicts : [];
        const conflictText = conflicts.length
          ? ` Conflicting files: ${conflicts.slice(0, 8).join(", ")}${conflicts.length > 8 ? "…" : ""}`
          : " Your local changes were kept.";
        setRemoteConflict({ message: `${e.message || "GitHub changed the remote branch while pushing."}${conflictText}`, remoteSha });
      } else toastError(e.message || "Commit failed. Your local changes were kept. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const createFile = async () => {
    const result = await promptDialog({
      title: "New file",
      confirmLabel: "Create file",
      fields: [{ key: "path", label: "File path", placeholder: "src/NewFile.js" }],
    });
    if (!result) return;
    const p = safeRepoPath(result.path);
    if (!p) return;
    applyFiles({ ...files, [p]: "" }, `Created ${p}`);
    setSelected(p);
    toastSuccess(`File ${p} created`);
  };
  useEffect(() => {
    if (!pendingShareText) return;
    let cancelled = false;
    (async () => {
      const result = await promptDialog({
        title: "Create file from shared content",
        message: "Content was shared to WyteLab from another app.",
        confirmLabel: "Create file",
        fields: [
          { key: "path", label: "File path", placeholder: "src/NewFile.js" },
          { key: "content", label: "Content", type: "textarea", defaultValue: pendingShareText },
        ],
      });
      if (cancelled) return;
      if (result) {
        const p = safeRepoPath(result.path);
        if (p) {
          applyFiles({ ...files, [p]: result.content || "" }, `Created ${p}`);
          setSelected(p);
          toastSuccess(`File ${p} created from shared content`);
        }
      }
      onConsumeShare?.();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShareText]);
  const createFolder = async () => {
    // Files that aren't inside any folder yet (no "/" in their path) — offered
    // as a pick-list so they can be dropped straight into the new folder.
    const looseFiles = Object.keys(files)
      .filter((p) => !p.includes("/"))
      .sort();
    const result = await promptDialog({
      title: "New folder",
      confirmLabel: "Create folder",
      fields: [
        { key: "path", label: "Folder path", placeholder: "src/components" },
        ...(looseFiles.length
          ? [
              {
                key: "moveFiles",
                type: "multiselect",
                label: "Add existing files to this folder",
                options: looseFiles.map((p) => ({ value: p, label: p })),
              },
            ]
          : []),
      ],
    });
    if (!result) return;
    const safe = result.path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!safe) return;
    const picked = result.moveFiles || [];
    const next = { ...files };
    if (!picked.length) next[`${safe}/.gitkeep`] = "";
    for (const p of picked) {
      const base = p.split("/").pop();
      next[`${safe}/${base}`] = next[p];
      delete next[p];
    }
    const movedLabel = picked.length ? ` with ${picked.length} file${picked.length === 1 ? "" : "s"} moved in` : "";
    applyFiles(next, `Created folder ${safe}${movedLabel}`);
    setSelected(picked.length ? `${safe}/${picked[0].split("/").pop()}` : `${safe}/.gitkeep`);
    toastSuccess(`Folder ${safe} created${movedLabel}`);
  };
  const deleteFolder = async () => {
    const allPaths = Object.keys(files).sort();
    if (!allPaths.length) {
      toastInfo("There's nothing to delete yet.");
      return;
    }
    // Every directory prefix that any file lives under, e.g. "src/pages/Foo.jsx"
    // contributes "src" and "src/pages" as pickable folder entries.
    const folderSet = new Set();
    allPaths.forEach((p) => {
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++) folderSet.add(parts.slice(0, i).join("/"));
    });
    const options = [
      ...[...folderSet].sort().map((p) => ({ value: `dir:${p}`, label: `📁 ${p}/` })),
      ...allPaths.map((p) => ({ value: `file:${p}`, label: p })),
    ];
    const result = await promptDialog({
      title: "Delete files & folders",
      confirmLabel: "Continue",
      fields: [{ key: "targets", type: "multiselect", label: "Select what to delete", options }],
    });
    if (!result) return;
    const targets = result.targets || [];
    if (!targets.length) return;
    const dirTargets = targets.filter((t) => t.startsWith("dir:")).map((t) => t.slice(4));
    const fileTargets = targets.filter((t) => t.startsWith("file:")).map((t) => t.slice(5));
    const toDelete = new Set(fileTargets);
    allPaths.forEach((p) => {
      if (dirTargets.some((d) => p === d || p.startsWith(`${d}/`))) toDelete.add(p);
    });
    if (!toDelete.size) return;
    const ok = await confirmDialog({
      title: "Delete files & folders",
      message: `Delete ${toDelete.size} file${toDelete.size === 1 ? "" : "s"}? This will be included in the next commit.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    applyFiles(
      Object.fromEntries(Object.entries(files).filter(([p]) => !toDelete.has(p))),
      `Deleted ${toDelete.size} file${toDelete.size === 1 ? "" : "s"}`
    );
    if (selected && toDelete.has(selected)) setSelected("");
    toastSuccess(`${toDelete.size} file${toDelete.size === 1 ? "" : "s"} deleted`);
  };
  const deleteSelected = async () => {
    if (!selected) return;
    const ok = await confirmDialog({
      title: "Delete file",
      message: `Delete ${selected}? This will be included in the next commit.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const n = { ...files };
    delete n[selected];
    applyFiles(n, `Deleted ${selected}`);
    setSelected("");
    toastSuccess("File deleted");
  };
  const duplicate = async () => {
    if (!selected) return;
    const result = await promptDialog({
      title: "Duplicate file",
      confirmLabel: "Duplicate",
      fields: [{ key: "path", label: "Duplicate as", defaultValue: `${selected}.copy` }],
    });
    if (!result) return;
    const p = safeRepoPath(result.path);
    if (!p) return;
    applyFiles({ ...files, [p]: files[selected] || "" }, `Duplicated ${selected}`);
    setSelected(p);
    toastSuccess(`Duplicated as ${p}`);
  };
  const move = async () => {
    if (!selected) return;
    const result = await promptDialog({
      title: "Rename / move file",
      confirmLabel: "Save",
      fields: [{ key: "path", label: "New path", defaultValue: selected }],
    });
    if (!result) return;
    const p = safeRepoPath(result.path);
    if (!p || p === selected) return;
    const dirOf = (x) => (x.includes("/") ? x.slice(0, x.lastIndexOf("/")) : "");
    const isRename = dirOf(p) === dirOf(selected);
    const n = { ...files, [p]: files[selected] || "" };
    delete n[selected];
    applyFiles(n, isRename ? `Renamed ${selected} to ${p}` : `Moved ${selected} to ${p}`);
    setSelected(p);
    toastSuccess(isRename ? `File renamed to ${p.split("/").pop()}` : `File moved to ${p}`);
  };
  const rename = async () => {
    const result = await promptDialog({
      title: "Rename folder",
      confirmLabel: "Preview rename",
      fields: [
        { key: "from", label: "Folder path", placeholder: "src/old-name" },
        { key: "to", label: "New folder path", placeholder: "src/new-name" },
      ],
    });
    if (!result) return;
    const from = result.from.trim(),
      to = result.to.trim();
    if (!from || !to) return;
    const next = renameFolder(files, from.replace(/\/$/, ""), to.replace(/\/$/, "")),
      refs = [];
    Object.entries(files).forEach(([p, text]) =>
      String(text)
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (p.startsWith(from + "/") || line.includes(from) || line.includes(`./${from}`) || line.includes(`../${from}`))
            refs.push({ path: p, line: i + 1, text: line.trim() });
        })
    );
    setRenamePreview({ from, to, refs, next });
  };
  const confirmRename = () => {
    applyFiles(renamePreview.next, `Renamed folder ${renamePreview.from} to ${renamePreview.to}`);
    setRenamePreview(null);
    toastSuccess(`Folder renamed to ${renamePreview.to}`);
  };
  const uploadFiles = async (eOrFiles) => {
    const picked = eOrFiles?.target?.files || eOrFiles;
    if (!picked?.length) return;
    setBusy(true);
    try {
      const next = { ...files };
      let added = 0,
        skippedBinary = 0;
      for (const f of picked) {
        if (isZipFile(f)) {
          const { files: entries } = await extractZipEntries(f);
          for (const entry of stripCommonRoot(entries)) {
            if (!entry.path || shouldSkipUpload(entry.path)) continue;
            next[entry.path] = entry.content;
            added++;
          }
        } else {
          if (shouldSkipUpload(f.name)) continue;
          const base = f.name.split("/").pop();
          // A same-named file already living in a folder should be updated in
          // place, not dropped as a new copy at the root — this is what makes
          // "upload a newer version" actually replace the old one when the
          // browser only gives us the bare filename (no folder path) for a
          // plain, non-zip file selection.
          const matches = Object.keys(next).filter((p) => p.split("/").pop() === base);
          const targetPath = matches.length === 1 ? matches[0] : safeRepoPath(f.name);
          if (matches.length > 1)
            toastInfo(`Multiple files named "${base}" exist — updated ${targetPath}. Use a ZIP for exact placement if that's the wrong one.`);
          next[targetPath] = await readUploadedFile(f, targetPath);
          added++;
        }
      }
      applyFiles(next, `Uploaded ${added} file${added === 1 ? "" : "s"}`);
      // Add newly uploaded paths to the visible index immediately. This keeps
      // local ZIP imports visible even while the remote repository is still
      // being refreshed.
      setFileIndex(prev => {
        const byPath=new Map(prev.map(x=>[x.path,x]));
        for(const path of Object.keys(next)){
          if(!byPath.has(path)) byPath.set(path,{path,sha:null,size:typeof next[path]==="string"?next[path].length:(next[path]?.size||0),local:true});
        }
        return [...byPath.values()];
      });
      toastSuccess(`${added} file${added === 1 ? "" : "s"} staged locally`);
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const selectAll = () => {
    if (!editorView) return;
    editorView.dispatch({ selection: { anchor: 0, head: editorView.state.doc.length } });
    editorView.focus();
  };
  const replaceEntire = async () => {
    if (!selected) return;
    try {
      const text = await navigator.clipboard.readText();
      setFiles((x) => ({ ...x, [selected]: text }));
      toastSuccess("File replaced from clipboard");
    } catch {
      toastError("Clipboard access was denied. Copy the replacement code and try again.");
    }
  };
  const discard = (path) => {
    const n = { ...files };
    if (path in base) n[path] = base[path];
    else delete n[path];
    applyFiles(n, `Discarded ${path}`);
    if (selected === path) setSelected("");
    toastInfo(`Discarded ${path}`);
  };
  const switchBranch = async (next) => {
    if (changes.length) {
      const ok = await confirmDialog({
        title: "Switch branch",
        message: "Switching branches can discard your current working state. Continue?",
        confirmLabel: "Switch",
        danger: true,
      });
      if (!ok) return;
    }
    setBranch(next);
    setFiles({});
    setBase({});
    setBaseSha("");
    setHistory([]);
    setTimes({});
    setLoadedAt(Date.now());
  };

  // Client-side only — packs the current working tree into a .zip using the
  // jszip dependency already bundled for uploads, so this costs nothing to run.
  const exportZip = async () => {
    try {
      // Most files sit in state as `null` placeholders until the user actually
      // opens them (lazy loading), and binary files are stored as
      // {__wydevBinary,base64,...} wrapper objects rather than raw bytes.
      // Zipping `files` directly was handing JSZip a pile of nulls and
      // wrapper objects — every entry came out empty or corrupted, which is
      // why the downloaded archive was empty. Fetch anything unloaded and
      // unwrap binary content before adding it to the archive.
      const paths = Object.keys(files);
      const resolved = await Promise.all(
        paths.map(async (path) => {
          const current = files[path];
          if (current !== null && current !== undefined) return [path, current];
          const f = await github.file(repo.owner.login, repo.name, path, branch);
          return [path, f.content ?? ""];
        })
      );
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      resolved.forEach(([path, content]) => {
        const binary = content && typeof content === "object" && content.__wydevBinary === true;
        if (binary) zip.file(path, content.base64 || "", { base64: true });
        else zip.file(path, String(content ?? ""));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const saved = await saveFile(blob, `${repo.name}-${branch}.zip`, "application/zip");
      if (saved) toastSuccess("Repository exported as ZIP");
    } catch (e) {
      toastError(e.message || "Export failed");
    }
  };

  // Lets a repo pick up a license after it already has commits (creating a
  // repo fresh can set one via GitHub's own license_template at init time —
  // see Repositories.jsx — but existing repos have no such hook). Fetches
  // GitHub's official template text, fills in the placeholders GitHub itself
  // would fill in at creation time, and stages it like any other file edit
  // so it goes through the normal review + commit flow rather than pushing
  // straight to GitHub.
  const addLicense = async () => {
    if (plan !== "pro") {
      toastError("Adding a license to an existing repository is a WyteLab Pro feature.");
      return;
    }
    const result = await promptDialog({
      title: "Add a license",
      confirmLabel: "Add LICENSE",
      fields: [
        {
          key: "license",
          label: "License",
          type: "select",
          required: false,
          defaultValue: "mit",
          options: LICENSES.filter((l) => l.key).map((l) => ({ value: l.key, label: l.name })),
        },
      ],
    });
    if (!result?.license) return;
    try {
      const tpl = await github.licenseTemplate(result.license);
      const text = fillLicensePlaceholders(tpl.body, {
        year: new Date().getFullYear(),
        fullname: repo.owner?.login || repo.full_name || "",
      });
      applyFiles({ ...files, LICENSE: text }, `Added ${tpl.name}`);
      toastSuccess(`${tpl.name} staged as LICENSE — commit to publish it`);
    } catch (e) {
      toastError(e.code === "PRO_REQUIRED" || e.status === 402 ? "Adding a license to an existing repository is a WyteLab Pro feature." : e.message || "Could not fetch that license template");
    }
  };

  const loadPRs = async () => {
    setPrOpen((o) => !o);
    if (prOpen) return;
    setPrBusy(true);
    try {
      setPrs(await github.pulls(repo.owner.login, repo.name));
    } catch (e) {
      toastError(e.message);
    } finally {
      setPrBusy(false);
    }
  };

  const newPullRequest = async () => {
    const result = await promptDialog({
      title: "New pull request",
      confirmLabel: "Create pull request",
      fields: [
        { key: "title", label: "Title", placeholder: "Summary of the change" },
        { key: "base", label: "Base branch", placeholder: repo.default_branch || "main", defaultValue: repo.default_branch || "main" },
        { key: "body", label: "Description (optional)", type: "textarea", required: false },
      ],
    });
    if (!result) return;
    if (result.base === branch) {
      toastError("Base branch must be different from the current branch");
      return;
    }
    setPrBusy(true);
    try {
      const pr = await github.createPull(repo.owner.login, repo.name, {
        title: result.title,
        head: branch,
        base: result.base,
        body: result.body,
      });
      setPrs((p) => [pr, ...p]);
      toastSuccess(`Pull request #${pr.number} opened`);
    } catch (e) {
      toastError(e.message);
    } finally {
      setPrBusy(false);
    }
  };

  const loadCommitHistory = async () => {
    setHistoryOpen((o) => !o);
    if (historyOpen) return;
    setHistoryBusy(true);
    try {
      const r = await github.commits(repo.owner.login, repo.name, branch, 10);
      setCommitHistory(r.commits || []);
    } catch (e) {
      toastError(e.message);
    } finally {
      setHistoryBusy(false);
    }
  };

  // Restoring an earlier commit deletes the current tip's state (including
  // any local, uncommitted edits) and brings back exactly what the picked
  // commit looked like, published as one new commit on top. Nothing is
  // force-pushed and no history is rewritten, but the outcome is still
  // destructive to whatever isn't in that commit, so this always confirms
  // with a clear explanation before it touches anything.
  const revertToCommit = async (c) => {
    const localNote = changes.length
      ? ` This will also discard your ${changes.length} current uncommitted local change${changes.length === 1 ? "" : "s"}.`
      : "";
    const ok = await confirmDialog({
      title: "Revert to this commit",
      message: `The current state of "${branch}" will be deleted and replaced with the repository exactly as it was at commit ${c.sha.slice(0, 7)} ("${(c.message || "").split("\n")[0]}"). A new commit recording this revert will be pushed to GitHub.${localNote} This cannot be undone from WyteLab. Continue?`,
      confirmLabel: "Continue",
      danger: true,
    });
    if (!ok) return;
    setRevertBusy(true);
    setBusy(true);
    try {
      const r = await github.revert(repo.owner.login, repo.name, { branch, sha: c.sha });
      toastSuccess(`Reverted to ${c.sha.slice(0, 7)} · new commit ${r.commitSha.slice(0, 7)}`);
      setHistoryOpen(false);
      setChangesOpen(false);
      localStorage.removeItem("wydev:project:" + repo.id);
      await load({ silent: true, retries: 2 });
    } catch (e) {
      if (e.code === "BRANCH_NOT_FOUND") toastError(e.message || `Branch "${branch}" could not be found.`);
      else if (e.status === 409 || e.code === "PUSH_RACE") toastError(e.message || "GitHub changed the branch while reverting. Reload and try again.");
      else toastError(e.message || "Revert failed.");
    } finally {
      setRevertBusy(false);
      setBusy(false);
    }
  };

  const deleteRepository = async () => {
    if (plan !== "pro") {
      toastError("Delete repository is a WyteLab Pro feature.");
      return;
    }
    const confirmation = await promptDialog({
      title: "Delete repository",
      message: `This permanently deletes ${repo.full_name} from GitHub. This cannot be undone. Type the exact repository name to continue.`,
      confirmLabel: "Delete permanently",
      cancelLabel: "Keep repository",
      danger: true,
      fields: [
        { key: "repoName", label: "Repository name", placeholder: repo.full_name },
      ],
    });
    if (!confirmation) return;
    if (String(confirmation.repoName || "").trim() !== String(repo.full_name || "").trim()) {
      toastError("Repository name does not match. Nothing was deleted.");
      return;
    }
    const confirmed = await confirmDialog({
      title: "Final confirmation",
      message: `Delete ${repo.full_name}? GitHub will permanently remove the repository and its history.`,
      confirmLabel: "Yes, delete it",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await github.deleteRepo(repo.owner?.login || repo.owner?.name || repo.full_name.split("/")[0], repo.name);
      localStorage.removeItem(`wydev:project:${repo.id}`);
      localStorage.removeItem(`project:${repo.id}`);
      try {
        const recent = loadState("recentProjects", []);
        saveState("recentProjects", recent.filter((x) => String(x.id) !== String(repo.id)));
      } catch {}
      toastSuccess(`${repo.full_name} was deleted successfully`);
      onDeleteRepo?.(repo);
      onBack?.();
    } catch (e) {
      if (e.status === 401) toastError("GitHub authentication expired. Sign in again before deleting the repository.");
      else if (e.status === 403) toastError(e.code === "PRO_REQUIRED" ? "Delete repository is a WyteLab Pro feature." : "GitHub denied repository deletion. Re-authorize WyteLab with repository deletion permission or check your GitHub permissions.");
      else if (e.status === 404) toastError("GitHub could not find this repository. It may already have been deleted.");
      else if (e.status === 409) toastError("GitHub could not delete this repository because it is currently in a conflicting state. Check GitHub and try again.");
      else if (e.status === 422) toastError("GitHub rejected the deletion request. Check your repository permissions and try again.");
      else if (e.code === "GITHUB_DELETE_SCOPE_MISSING") toastError("WyteLab does not have GitHub's delete permission. Sign out and authorize WyteLab again, then retry.");
      else toastError(e.message || "Repository deletion failed. Nothing was changed by WyteLab.");
    } finally {
      setBusy(false);
    }
  };

  const shareRepo = async () => {
    const ok = await nativeShareText(`${repo.full_name} on GitHub — ${repo.html_url}`);
    if (!ok) {
      await copy(repo.html_url);
      toastSuccess("Repository link copied");
    }
  };

  return (
    <div className="project">
      <header className="projectHeader">
        <button onClick={onBack}>‹</button>
        <div>
          <b>{repo.full_name}</b>
          <small>
            {branch} · {changes.length} local changes {busy && <Loader2 size={12} className="spin" />}
          </small>
        </div>
        <Select
          value={branch}
          onChange={switchBranch}
          options={(branches.length ? branches : [{ name: branch }]).map((b) => ({ value: b.name, label: b.name }))}
          className="branchSelect"
        />
        <button onClick={createBranch} disabled={busy}>
          <GitBranch size={16} />
          New branch
        </button>
        <button onClick={load} disabled={busy}>
          <RefreshCw size={16} />
        </button>
        <a href={`https://${vercelDomain(repo.name)}`} onClick={(e) => { e.preventDefault(); openExternal(`https://${vercelDomain(repo.name)}`); }} rel="noreferrer" title="Open this repository's Vercel deployment">
          <ExternalLink size={17} /> Vercel
        </a>
        <a href={repo.html_url} onClick={(e) => { e.preventDefault(); openExternal(repo.html_url); }} rel="noreferrer" title="Open on GitHub">
          <ExternalLink size={17} /> GitHub
        </a>
        <button onClick={shareRepo} title="Share this repository">
          <Share2 size={16} />
        </button>
      </header>
      <div className="projectTools">
        <AIDiagnostics repo={repo} branch={branch} fileIndex={fileIndex} files={files} fetchFileContent={fetchFileContent} />
        <button onClick={undo} disabled={!history.length} title={history.length ? `Undo: ${history[history.length - 1].label}` : "Nothing to undo"}>
          <Undo2 size={16} />
          Undo
        </button>
        <button onClick={createFile}>
          <FilePlus size={16} />
          New file
        </button>
        <button onClick={createFolder}>
          <FolderPlus size={16} />
          New folder
        </button>
        <button onClick={rename}>
          <FolderPlus size={16} />
          Rename folder
        </button>
        <button className="toolButton" onClick={() => setUploadPickerOpen(true)}>
          <Upload size={16} />
          Upload files
        </button>
        <button disabled={!selected || selectedBinary} onClick={() => copy(String(files[selected] || ""))}>
          <Copy size={16} />
          Copy all
        </button>
        <button disabled={!selected || selectedBinary} onClick={selectAll}>
          Select all code
        </button>
        <button disabled={!selected || selectedBinary} onClick={replaceEntire}>
          Replace from clipboard
        </button>
        <button disabled={!selected || selectedBinary} onClick={duplicate}>
          <Copy size={16} />
          Duplicate
        </button>
        <button disabled={!selected} onClick={move}>
          <Move size={16} />
          Rename / Move
        </button>
        <button disabled={!selected} onClick={deleteSelected}>
          <Trash2 size={16} />
          Delete file
        </button>
        <button onClick={deleteFolder}>
          <Trash2 size={16} />
          Delete files
        </button>
        <button onClick={exportZip}>
          <Upload size={16} />
          Export ZIP
        </button>
        <button onClick={addLicense} title={plan === "pro" ? "Add a GitHub license template to this repository" : "Adding a license to an existing repository requires WyteLab Pro"}>
          <FileText size={16} />
          Add license{plan !== "pro" ? " (Pro)" : ""}
        </button>
        <button onClick={loadPRs}>
          <GitBranch size={16} />
          Pull Requests
        </button>
        <button className="danger" onClick={deleteRepository} disabled={busy} title={plan === "pro" ? "Permanently delete this GitHub repository" : "Delete repository requires WyteLab Pro"}>
          <Trash2 size={16} />
          Delete repository{plan !== "pro" ? " (Pro)" : ""}
        </button>
        <button onClick={loadCommitHistory} disabled={revertBusy}>
          <History size={16} />
          Revert{plan !== "pro" ? " (Pro)" : ""}
        </button>
      </div>
      {historyOpen && (
        <div className="changesDropdown">
          <div className="changesList">
            {historyBusy ? (
              <p className="muted">Loading commit history…</p>
            ) : commitHistory.length ? (
              commitHistory.map((c) => (
                <div className="change" key={c.sha}>
                  <div>
                    <b>{c.sha.slice(0, 7)}</b>
                    <span> {(c.message || "").split("\n")[0]}</span>
                    <div className="muted">{c.author}{c.date ? ` · ${new Date(c.date).toLocaleString()}` : ""}</div>
                  </div>
                  <button disabled={revertBusy} onClick={() => revertToCommit(c)}>
                    {revertBusy ? "Reverting…" : "Revert to this"}
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">No commit history found for this branch.</p>
            )}
          </div>
        </div>
      )}
      {prOpen && (
        <div className="changesDropdown">
          <div className="changesList">
            <button onClick={newPullRequest} disabled={prBusy}>
              {prBusy ? "Working…" : "New pull request"}
            </button>
            {prs.length ? (
              prs.map((pr) => (
                <div className="change" key={pr.id}>
                  <a href={pr.html_url} onClick={(e) => { e.preventDefault(); openExternal(pr.html_url); }} rel="noreferrer">
                    <b>#{pr.number}</b>
                    <span>{pr.title} · {pr.state}</span>
                  </a>
                </div>
              ))
            ) : (
              <p className="muted">No pull requests yet.</p>
            )}
          </div>
        </div>
      )}
      {remoteConflict && (
        <div className="sheet conflictSheet">
          <h3>REMOTE CHANGES DETECTED</h3>
          <p>{remoteConflict.message}</p>
          <p className="muted">Your local changes are still here. Review the latest branch on GitHub before deciding how to continue.</p>
          <div className="sheetActions">
            <button onClick={() => setRemoteConflict(null)}>Keep editing</button>
            <a className="button" href={repo.html_url} onClick={(e) => { e.preventDefault(); openExternal(repo.html_url); }} rel="noreferrer">Review on GitHub</a>
            <button onClick={() => { setRemoteConflict(null); load(); }}>Reload repository</button>
          </div>
        </div>
      )}
      {changes.length > 0 && (
        <div className="changesDropdown">
          <button className="changesToggle" onClick={() => setChangesOpen((o) => !o)}>
            <span>
              {changes.length} local change{changes.length === 1 ? "" : "s"}
            </span>
            <ChevronDown size={16} className={changesOpen ? "rot" : ""} />
          </button>
          {changesOpen && (
            <div className="changesList">
              {changes.map((c) => (
                <div className="change" key={c.path}>
                  <button
                    onClick={() => {
                      setSelected(c.path);
                      setChangesOpen(false);
                    }}
                  >
                    <b>{c.status}</b>
                    <span>{c.path}</span>
                  </button>
                  <button onClick={() => discard(c.path)}>Discard</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={`projectBody${selected && selected in files ? " hasSelection" : ""}`}>
        <aside>
          <FileExplorer files={files} times={displayTimes} onOpen={setSelected} />
        </aside>
        <main>
          {selected && files[selected] !== null && files[selected] !== undefined ? (
            <FileViewer path={selected} value={files[selected]} onChange={edit} onViewReady={setEditorView} unsaved={changes.some((c) => c.path === selected)} onBack={() => setSelected("")} fontSize={editorFontSize} wordWrap={editorWordWrap} />
          ) : (
            <div className="empty">
              {fileLoading ? <><h2>Loading file…</h2><p>Fetching only the selected file from GitHub.</p></> : <><h2>Select a file</h2><p>Choose a file from the repository tree.</p></>}
            </div>
          )}
        </main>
      </div>
      <CommitPanel count={changes.length} onCommit={commit} busy={busy} />
      {renamePreview && (
        <div className="sheet">
          <h3>RENAME FOLDER</h3>
          <p>
            <b>{renamePreview.from}</b> → <b>{renamePreview.to}</b>
          </p>
          <p>{renamePreview.refs.length} affected/reference matches found. Code references are not rewritten automatically.</p>
          {renamePreview.refs.slice(0, 12).map((x) => (
            <div className="ref" key={`${x.path}:${x.line}`}>
              {x.path}:{x.line} — {x.text}
            </div>
          ))}
          <div className="sheetActions">
            <button onClick={() => setRenamePreview(null)}>Cancel</button>
            <button className="primary" onClick={confirmRename}>
              Confirm rename
            </button>
          </div>
        </div>
      )}
      <UploadPicker open={uploadPickerOpen} onClose={() => setUploadPickerOpen(false)} onFiles={async (files) => { setUploadPickerOpen(false); await uploadFiles(files); }} />
    </div>
  );
}


function FileViewer({ path, value, onChange, onViewReady, unsaved=false, onBack, fontSize, wordWrap }) {
  const binary = value && typeof value === "object" && value.__wydevBinary;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [path]);
  if (binary) {
    const canPreview = !binary.tooLarge && Number(binary.size || 0) <= 1024 * 1024 && Boolean(binary.base64);
    const src = canPreview ? `data:${binary.mime || "application/octet-stream"};base64,${binary.base64}` : "";
    const image = canPreview && /^image\//i.test(binary.mime || "") && !/\.svgz?$/i.test(path);
    const openUrl = binary.html_url || "";
    const downloadOriginal = async () => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        await saveFile(blob, path.split("/").pop() || "download", binary.mime);
      } catch (e) {
        toastError(e.message || "Download failed");
      }
    };
    return <div className="fileViewer">
      <div className="fileTitle"><button className="fileBack" aria-label="Back to files" onClick={onBack}>‹</button><b>{path}</b></div>
      <div className="binaryViewer">
        {image && !failed ? <img src={src} alt={path} onError={() => setFailed(true)} /> : <FileText size={42} />}
        {!canPreview && <p className="muted">This file is kept out of the in-app preview to protect mobile memory. Open it on GitHub instead.</p>}
        {failed && <p className="muted">This image could not be previewed safely.</p>}
        {canPreview ? (
          <button className="primary" onClick={downloadOriginal}><Download size={16}/> Download original</button>
        ) : openUrl ? (
          <a className="primary" href={openUrl} onClick={(e) => { e.preventDefault(); openExternal(openUrl); }} rel="noreferrer"><ExternalLink size={16}/> Open on GitHub</a>
        ) : null}
      </div>
    </div>;
  }
  return <><div className="fileTitle"><button className="fileBack" aria-label="Back to files" onClick={onBack}>‹</button><b>{path}</b>{unsaved && <span> • Unsaved</span>}</div><CodeEditor path={path} value={String(value ?? "")} onChange={onChange} onViewReady={onViewReady} fontSize={fontSize} wordWrap={wordWrap} /></>;
}
