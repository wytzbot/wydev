import { useEffect, useMemo, useState } from "react";
import { Copy, FilePlus, FolderPlus, ExternalLink, Upload, Trash2, Move, GitBranch, RefreshCw, ChevronDown, Loader2, Undo2 } from "lucide-react";
import CodeEditor from "../components/CodeEditor";
import FileExplorer from "../components/FileExplorer";
import CommitPanel from "../components/CommitPanel";
import AIDiagnostics from "../components/AIDiagnostics";
import { github } from "../github";
import { billing } from "../billing";
import { buildChangeSet, renameFolder } from "../git";
import { copy } from "../utils";
import { loadState, saveState } from "../storage";
import { shouldSkipUpload, readFileText, isZipFile, extractZipEntries, stripCommonRoot, safeRepoPath } from "../files";
import { promptDialog, confirmDialog } from "../dialog";
import { toastSuccess, toastError, toastInfo } from "../toast";

export default function Project({ repo, onBack, onWorkingState, openPath }) {
  const key = `project:${repo.id}`;
  const cached = loadState(key, null);
  const [branch, setBranch] = useState(cached?.branch || repo.default_branch || "main"),
    [branches, setBranches] = useState([]),
    [files, setFiles] = useState(cached?.files || {}),
    [base, setBase] = useState(cached?.base || {}),
    [baseSha, setBaseSha] = useState(cached?.baseSha || ""),
    [selected, setSelected] = useState(cached?.selected || ""),
    [busy, setBusy] = useState(false),
    [changesOpen, setChangesOpen] = useState(false),
    [history, setHistory] = useState([]),
    [renamePreview, setRenamePreview] = useState(null),
    [editorView, setEditorView] = useState(null),
    [plan, setPlan] = useState("free"),
    [prs, setPrs] = useState([]),
    [prOpen, setPrOpen] = useState(false),
    [prBusy, setPrBusy] = useState(false);
  useEffect(() => {
    billing.status().then((s) => setPlan(s.plan)).catch(() => {});
  }, []);
  const changes = useMemo(() => buildChangeSet(base, files), [base, files]);
  useEffect(() => {
    onWorkingState?.({ repo, branch, files, base, changes, openFile: setSelected });
    saveState(key, { branch, files, base, baseSha, selected });
  }, [repo, branch, files, base, baseSha, selected, changes.length]);

  // Every discrete file/folder action (not raw keystrokes — CodeMirror already
  // has its own text-edit undo) records a snapshot here first, so the Undo
  // button can step it back and restore exactly what was there before.
  // Pro keeps the full session history; Free is capped so memory stays bounded.
  const applyFiles = (next, label) => {
    setHistory((h) => [...(plan === "pro" ? h : h.slice(-19)), { label, snapshot: files, selectedBefore: selected }]);
    setFiles(next);
  };
  const undo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setFiles(last.snapshot);
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
  const load = async () => {
    try {
      setBusy(true);
      const t = await github.tree(repo.owner.login, repo.name, branch);
      const map = {};
      for (const x of t.files || [])
        if (x.size < 500000) {
          try {
            const f = await github.file(repo.owner.login, repo.name, x.path, branch);
            map[x.path] = f.content || "";
          } catch {}
        }
      setFiles(map);
      setBase({ ...map });
      setBaseSha(t.baseSha);
      setHistory([]);
      toastSuccess("Repository loaded");
    } catch (e) {
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    loadBranches();
    if (!Object.keys(files).length || !baseSha) load();
  }, [repo, branch]);
  useEffect(() => {
    if (openPath) setSelected(openPath);
  }, [openPath]);
  const edit = (v) => setFiles((x) => ({ ...x, [selected]: v }));
  const commit = async (msg) => {
    setBusy(true);
    try {
      const r = await github.commit(repo.owner.login, repo.name, { branch, message: msg, expectedSha: baseSha, changes });
      setBase({ ...files });
      setBaseSha(r.commitSha);
      setChangesOpen(false);
      toastSuccess(`Committed and pushed successfully · ${r.commitSha.slice(0, 7)}`);
      localStorage.removeItem("wydev:project:" + repo.id);
    } catch (e) {
      toastError(e.message || "Commit failed. Pull the latest changes and try again.");
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
    const result = await promptDialog({
      title: "Delete folder",
      confirmLabel: "Continue",
      fields: [{ key: "path", label: "Folder path to delete", placeholder: "src/old-feature" }],
    });
    if (!result) return;
    const from = result.path.trim();
    if (!from) return;
    const prefix = from.replace(/\/$/, "") + "/";
    const ok = await confirmDialog({
      title: "Delete folder",
      message: `Delete all files under ${from}? This will be included in the next commit.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    applyFiles(Object.fromEntries(Object.entries(files).filter(([p]) => !p.startsWith(prefix))), `Deleted folder ${from}`);
    setSelected("");
    toastSuccess(`Folder ${from} deleted`);
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
  const uploadFiles = async (e) => {
    const input = e.target;
    if (!input.files?.length) return;
    setBusy(true);
    try {
      const next = { ...files };
      let added = 0,
        skippedBinary = 0;
      for (const f of input.files) {
        if (isZipFile(f)) {
          const { files: entries, skippedBinary: skipped } = await extractZipEntries(f);
          for (const entry of stripCommonRoot(entries)) {
            if (!entry.path || shouldSkipUpload(entry.path)) continue;
            next[entry.path] = entry.content;
            added++;
          }
          skippedBinary += skipped.length;
        } else {
          if (shouldSkipUpload(f.name)) continue;
          next[safeRepoPath(f.name)] = await readFileText(f);
          added++;
        }
      }
      applyFiles(next, `Uploaded ${added} file${added === 1 ? "" : "s"}`);
      toastSuccess(skippedBinary ? `${added} file${added === 1 ? "" : "s"} staged locally · ${skippedBinary} binary file${skippedBinary === 1 ? "" : "s"} skipped` : `${added} file${added === 1 ? "" : "s"} staged locally`);
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
      input.value = "";
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
  const switchBranch = async (e) => {
    const next = e.target.value;
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
  };

  // Client-side only — packs the current working tree into a .zip using the
  // jszip dependency already bundled for uploads, so this costs nothing to run.
  const exportZip = async () => {
    if (plan !== "pro") {
      toastError("Exporting a ZIP backup is a WyDev Pro feature. Upgrade to unlock it.");
      return;
    }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => zip.file(path, content));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${repo.name}-${branch}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toastSuccess("Repository exported as ZIP");
    } catch (e) {
      toastError(e.message || "Export failed");
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
        <span className="select">
          <select value={branch} onChange={switchBranch}>
            {(branches.length ? branches : [{ name: branch }]).map((b) => (
              <option key={b.name}>{b.name}</option>
            ))}
          </select>
        </span>
        <button onClick={createBranch} disabled={busy}>
          <GitBranch size={16} />
          New branch
        </button>
        <button onClick={load} disabled={busy}>
          <RefreshCw size={16} />
        </button>
        <a href={repo.html_url} target="_blank" rel="noreferrer">
          <ExternalLink size={17} />
        </a>
      </header>
      <div className="projectTools">
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
        <label className="toolButton">
          <Upload size={16} />
          Upload file
          <input hidden type="file" multiple onChange={uploadFiles} />
        </label>
        <button disabled={!selected} onClick={() => copy(files[selected] || "")}>
          <Copy size={16} />
          Copy all
        </button>
        <button disabled={!selected} onClick={selectAll}>
          Select all code
        </button>
        <button disabled={!selected} onClick={replaceEntire}>
          Replace from clipboard
        </button>
        <button disabled={!selected} onClick={duplicate}>
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
          Delete folder
        </button>
        <button onClick={exportZip}>
          <Upload size={16} />
          Export ZIP{plan !== "pro" ? " (Pro)" : ""}
        </button>
        <button onClick={loadPRs}>
          <GitBranch size={16} />
          Pull Requests{plan !== "pro" ? " (Pro)" : ""}
        </button>
      </div>
      {prOpen && (
        <div className="changesDropdown">
          <div className="changesList">
            <button onClick={newPullRequest} disabled={prBusy}>
              {prBusy ? "Working…" : "New pull request"}
            </button>
            {prs.length ? (
              prs.map((pr) => (
                <div className="change" key={pr.id}>
                  <a href={pr.html_url} target="_blank" rel="noreferrer">
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
          <FileExplorer files={files} onOpen={setSelected} />
        </aside>
        <main>
          {selected && selected in files ? (
            <>
              <div className="fileTitle">
                <button className="fileBack" aria-label="Back to files" onClick={() => setSelected("")}>‹</button>
                {selected}
                <span>{changes.some((c) => c.path === selected) ? " • Unsaved" : ""}</span>
              </div>
              <CodeEditor path={selected} value={files[selected]} onChange={edit} onViewReady={setEditorView} />
              <div className="aiDock">
                <AIDiagnostics file={selected} content={files[selected]} />
              </div>
            </>
          ) : (
            <div className="empty">
              <h2>Select a file</h2>
              <p>Choose a file from the repository tree.</p>
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
    </div>
  );
}
