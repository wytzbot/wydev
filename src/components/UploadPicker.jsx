import { useEffect, useRef, useState } from "react";
import { Upload, FileArchive, File, X, Check, FolderOpen } from "lucide-react";

export default function UploadPicker({ open, onClose, onFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setDragging(false);
      return;
    }
    const key = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, onClose]);

  if (!open) return null;

  const addFiles = (list) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    setSelected(files);
  };

  const choose = () => inputRef.current?.click();
  const submit = () => {
    if (selected.length) onFiles?.(selected);
  };

  return (
    <div className="uploadPickerOverlay" role="presentation" onClick={onClose}>
      <div className="uploadPickerSheet" role="dialog" aria-modal="true" aria-label="Upload files" onClick={(e) => e.stopPropagation()}>
        <div className="uploadPickerHead">
          <div>
            <span className="eyebrow">PROJECT FILES</span>
            <h3>Upload to repository</h3>
          </div>
          <button className="iconButton" onClick={onClose} aria-label="Close"><X size={19}/></button>
        </div>

        <div
          className={`uploadDropZone${dragging ? " dragging" : ""}`}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        >
          <div className="uploadIcon"><Upload size={25}/></div>
          <strong>Drop files here</strong>
          <span>or choose files from your device</span>
          <button type="button" className="primary uploadChoose" onClick={choose}>
            <FolderOpen size={17}/> Choose files
          </button>
          <small>ZIP files are extracted automatically. Multiple files are supported.</small>
        </div>

        {selected.length > 0 && (
          <div className="uploadSelection">
            <div className="uploadSelectionHead"><b>{selected.length} selected</b><button onClick={() => setSelected([])}>Clear</button></div>
            <div className="uploadFileList">
              {selected.slice(0, 8).map((f) => (
                <div className="uploadFile" key={`${f.name}-${f.size}-${f.lastModified}`}>
                  {/\.zip$/i.test(f.name) ? <FileArchive size={17}/> : <File size={17}/>}
                  <span>{f.name}</span><Check size={15}/>
                </div>
              ))}
              {selected.length > 8 && <small>+{selected.length - 8} more files</small>}
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          className="srFileInput"
          type="file"
          multiple
          accept=".zip,*/*"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />

        <div className="uploadPickerActions">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!selected.length} onClick={submit}>
            <Upload size={16}/> Add {selected.length ? `${selected.length} file${selected.length === 1 ? "" : "s"}` : "files"}
          </button>
        </div>
      </div>
    </div>
  );
}
