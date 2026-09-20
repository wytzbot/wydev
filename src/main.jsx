import React from "react";
import {createRoot} from "react-dom/client";
import App from "./App";
import "./styles.css";
import {initFullscreen} from "./fullscreen";
createRoot(document.getElementById("root")).render(<App/>);
initFullscreen();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
