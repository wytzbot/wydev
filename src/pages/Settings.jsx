import { useState } from "react";
import { loadState, saveState } from "../storage";
import { confirmDialog } from "../dialog";

export default function Settings() {
  const [font, setFont] = useState(loadState("fontSize", 16));
  const [wrap, setWrap] = useState(loadState("wordWrap", true));
  const [motion, setMotion] = useState(loadState("reducedMotion", false));
  const [density, setDensity] = useState(loadState("density", "comfortable"));
  const update = (k, v) => {
    saveState(k, v);
    if (k === "fontSize") {
      setFont(v);
      document.documentElement.style.setProperty("--ui-font", v + "px");
    }
    if (k === "wordWrap") setWrap(v);
    if (k === "reducedMotion") setMotion(v);
    if (k === "density") setDensity(v);
  };
  const clearWorkingData = async () => {
    const ok = await confirmDialog({
      title: "Clear local working data",
      message: "Delete WyDev local working states? Unsaved changes will be lost.",
      confirmLabel: "Clear data",
      danger: true,
    });
    if (!ok) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("wydev:project:"))
      .forEach((k) => localStorage.removeItem(k));
    location.reload();
  };
  return (
    <div className="page">
      <header>
        <div>
          <span className="eyebrow">PREFERENCES</span>
          <h1>Settings</h1>
        </div>
      </header>
      <section className="panel">
        <h3>ACCESSIBILITY</h3>
        <label>
          Interface font size
          <span className="select">
            <select value={font} onChange={(e) => update("fontSize", +e.target.value)}>
              <option value="14">Small</option>
              <option value="16">Medium</option>
              <option value="18">Large</option>
              <option value="20">Extra Large</option>
            </select>
          </span>
        </label>
        <label>
          Density
          <span className="select">
            <select value={density} onChange={(e) => update("density", e.target.value)}>
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
            </select>
          </span>
        </label>
        <label>
          Word wrap
          <input type="checkbox" checked={wrap} onChange={(e) => update("wordWrap", e.target.checked)} />
        </label>
        <label>
          Reduced motion
          <input type="checkbox" checked={motion} onChange={(e) => update("reducedMotion", e.target.checked)} />
        </label>
      </section>
      <section className="panel">
        <h3>LOCAL DATA</h3>
        <button
          onClick={() => {
            localStorage.removeItem("wydev:recentProjects");
            location.reload();
          }}
        >
          Clear recent projects
        </button>
        <button onClick={clearWorkingData}>Clear local working data</button>
      </section>
    </div>
  );
}
