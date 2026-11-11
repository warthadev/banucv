import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_AGENT_MODEL,
  LOCAL_AGENT_MODEL_ALIAS,
  isLocalAgentModel,
  isRetryableAgentAvailabilityError,
  resolveAgentModelRoute,
  shouldRetryWithNextAgentModel,
} from "../src/react/config/agentrouting.ts";

const agentApiBase = "https://warthadev-backend.onrender.com";

test("only the bare runtime model ID is Local and it stays behind the authenticated backend", () => {
  assert.equal(isLocalAgentModel(LOCAL_AGENT_MODEL), true);
  assert.deepEqual(resolveAgentModelRoute(LOCAL_AGENT_MODEL, agentApiBase), {
    apiBase: agentApiBase,
    model: LOCAL_AGENT_MODEL,
  });
});

test("a prefixed provider alias remains an account cloud model and is not re-routed", () => {
  assert.equal(isLocalAgentModel(LOCAL_AGENT_MODEL_ALIAS), false);
  assert.deepEqual(resolveAgentModelRoute(LOCAL_AGENT_MODEL_ALIAS, agentApiBase), {
    apiBase: agentApiBase,
    model: LOCAL_AGENT_MODEL_ALIAS,
  });
});

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

test("only explicit backend capacity responses classify as retryable", () => {
  assert.equal(isRetryableAgentAvailabilityError("Agent runtime rate limit (429)"), true);
  assert.equal(isRetryableAgentAvailabilityError(new Error("Agent runtime temporarily unavailable (503)")), true);
  for (const message of [
    "503",
    "Service unavailable",
    "high demand",
    "429 too many requests",
    "Model is not available for this account",
    "Invalid API key",
    "Agent runtime request failed",
    "Agent runtime temporarily unavailable (502)",
  ]) {
    assert.equal(isRetryableAgentAvailabilityError(message), false, message);
  }
});

test("only a non-Local model with an explicit availability error advances to the next model", () => {
  for (const message of ["Agent runtime rate limit (429)", "Agent runtime temporarily unavailable (503)"]) {
    assert.equal(shouldRetryWithNextAgentModel(catalogModels[0], isRetryableAgentAvailabilityError(message), 0, 3), true);
    assert.equal(shouldRetryWithNextAgentModel(LOCAL_AGENT_MODEL_ALIAS, isRetryableAgentAvailabilityError(message), 0, 3), true);
    assert.equal(shouldRetryWithNextAgentModel(LOCAL_AGENT_MODEL, isRetryableAgentAvailabilityError(message), 0, 3), false);
  }
  assert.equal(shouldRetryWithNextAgentModel(catalogModels[0], isRetryableAgentAvailabilityError("Agent runtime request failed"), 0, 3), false);
  assert.equal(shouldRetryWithNextAgentModel(catalogModels[1], true, 2, 3), false);
});
