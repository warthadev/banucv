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
  unknownModel,
  freeRouter,
  freeVariant,
  localAlias,
  localModel,
];

test("Auto uses classified Thinking/Fast first, then this account's Other models, and exact Local last", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "auto"), autoSimple);
});

test("Auto orders the account catalog by prompt complexity and includes all fallback candidates", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "auto", flashModel, "Hi"), autoSimple);
  assert.deepEqual(getAgentRequestModels(catalog, "auto", flashModel, "Please analyze the architecture step by step"), [
    thinkingModel,
    flashModel,
    freeThinkingModel,
    freeFlashModel,
    fastLiteModel,
    freeFastLiteModel,
    unknownModel,
    freeRouter,
    freeVariant,
    localAlias,
    localModel,
  ]);
});

test("Thinking and Fast modes start with the selected model, then same-mode peers, then other cloud models from the same catalog", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "thinking", thinkingModel), [
    thinkingModel,
    flashModel,
    freeThinkingModel,
    freeFlashModel,
    fastLiteModel,
    unknownModel,
    freeRouter,
    freeVariant,
    freeFastLiteModel,
    localAlias,
  ]);
  assert.deepEqual(getAgentRequestModels(catalog, "fast", fastLiteModel), [
    fastLiteModel,
    flashModel,
    freeFlashModel,
    freeFastLiteModel,
    thinkingModel,
    unknownModel,
    freeRouter,
    freeVariant,
    freeThinkingModel,
    localAlias,
  ]);
  assert.deepEqual(getAgentModelsForMode(catalog, "thinking"), [thinkingModel, flashModel, freeThinkingModel, freeFlashModel]);
  assert.deepEqual(getAgentModelsForMode(catalog, "fast"), [flashModel, fastLiteModel, freeFlashModel, freeFastLiteModel]);
});

test("All models exposes every account model and labels unknown models under Other / unclassified", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "manual"), catalog);
  assert.equal(getAgentModelClassification(unknownModel), "Other / unclassified");
  assert.equal(getAgentModelClassification(localAlias), "Other / unclassified");
  assert.equal(getAgentModelClassification(localModel), "Local");
});

test("manual fallback starts with the selected model and stays within the same account catalog", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "manual", unknownModel), [
    unknownModel,
    thinkingModel,
    flashModel,
    fastLiteModel,
    freeRouter,
    freeVariant,
    freeThinkingModel,
    freeFlashModel,
    freeFastLiteModel,
    localAlias,
  ]);
  const accountB = ["account-b/gemini-3.6-flash", "account-b/private-model"];
  assert.ok(getAgentRequestModels(catalog, "manual", unknownModel).every((model) => !accountB.includes(model)));
  assert.deepEqual(getAgentRequestModels(catalog, "manual", accountB[0]), []);
});

test("Local mode and a manually selected bare local model do not fall back to cloud", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "local"), [localModel]);
  assert.deepEqual(getAgentRequestModels(catalog, "local", localModel), [localModel]);
  assert.deepEqual(getAgentRequestModels(catalog, "manual", localModel), [localModel]);
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
