import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// تسجيل Service Worker للعمل Offline
if ("serviceWorker" in navigator) {
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
