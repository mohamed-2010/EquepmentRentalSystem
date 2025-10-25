import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker only on web (http/https), not in Electron/file protocol
if (
  "serviceWorker" in navigator &&
  (window.location.protocol === "http:" ||
    window.location.protocol === "https:") &&
  !navigator.userAgent.includes("Electron")
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log(
          "Service Worker registered successfully:",
          registration.scope
        );
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// createRoot(document.getElementById("root")!).render(<App />);
