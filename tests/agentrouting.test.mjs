import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_AGENT_MODEL,
  LOCAL_AGENT_MODEL_ALIAS,
  isLocalAgentModel,
  resolveAgentModelRoute,
  shouldRetryWithNextAgentModel,
} from "../src/react/config/agentrouting.ts";

const agentApiBase = "https://warthadev-backend.onrender.com";

for (const model of [LOCAL_AGENT_MODEL, LOCAL_AGENT_MODEL_ALIAS]) {
  test(`local identifier ${model} stays behind the authenticated backend`, () => {
    assert.equal(isLocalAgentModel(model), true);
    assert.deepEqual(resolveAgentModelRoute(model, agentApiBase), {
      apiBase: agentApiBase,
      model,
    });
  });
}

test("local identifiers are preserved for backend-side catalog authorization", () => {
  assert.deepEqual(resolveAgentModelRoute("  MIMO-V2.6:LATEST  ", agentApiBase), {
    apiBase: agentApiBase,
    model: "  MIMO-V2.6:LATEST  ",
  });
});

const catalogModels = [
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

for (const model of catalogModels) {
  test(`catalog model is routed unchanged through the backend: ${model}`, () => {
    assert.equal(isLocalAgentModel(model), false);
    assert.deepEqual(resolveAgentModelRoute(model, agentApiBase), {
      apiBase: agentApiBase,
      model,
    });
  });
}

test("unverified provider IDs are not stripped or redirected", () => {
  const model = "another-provider/mimo-v2.6:latest";
  assert.equal(isLocalAgentModel(model), false);
  assert.deepEqual(resolveAgentModelRoute(model, agentApiBase), {
    apiBase: agentApiBase,
    model,
  });
});

for (const model of [LOCAL_AGENT_MODEL, LOCAL_AGENT_MODEL_ALIAS]) {
  for (const status of ["429", "503"]) {
    test(`local model ${model} does not fall back after ${status}`, () => {
      assert.equal(shouldRetryWithNextAgentModel(model, true, 0, 3), false);
    });
  }
}

for (const status of ["429", "503"]) {
  test(`cloud model still falls back to the next account-catalog model after ${status}`, () => {
    assert.equal(shouldRetryWithNextAgentModel(catalogModels[0], true, 0, 3), true);
  });
}

test("retryable failure at the final model does not request another model", () => {
  assert.equal(shouldRetryWithNextAgentModel(catalogModels[1], true, 2, 3), false);
});
