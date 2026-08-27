import { useEffect, useMemo, useState } from "react";
import { Copy, FilePlus, FolderPlus, ExternalLink, Upload, Trash2, Move, GitBranch, RefreshCw } from "lucide-react";
import CodeEditor from "../components/CodeEditor";
import FileExplorer from "../components/FileExplorer";
import CommitPanel from "../components/CommitPanel";
import AIDiagnostics from "../components/AIDiagnostics";
import { github } from "../github";
import { buildChangeSet, renameFolder } from "../git";
import { copy } from "../utils";
import { loadState, saveState } from "../storage";
import { shouldSkipUpload, readFileText, isZipFile, extractZipEntries, stripCommonRoot, safeRepoPath } from "../files";
import { promptDialog, confirmDialog } from "../dialog";

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
    [notice, setNotice] = useState(cached?.notice || ""),
    [renamePreview, setRenamePreview] = useState(null),
    [editorView, setEditorView] = useState(null);
  const changes = useMemo(() => buildChangeSet(base, files), [base, files]);
  useEffect(() => {
    onWorkingState?.({ repo, branch, files, base, changes, openFile: setSelected });
    saveState(key, { branch, files, base, baseSha, selected, notice });
  }, [repo, branch, files, base, baseSha, selected, notice, changes.length]);

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
      setNotice(`Branch ${name} created`);
      await loadBranches();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const loadBranches = async () => {
    try {
      const b = await github.branches(repo.owner.login, repo.name);
      setBranches(b || []);
    } catch (e) {
      setNotice(e.message);
    }
  };
  const load = async () => {
    try {
      setBusy(true);
      setNotice("Checking GitHub…");
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
      setNotice("Repository loaded");
    } catch (e) {
      setNotice(e.message);
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
    setNotice("Checking GitHub…");
    try {
      const r = await github.commit(repo.owner.login, repo.name, { branch, message: msg, expectedSha: baseSha, changes });
      setBase({ ...files });
      setBaseSha(r.commitSha);
      setNotice(`Pushed successfully · ${r.commitSha.slice(0, 7)}`);
      localStorage.removeItem("wydev:project:" + repo.id);
    } catch (e) {
      setNotice(e.message);
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
    setFiles((x) => ({ ...x, [p]: "" }));
    setSelected(p);
    setNotice("File added locally");
  };
  const createFolder = async () => {
    const result = await promptDialog({
      title: "New folder",
      confirmLabel: "Create folder",
      fields: [{ key: "path", label: "Folder path", placeholder: "src/components" }],
    });
    if (!result) return;
    const safe = result.path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!safe) return;
    setFiles((x) => ({ ...x, [`${safe}/.gitkeep`]: "" }));
    setSelected(`${safe}/.gitkeep`);
    setNotice("Folder staged locally with .gitkeep");
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
    setFiles((x) => Object.fromEntries(Object.entries(x).filter(([p]) => !p.startsWith(prefix))));
    setSelected("");
    setNotice(`Deleted folder ${from} locally`);
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
    setFiles((x) => {
      const n = { ...x };
      delete n[selected];
      return n;
    });
    setSelected("");
    setNotice("Deleted locally");
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
    setFiles((x) => ({ ...x, [p]: x[selected] || "" }));
    setSelected(p);
    setNotice("Duplicated locally");
  };
  const move = async () => {
    if (!selected) return;
    const result = await promptDialog({
      title: "Move file",
      confirmLabel: "Move",
      fields: [{ key: "path", label: "Move to path", defaultValue: selected }],
    });
    if (!result) return;
    const p = safeRepoPath(result.path);
    if (!p || p === selected) return;
    setFiles((x) => {
      const n = { ...x, [p]: x[selected] || "" };
      delete n[selected];
      return n;
    });
    setSelected(p);
    setNotice("Moved locally");
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
    setFiles(renamePreview.next);
    setRenamePreview(null);
    setNotice("Folder renamed locally");
  };
  const uploadFiles = async (e) => {
    const input = e.target;
    if (!input.files?.length) return;
    setBusy(true);
    setNotice("Reading files…");
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
      setFiles(next);
      setNotice(skippedBinary ? `${added} file${added === 1 ? "" : "s"} staged locally · ${skippedBinary} binary file${skippedBinary === 1 ? "" : "s"} skipped` : `${added} file${added === 1 ? "" : "s"} staged locally`);
    } catch (err) {
      setNotice(err.message);
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
      setNotice("File replaced from clipboard");
    } catch {
      setNotice("Clipboard access was denied. Copy the replacement code and try again.");
    }
  };
  const discard = (path) => {
    setFiles((x) => {
      const n = { ...x };
      if (path in base) n[path] = base[path];
      else delete n[path];
      return n;
    });
    if (selected === path) setSelected("");
    setNotice(`Discarded ${path}`);
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
  };

  return (
    <div className="project">
      <header className="projectHeader">
        <button onClick={onBack}>‹</button>
        <div>
          <b>{repo.full_name}</b>
          <small>{branch} · {changes.length} local changes</small>
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
          Rename
        </button>
        <label className="toolButton">
          <Upload size={16} />
          Upload file
          <input hidden type="file" accept=".zip,*" multiple onChange={uploadFiles} />
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
          Move
        </button>
        <button disabled={!selected} onClick={deleteSelected}>
          <Trash2 size={16} />
          Delete file
        </button>
        <button onClick={deleteFolder}>
          <Trash2 size={16} />
          Delete folder
        </button>
      </div>
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
      <div className="status">{notice}</div>
      {changes.length > 0 && (
        <section className="panel localChanges">
          <h3>LOCAL CHANGES</h3>
          {changes.map((c) => (
            <div className="change" key={c.path}>
              <button onClick={() => setSelected(c.path)}>
                <b>{c.status}</b>
                <span>{c.path}</span>
              </button>
              <button onClick={() => discard(c.path)}>Discard</button>
            </div>
          ))}
        </section>
      )}
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
