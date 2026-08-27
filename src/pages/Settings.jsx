import { useState } from "react";
import { loadState, saveState } from "../storage";
import { confirmDialog } from "../dialog";
import Select from "../components/Select";

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
          <Select value={font} onChange={(v) => update("fontSize", +v)} options={[{value:14,label:"Small"},{value:16,label:"Medium"},{value:18,label:"Large"},{value:20,label:"Extra Large"}]} />
        </label>
        <label>
          Density
          <Select value={density} onChange={(v) => update("density", v)} options={[{value:"compact",label:"Compact"},{value:"comfortable",label:"Comfortable"}]} />
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
