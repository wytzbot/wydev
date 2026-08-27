// Fixed-position, auto-dismissing notifications. Used instead of inline banners
// so a result (e.g. "Pushed successfully") never shifts surrounding page layout.
let handler = null;

export function setToastHandler(fn) {
  handler = fn;
}

export function showToast({ message, type = "info", duration = 3400 }) {
  if (!message) return;
  handler?.({ id: `${Date.now()}-${Math.random()}`, message, type, duration });
}

export const toastSuccess = (message) => showToast({ message, type: "success" });
export const toastError = (message) => showToast({ message, type: "error" });
export const toastInfo = (message) => showToast({ message, type: "info" });
