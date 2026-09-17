import React from "react";
import {createRoot} from "react-dom/client";
import App from "./App";
import "./styles.css";
import {initFullscreen} from "./fullscreen";
import { suppressWebServiceWorkerInNative } from "./mobileBridge";
createRoot(document.getElementById("root")).render(<App/>);
initFullscreen();

if (!suppressWebServiceWorkerInNative() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
