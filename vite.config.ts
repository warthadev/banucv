import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL?.trim() || env.VITE_API_FALLBACKS?.split(",")[0]?.trim() || "";

  return {
    plugins: [react()],
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl) },
    resolve: {
      alias: { "@": path.resolve(root, "./src"), "@config": path.resolve(root, "./src/react/config") },
    },
    server: { host: true, historyApiFallback: true },
    build: { chunkSizeWarningLimit: 1000 },
  };
});
