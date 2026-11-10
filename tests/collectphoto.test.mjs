import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("CollectPhoto renders its initial authorizing state through Vite SSR", async () => {
  const vite = await createServer({
    root: repoRoot,
    configFile: path.join(repoRoot, "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });

  try {
    const module = await vite.ssrLoadModule("/src/react/feature/collectphoto.tsx");
    const CollectPhoto = module.default;
    assert.equal(typeof CollectPhoto, "function");

    // Effects do not run during SSR, so this exercises the initial
    // Authorizing... branch without Firebase initialization or network calls.
    const html = renderToString(React.createElement(CollectPhoto));
    assert.match(html, /Authorizing\.\.\./);
  } finally {
    await vite.close();
  }
});
