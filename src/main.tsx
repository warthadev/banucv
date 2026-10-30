// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./react/redux/store";
import App from "./App.tsx";
import "./css/root.css";
import "./css/style.css";
import "./css/color.css";
import "./css/loading.css";
import "./css/nav.css";
import "./css/home.css";
import "./css/login.css";
import "./css/dashvisitshow.css";
import "./css/barcode.css";
import "./css/setting.css";
import "./css/playerfloatmusic.css";
import "./css/quick.css";
import "./css/githubeditor.css";
import "./css/downloader.css";
import "./css/universal.css";
import "./css/collectphoto.css";
import "./css/aichat.css";
import "./css/cloudview.css";
import "./css/mediarender.css";
import "./css/apiaichecking.css";
import "./css/dash.css";
import { initializeFirebase } from "./react/config/firebase";
import { initActiveBase } from "./react/config/api";

const rootElement = document.getElementById("root");

if (rootElement) {
  const bootstrap = async () => {
    try {
      await initActiveBase();
    } catch (error) {
      console.error("Failed to init active API base:", error);
    }

    try {
      await initializeFirebase();
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
    }

    createRoot(rootElement).render(
      <StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </StrictMode>
    );
  };

  bootstrap();
}