import test from "node:test";
import assert from "node:assert/strict";
import {
  buildModelScopedHistory,
  getAgentMessagesStorageKey,
  getAgentModeForModelSelection,
  getAgentModelClassification,
  getAgentModelsForMode,
  getAgentPreferencesStorageKey,
  getAgentRequestModels,
  isLocalInferenceAgentModel,
  isVerifiedFreeAgentModel,
  parseAgentModeSettings,
} from "../src/react/config/agentmodes.ts";
import { isLocalAgentModel, resolveAgentModelRoute } from "../src/react/config/agentrouting.ts";

const bareLocalModel = "mimo-v2.6:latest";
const localCatalogModel = "openai-compatible-chat-test-provider/mimo-v2.6:latest";
const otherMimo = "other-provider/mimo-v2.7";
const unknownModel = "provider/model-with-unknown-capabilities";
const freeRouter = "openrouter/openrouter/free";
const flashModel = "gemini/gemini-3.6-flash";
const fastLiteModel = "gemini/gemini-3.5-flash-lite";
const minimaxFast = "mmg/MiniMax-M2.7-highspeed";

// Families/reasoning flags verified in the account's upstream catalog. The custom
// provider namespace is synthetic: never couple eligibility to an account UUID.
// Local is an inference category; its original 9Router route must stay intact.
const catalogFixture = [
  { id: freeRouter, reasoning: false, fast: true },
  { id: "openrouter/nvidia/nemotron-3.5-super-vl:free", reasoning: true, fast: false },
  { id: "openrouter/dots-studio/dots-3-note-preview:free", reasoning: false, fast: true },
  { id: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", reasoning: true, fast: false },
  { id: flashModel, reasoning: true, fast: true },
  { id: fastLiteModel, reasoning: true, fast: true },
  { id: "gemini/gemini-3-flash-preview", reasoning: true, fast: true },
  { id: localCatalogModel, reasoning: true, fast: false, local: true },
  { id: "mmg/MiniMax-M3.1-Flash-Preview", reasoning: true, fast: true },
  { id: "mmg/MiniMax-M3", reasoning: true, fast: false },
  { id: "mmg/MiniMax-M2.7", reasoning: true, fast: false },
  { id: minimaxFast, reasoning: true, fast: true },
];
const accountCatalog = catalogFixture.map(({ id }) => id);
const thinkingModels = catalogFixture.filter(({ reasoning, local }) => reasoning && !local).map(({ id }) => id);
const fastModels = catalogFixture.filter(({ fast }) => fast).map(({ id }) => id);
const catalog = [...accountCatalog, unknownModel];
const unique = (models) => [...new Set(models)];
const autoSimple = [...unique([...fastModels, ...thinkingModels]), localCatalogModel];
const autoThinking = [...unique([...thinkingModels, ...fastModels]), localCatalogModel];

test("all twelve account catalog models appear in Auto, with no synthesized bare or global model", () => {
  const models = getAgentModelsForMode(accountCatalog, "auto");
  assert.equal(models.length, 12);
  assert.deepEqual(new Set(models), new Set(accountCatalog));
  assert.ok(models.every((model) => accountCatalog.includes(model)));
  assert.ok(!models.includes(bareLocalModel));
  assert.equal(models.at(-1), localCatalogModel);
  assert.deepEqual(getAgentModelsForMode([], "auto"), []);
});

test("Thinking covers verified reasoning families across providers while Local stays Local-only", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "thinking"), thinkingModels);
  assert.equal(thinkingModels.length, 9);
  assert.ok(thinkingModels.includes(fastLiteModel));
  assert.equal(getAgentModelClassification(localCatalogModel), "Local");
  assert.equal(getAgentModelClassification("mmg/MiniMax-M3"), "Thinking");
  assert.equal(getAgentModelClassification(minimaxFast), "Thinking · Fast");
  assert.equal(getAgentModelClassification(otherMimo), "Thinking");
});

test("Fast includes direct-response routes and speed variants across providers", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "fast"), fastModels);
  assert.equal(fastModels.length, 7);
  assert.equal(getAgentModelClassification(freeRouter), "Fast");
  assert.equal(getAgentModelClassification("mmg/MiniMax-M3.1-Flash-Preview"), "Thinking · Fast");
});

test("classification ignores provider namespaces and versions without rewriting model IDs", () => {
  const alternateIds = [
    "tenant-provider/nested/MiniMax-M3.1-Flash-Preview",
    "other-provider/gemini-3.8-flash",
    "openrouter/google/gemini-3.1-pro-preview:free",
    "custom/qwen-explicit-thinking",
  ];
  assert.deepEqual(getAgentModelsForMode(alternateIds, "thinking"), alternateIds);
  assert.deepEqual(getAgentModelsForMode(alternateIds, "fast"), alternateIds.slice(0, 2));
  assert.deepEqual(getAgentModelsForMode([flashModel, flashModel], "thinking"), [flashModel]);
});

test("Auto orders Thinking/Fast account models by prompt complexity, then the full Local catalog ID", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "auto"), autoSimple);
  assert.deepEqual(getAgentRequestModels(catalog, "auto", flashModel, "Hi"), autoSimple);
  assert.deepEqual(getAgentRequestModels(catalog, "auto", flashModel, "Please analyze the architecture step by step"), autoThinking);
});

test("Auto cannot start Local without an eligible Thinking/Fast candidate to fail first", () => {
  for (const local of [localCatalogModel, bareLocalModel]) {
    assert.deepEqual(getAgentModelsForMode([unknownModel, local], "auto"), []);
    assert.deepEqual(getAgentRequestModels([local], "auto", local, "Hi", true), []);
    assert.deepEqual(getAgentModelsForMode([local], "local"), [local]);
  }
});

test("explicit Auto cloud preference stays first but a Local preference cannot move Local ahead", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "auto", minimaxFast, "Please analyze this", true), [
    minimaxFast, ...autoThinking.filter((model) => model !== minimaxFast),
  ]);
  assert.deepEqual(getAgentRequestModels(catalog, "auto", localCatalogModel, "Hi", true), autoSimple);
});

test("Thinking/Fast fallback stays in category and excludes Local inference routes", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "thinking", thinkingModels[0]), thinkingModels);
  assert.deepEqual(getAgentRequestModels(catalog, "fast", minimaxFast), [
    minimaxFast, ...fastModels.filter((model) => model !== minimaxFast),
  ]);
  assert.deepEqual(getAgentRequestModels(catalog, "fast", localCatalogModel), []);
  assert.deepEqual(getAgentRequestModels(catalog, "thinking", localCatalogModel), []);
  assert.deepEqual(getAgentRequestModels(catalog, "thinking", freeRouter), []);
});

test("selecting cloud preserves mode; explicitly selecting an authorized Local inference route selects Local", () => {
  for (const mode of ["auto", "thinking", "fast", "local"]) {
    for (const model of [flashModel, otherMimo, minimaxFast]) assert.equal(getAgentModeForModelSelection(mode, model), mode);
    assert.equal(getAgentModeForModelSelection(mode, localCatalogModel), "local");
    assert.equal(getAgentModeForModelSelection(mode, bareLocalModel), "local");
  }
});

test("unknown families remain unclassified instead of guessing capabilities", () => {
  assert.equal(getAgentModelClassification(unknownModel), "Other / unclassified");
  for (const mode of ["auto", "thinking", "fast", "local"]) assert.ok(!getAgentModelsForMode(catalog, mode).includes(unknownModel));
});

test("Local inference preserves the authorized 9Router route, key path, and exact request ID", () => {
  assert.equal(isLocalInferenceAgentModel(localCatalogModel), true);
  assert.equal(isLocalAgentModel(localCatalogModel), false, "UI Local must not turn a prefixed route into direct bare/Ollama routing");
  assert.deepEqual(getAgentModelsForMode(catalog, "local"), [localCatalogModel]);
  const sequence = getAgentRequestModels(catalog, "local", localCatalogModel);
  assert.deepEqual(sequence, [localCatalogModel]);
  assert.deepEqual(resolveAgentModelRoute(sequence[0], "https://authenticated-backend.test"), { apiBase: "https://authenticated-backend.test", model: localCatalogModel });
  assert.deepEqual(getAgentRequestModels(catalog, "local", bareLocalModel), [], "bare ID must not be synthesized");
  assert.deepEqual(getAgentModelsForMode([flashModel, minimaxFast, otherMimo], "local"), []);
  assert.deepEqual(getAgentModelsForMode([], "local"), []);
  const anotherPrefix = "another-authorized-provider/mimo-v2.6:latest";
  assert.deepEqual(getAgentModelsForMode([anotherPrefix], "local"), [anotherPrefix]);
});

test("per-user catalogs remain isolated and stale selections cannot import another user's Local route", () => {
  const accountB = ["another-provider/MiniMax-M3", "another-provider/mimo-v2.6:latest"];
  for (const mode of ["auto", "thinking", "fast", "local"]) {
    const selected = getAgentModelsForMode(accountCatalog, mode);
    assert.ok(selected.every((model) => accountCatalog.includes(model) && !accountB.includes(model)));
  }
  assert.deepEqual(getAgentRequestModels(accountCatalog, "local", accountB[1]), []);
  assert.deepEqual(getAgentRequestModels(accountB, "local", localCatalogModel), []);
  assert.deepEqual(new Set(getAgentRequestModels(accountB, "auto", flashModel, "analyze this", true)), new Set(accountB));
});

test("free status is limited to OpenRouter free routes and never inferred from other providers", () => {
  assert.equal(isVerifiedFreeAgentModel(freeRouter), true);
  assert.equal(isVerifiedFreeAgentModel(catalogFixture[1].id), true);
  assert.equal(isVerifiedFreeAgentModel("provider/model:free"), false);
});

test("messages and preferences stay namespaced by Firebase UID", () => {
  assert.notEqual(getAgentMessagesStorageKey("uid-a"), getAgentMessagesStorageKey("uid-b"));
  assert.notEqual(getAgentPreferencesStorageKey("uid-a"), getAgentPreferencesStorageKey("uid-b"));
  assert.deepEqual(parseAgentModeSettings('{"mode":"fast","model":"x"}'), { mode: "fast", model: "x" });
  assert.deepEqual(parseAgentModeSettings('{"mode":"manual","model":"x"}'), { mode: "auto", model: "x" });
  assert.deepEqual(parseAgentModeSettings("invalid"), { mode: "auto", model: "" });
});

test("stale Auto Local preferences clear without changing mode, while explicit Local preserves the full ID", () => {
  for (const local of [bareLocalModel, localCatalogModel]) {
    assert.deepEqual(parseAgentModeSettings(JSON.stringify({ mode: "auto", model: local })), { mode: "auto", model: "" });
    assert.deepEqual(parseAgentModeSettings(JSON.stringify({ mode: "local", model: local })), { mode: "local", model: local });
  }
  assert.deepEqual(parseAgentModeSettings(JSON.stringify({ mode: "auto", model: otherMimo })), { mode: "auto", model: otherMimo });
  assert.equal(getAgentModelClassification(" MIMO-V2.6:LATEST "), "Local");
});

test("history attributes assistant replies to the actual responding model", () => {
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
