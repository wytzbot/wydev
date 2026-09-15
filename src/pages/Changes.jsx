import ChangesPanel from "../components/ChangesPanel";

export default function Changes({ changes = [], onSelect, onDiscard }) {
  return (
    <div className="page">
      <header>
        <div><span className="eyebrow">WORKING STATE</span><h1>Changes</h1></div>
        <span className="muted">{changes.length} file{changes.length === 1 ? "" : "s"}</span>
      </header>
      <ChangesPanel changes={changes} onSelect={onSelect} />
      {changes.length > 0 && (
        <section className="panel">
          <h3>DISCARD CHANGES</h3>
          {changes.map((c) => (
            <div className="change" key={c.path}>
              <span><b>{c.status}</b> {c.path}</span>
              <button type="button" onClick={() => onDiscard?.(c.path)} disabled={!onDiscard}>Discard</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
