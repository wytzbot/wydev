import { nativeVibrate } from "./wybuildBridge";

let handler = null;

export function setToastHandler(fn) {
  handler = fn;
}

export function showToast({ message, type = "info", duration = type === "error" ? 10000 : 4200, details = "" }) {
  const text = String(message || "Something happened.");
  // Short, distinct haptic pulse so success/failure register even when the
  // notification bar is out of the corner of the eye — a no-op outside the
  // WyBuild Android build or a browser with the Vibration API.
  if (type === "error") nativeVibrate(35);
  else if (type === "success") nativeVibrate(15);
  handler?.({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message: text,
    details: details || "",
    type,
    duration,
    time: Date.now(),
  });
}

export const toastSuccess = (message) => showToast({ message, type: "success" });
export const toastError = (error) => {
  const details = error instanceof Error ? (error.stack || "") : "";
  const message = error instanceof Error ? error.message : String(error);
  showToast({ message, type: "error", details });
};
export const toastInfo = (message) => showToast({ message, type: "info" });
