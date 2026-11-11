import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { LOCAL_AGENT_MODEL, LOCAL_AGENT_MODEL_ALIAS } from "../src/react/config/agentrouting.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let vite;
let AgentModelCatalog;

before(async () => {
  vite = await createServer({
    root: repoRoot,
    configFile: path.join(repoRoot, "vite.config.ts"),
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    logLevel: "silent",
  });
  AgentModelCatalog = (await vite.ssrLoadModule("/src/react/default/agentmodelcatalog.tsx")).default;
});

after(async () => {
  await vite?.close();
});

const render = (props) => renderToString(React.createElement(AgentModelCatalog, props));

test("renders only supplied account IDs and groups only the exact runtime model as Local", () => {
  const html = render({ models: ["account-a/cloud-model", LOCAL_AGENT_MODEL, LOCAL_AGENT_MODEL_ALIAS], isLoading: false, error: null });
  assert.match(html, /Cloud models/);
  assert.match(html, /Local models/);
  assert.match(html, /account-a\/cloud-model/);
  assert.ok(html.includes(`<li>${LOCAL_AGENT_MODEL}</li>`));
  assert.ok(html.includes(`<li>${LOCAL_AGENT_MODEL_ALIAS}</li>`));
  assert.equal((html.match(/<li>/g) || []).length, 3);
  const cloudGroup = html.split("Cloud models")[1].split("Local models")[0];
  const localGroup = html.split("Local models")[1];
  assert.ok(cloudGroup.includes(LOCAL_AGENT_MODEL_ALIAS));
  assert.ok(!localGroup.includes(LOCAL_AGENT_MODEL_ALIAS));
  assert.doesNotMatch(html, /openrouter\/openrouter\/free/);
});

test("an empty account catalog does not invent global or local model entries", () => {
  const html = render({ models: [], isLoading: false, error: null });
  assert.match(html, /model catalog is empty/);
  assert.doesNotMatch(html, /<li>/);
  assert.doesNotMatch(html, /mimo-v2.6/);
});

test("loading or failed catalogs do not render stale model IDs", () => {
  for (const state of [{ isLoading: true, error: null }, { isLoading: false, error: "Catalog unavailable" }]) {
    const html = render({ models: ["old-account/private-model"], ...state });
    assert.doesNotMatch(html, /old-account/);
    assert.doesNotMatch(html, /<li>/);
  }
});
