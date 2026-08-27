import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { setToastHandler } from "../toast";

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    setToastHandler((t) => {
      setToasts((list) => [...list, t]);
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), t.duration);
    });
    return () => setToastHandler(null);
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="toastStack" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div className={`toast toast-${t.type}`} key={t.id}>
            <Icon size={16} />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
