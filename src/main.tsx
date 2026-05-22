// main.tsx
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
import "./css/ytdl.css";
import "./css/collectphoto.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>
  );
}