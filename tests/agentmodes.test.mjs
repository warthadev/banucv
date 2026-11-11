import test from "node:test";
import assert from "node:assert/strict";
import {
  buildModelScopedHistory,
  getAgentMessagesStorageKey,
  getAgentModelClassification,
  getAgentModelsForMode,
  getAgentPreferencesStorageKey,
  getAgentRequestModels,
  isVerifiedFreeAgentModel,
  parseAgentModeSettings,
} from "../src/react/config/agentmodes.ts";

const localModel = "mimo-v2.6:latest";
const localAlias = "openai-compatible-chat-uuid/mimo-v2.6:latest";
const freeRouter = "openrouter/openrouter/free";
const freeVariant = "openrouter/nvidia/nemotron-3.5-super-vl:free";
const thinkingModel = "gemini/gemini-3.1-pro-preview";
const flashModel = "gemini/gemini-3.6-flash";
const fastLiteModel = "gemini/gemini-3.5-flash-lite";
const freeThinkingModel = "openrouter/google/gemini-3.1-pro-preview:free";
const freeFlashModel = "openrouter/google/gemini-3.6-flash:free";
const freeFastLiteModel = "openrouter/google/gemini-3.5-flash-lite:free";
const unknownModel = "gemini/model-with-unknown-capabilities";

const catalog = [
  thinkingModel,
  flashModel,
  fastLiteModel,
  unknownModel,
  freeRouter,
  freeVariant,
  freeThinkingModel,
  freeFlashModel,
  freeFastLiteModel,
  localModel,
  localAlias,
];

const autoSimple = [
  flashModel,
  fastLiteModel,
  freeFlashModel,
  freeFastLiteModel,
  thinkingModel,
  freeThinkingModel,
  localModel,
];

test("Auto uses only this account's classified Thinking/Fast models, then exact Local last", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "auto"), autoSimple);
});

test("Auto orders eligible account models by prompt complexity and keeps exact Local as final fallback", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "auto", flashModel, "Hi"), autoSimple);
  assert.deepEqual(getAgentRequestModels(catalog, "auto", flashModel, "Please analyze the architecture step by step"), [
    thinkingModel,
    flashModel,
    freeThinkingModel,
    freeFlashModel,
    fastLiteModel,
    freeFastLiteModel,
    localModel,
  ]);
  assert.deepEqual(getAgentRequestModels([unknownModel, localAlias, localModel], "auto", "", "Hi"), [localModel]);
});

test("an explicitly selected Auto model stays first without escaping the eligible account pool", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "auto", fastLiteModel, "Please analyze this", true), [
    fastLiteModel,
    thinkingModel,
    flashModel,
    freeThinkingModel,
    freeFlashModel,
    freeFastLiteModel,
    localModel,
  ]);
});

test("Thinking and Fast modes route only to supported models in the selected category", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "thinking", thinkingModel), [
    thinkingModel,
    flashModel,
    freeThinkingModel,
    freeFlashModel,
  ]);
  assert.deepEqual(getAgentRequestModels(catalog, "fast", fastLiteModel), [
    fastLiteModel,
    flashModel,
    freeFlashModel,
    freeFastLiteModel,
  ]);
  assert.deepEqual(getAgentModelsForMode(catalog, "thinking"), [thinkingModel, flashModel, freeThinkingModel, freeFlashModel]);
  assert.deepEqual(getAgentModelsForMode(catalog, "fast"), [flashModel, fastLiteModel, freeFlashModel, freeFastLiteModel]);
});

test("unknown account models stay unclassified and are excluded from the four supported modes", () => {
  assert.equal(getAgentModelClassification(unknownModel), "Other / unclassified");
  assert.equal(getAgentModelClassification(localAlias), "Other / unclassified");
  assert.equal(getAgentModelClassification(localModel), "Local");
  assert.deepEqual(getAgentModelsForMode(catalog, "thinking").filter((model) => model === unknownModel || model === localAlias), []);
  assert.deepEqual(getAgentModelsForMode(catalog, "fast").filter((model) => model === unknownModel || model === localAlias), []);
});

test("Local mode and a manually selected bare local model do not fall back to cloud", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "local"), [localModel]);
  assert.deepEqual(getAgentRequestModels(catalog, "local", localModel), [localModel]);
  assert.deepEqual(getAgentRequestModels([localAlias], "local", localAlias), []);
});

test("free status is recognized only for documented OpenRouter free routes", () => {
  assert.equal(isVerifiedFreeAgentModel(freeRouter), true);
  assert.equal(isVerifiedFreeAgentModel(freeVariant), true);
  assert.equal(isVerifiedFreeAgentModel("provider/model:free"), false);
});

test("messages and preferences are namespaced by Firebase UID", () => {
  assert.notEqual(getAgentMessagesStorageKey("uid-a"), getAgentMessagesStorageKey("uid-b"));
  assert.notEqual(getAgentPreferencesStorageKey("uid-a"), getAgentPreferencesStorageKey("uid-b"));
  assert.deepEqual(parseAgentModeSettings('{"mode":"fast","model":"x"}'), { mode: "fast", model: "x" });
  assert.deepEqual(parseAgentModeSettings('{"mode":"manual","model":"x"}'), { mode: "auto", model: "x" });
  assert.deepEqual(parseAgentModeSettings("invalid"), { mode: "auto", model: "" });
});

test("history uses the actual responding model rather than the initial request model", () => {
  assert.deepEqual(buildModelScopedHistory([
    { role: "user", content: "tanya" },
    { role: "bot", content: "jawaban fallback", model: "actual-model-b", requestedModel: "requested-model-a" },
  ], "actual-model-b"), [
    { role: "user", content: "tanya" },
    { role: "assistant", content: "jawaban fallback" },
  ]);
  assert.deepEqual(buildModelScopedHistory([
    { role: "bot", content: "jawaban fallback", model: "actual-model-b", requestedModel: "requested-model-a" },
  ], "requested-model-a"), [
    { role: "user", content: "[Shared conversation context from another AI model (actual-model-b); this was not written by you.]\njawaban fallback" },
  ]);
});
