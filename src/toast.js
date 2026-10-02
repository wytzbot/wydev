import { nativeVibrate } from "./wybuildBridge";
import { API_BASE_URL } from "./config";

let handler = null;

export function setToastHandler(fn) {
  handler = fn;
}

export function showToast({ message, type = "info", duration = type === "error" ? 10000 : 4200, details = "", actionLabel = "", action = null }) {
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
    actionLabel: actionLabel || "",
    action: typeof action === "function" ? action : null,
    type,
    duration,
    time: Date.now(),
  });
}

export const toastSuccess = (message) => showToast({ message, type: "success" });
export const toastError = (error) => {
  const details = error instanceof Error ? (error.stack || "") : "";
  const raw = error instanceof Error ? error.message : String(error);
  const status = Number(error?.status || 0);
  const code = String(error?.code || "");
  const needsReauth = status === 401 || ["GITHUB_DELETE_SCOPE_MISSING","GITHUB_WORKFLOW_SCOPE_REQUIRED","GITHUB_REAUTH_REQUIRED"].includes(code);
  const message = needsReauth
    ? "This action requires you to sign in to GitHub again. Your local changes were kept."
    : raw;
  showToast({ message, type: "error", details, actionLabel: needsReauth ? "Sign in again" : "", action: needsReauth ? () => { window.location.href = `${API_BASE_URL}/auth/github`; } : null });
};
export const toastInfo = (message) => showToast({ message, type: "info" });
