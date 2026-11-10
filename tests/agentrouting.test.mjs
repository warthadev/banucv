import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_AGENT_MODEL,
  LOCAL_AGENT_MODEL_ALIAS,
  isLocalAgentModel,
  resolveAgentModelRoute,
} from "../src/react/config/agentrouting.ts";

const cloudApiBase = "https://warthadev-backend.onrender.com";
const localApiBase = "https://7680-agq2firibhstlf6sr7k3ydjoim.instabox.tech";

for (const model of [LOCAL_AGENT_MODEL, LOCAL_AGENT_MODEL_ALIAS]) {
  test(`local identifier ${model} uses the VM and canonical model`, () => {
    assert.equal(isLocalAgentModel(model), true);
    assert.deepEqual(resolveAgentModelRoute(model, cloudApiBase, localApiBase), {
      apiBase: localApiBase,
      model: LOCAL_AGENT_MODEL,
    });
  });
}

test("local identifiers are normalized without changing their meaning", () => {
  assert.deepEqual(resolveAgentModelRoute("  MIMO-V2.6:LATEST  ", cloudApiBase, localApiBase), {
    apiBase: localApiBase,
    model: LOCAL_AGENT_MODEL,
  });
});

const cloudModels = [
  "openrouter/openrouter/free",
  "openrouter/nvidia/nemotron-3.5-super-vl:free",
  "openrouter/dots-studio/dots-3-note-preview:free",
  "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
  "gemini/gemini-3.6-flash",
  "gemini/gemini-3.5-flash-lite",
  "gemini/gemini-3-flash-preview",
  "mmg/MiniMax-M3.1-Flash-Preview",
  "mmg/MiniMax-M3",
  "mmg/MiniMax-M2.7",
  "mmg/MiniMax-M2.7-highspeed",
];

for (const model of cloudModels) {
  test(`cloud route and identifier remain unchanged: ${model}`, () => {
    assert.equal(isLocalAgentModel(model), false);
    assert.deepEqual(resolveAgentModelRoute(model, cloudApiBase, localApiBase), {
      apiBase: cloudApiBase,
      model,
    });
  });
}

test("unverified provider prefixes are not stripped or redirected", () => {
  const model = "another-provider/mimo-v2.6:latest";
  assert.equal(isLocalAgentModel(model), false);
  assert.deepEqual(resolveAgentModelRoute(model, cloudApiBase, localApiBase), {
    apiBase: cloudApiBase,
    model,
  });
});

test("an explicit local base is used without falling back to the cloud", () => {
  const override = "https://local-agent.example.test";
  assert.deepEqual(resolveAgentModelRoute(LOCAL_AGENT_MODEL, cloudApiBase, override), {
    apiBase: override,
    model: LOCAL_AGENT_MODEL,
  });
});

test("an explicit cloud base is preserved", () => {
  const override = "https://cloud-agent.example.test";
  assert.deepEqual(resolveAgentModelRoute(cloudModels[0], override, localApiBase), {
    apiBase: override,
    model: cloudModels[0],
  });
});
