import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import "./chat.css";
import { initializeFirebase } from "./react/config/firebase";
import { initActiveBase } from "./react/config/api";

const root = document.getElementById("root");

if (root) {
  const bootstrap = async () => {
    try {
      await initActiveBase();
      await initializeFirebase();
    } catch (error) {
      console.error("Failed to initialize the application:", error);
    }
    createRoot(root).render(<StrictMode><App /></StrictMode>);
  };
  void bootstrap();
}
