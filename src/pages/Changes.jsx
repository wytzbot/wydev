export default function Changes({ repo, changes = [], onSelect, onDiscard, onResume }) {
  const added = changes.filter(c => c.status === "A").length;
  const modified = changes.filter(c => c.status === "M").length;
  const deleted = changes.filter(c => c.status === "D").length;

  return (
    <div className="page">
      <header>
        <div>
          <span className="eyebrow">WORKING STATE</span>
          <h1>Changes</h1>
          <p className="muted">{repo ? `Local edits for ${repo.full_name || repo.name}` : "Your saved workspace changes"}</p>
        </div>
        <span className="muted">{changes.length} file{changes.length === 1 ? "" : "s"}</span>
      </header>

      {changes.length ? (
        <>
          <section className="panel">
            <div className="row"><h3>LOCAL CHANGES</h3><button className="secondary" onClick={onResume}>Continue editing</button></div>
            <p className="muted">{added} added · {modified} modified · {deleted} deleted</p>
            {changes.map(c => (
              <div className="change" key={c.path}>
                <button onClick={() => onSelect?.(c.path)}><span><b>{c.status}</b> {c.path}</span></button>
                <button className="secondary" onClick={() => onDiscard?.(c.path)}>Discard</button>
              </div>
            ))}
          </section>
          <section className="panel">
            <h3>SAFE WORKING STATE</h3>
            <p className="muted">WyteLab keeps these edits saved locally until you commit and push them to GitHub. You can leave this screen and return without losing your work.</p>
          </section>
        </>
      ) : (
        <section className="panel">
          <h3>NOTHING TO COMMIT YET</h3>
          <p className="muted">Edit a file, create a file or folder, upload files, or make another workspace change. Your uncommitted edits will appear here automatically.</p>
          {repo && <button className="primary" onClick={onResume}>Continue editing {repo.name || "repository"}</button>}
        </section>
      )}
    </div>
  );
}
