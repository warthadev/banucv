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
  isVerifiedFreeAgentModel,
  parseAgentModeSettings,
} from "../src/react/config/agentmodes.ts";

const localModel = "mimo-v2.6:latest";
const cloudMimo = "openai-compatible-chat-test-provider/mimo-v2.6:latest";
const unknownModel = "provider/model-with-unknown-capabilities";
const freeRouter = "openrouter/openrouter/free";
const flashModel = "gemini/gemini-3.6-flash";
const fastLiteModel = "gemini/gemini-3.5-flash-lite";
const minimaxFast = "mmg/MiniMax-M2.7-highspeed";

// Families and reasoning flags verified in the account's upstream catalog.
// The custom provider namespace is synthetic: never couple modes to an account ID.
// Fast also includes explicitly Flash/highspeed variants; it is not a latency SLA.
const catalogFixture = [
  { id: freeRouter, reasoning: false, fast: true },
  { id: "openrouter/nvidia/nemotron-3.5-super-vl:free", reasoning: true, fast: false },
  { id: "openrouter/dots-studio/dots-3-note-preview:free", reasoning: false, fast: true },
  { id: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", reasoning: true, fast: false },
  { id: flashModel, reasoning: true, fast: true },
  { id: fastLiteModel, reasoning: true, fast: true },
  { id: "gemini/gemini-3-flash-preview", reasoning: true, fast: true },
  { id: cloudMimo, reasoning: true, fast: false },
  { id: "mmg/MiniMax-M3.1-Flash-Preview", reasoning: true, fast: true },
  { id: "mmg/MiniMax-M3", reasoning: true, fast: false },
  { id: "mmg/MiniMax-M2.7", reasoning: true, fast: false },
  { id: minimaxFast, reasoning: true, fast: true },
];
const cloudCatalog = catalogFixture.map(({ id }) => id);
const thinkingModels = catalogFixture.filter(({ reasoning }) => reasoning).map(({ id }) => id);
const fastModels = catalogFixture.filter(({ fast }) => fast).map(({ id }) => id);
const catalog = [...cloudCatalog, unknownModel, localModel];
const unique = (models) => [...new Set(models)];
const autoSimple = [...unique([...fastModels, ...thinkingModels]), localModel];
const autoThinking = [...unique([...thinkingModels, ...fastModels]), localModel];

test("all twelve verified cloud catalog families appear in Auto without adding global models", () => {
  const models = getAgentModelsForMode(cloudCatalog, "auto");
  assert.equal(models.length, 12);
  assert.deepEqual(new Set(models), new Set(cloudCatalog));
  assert.ok(models.every((model) => cloudCatalog.includes(model)));
  assert.ok(!models.includes(localModel));
  assert.deepEqual(getAgentModelsForMode([], "auto"), []);
});

test("Thinking includes every catalog reasoning family, not only Gemini", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "thinking"), thinkingModels);
  assert.equal(thinkingModels.length, 10);
  assert.ok(thinkingModels.includes(fastLiteModel));
  assert.equal(getAgentModelClassification(cloudMimo), "Thinking");
  assert.equal(getAgentModelClassification("mmg/MiniMax-M3"), "Thinking");
  assert.equal(getAgentModelClassification(minimaxFast), "Thinking · Fast");
});

test("Fast includes direct-response routes and speed variants across providers", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "fast"), fastModels);
  assert.equal(fastModels.length, 7);
  assert.equal(getAgentModelClassification(freeRouter), "Fast");
  assert.equal(getAgentModelClassification("mmg/MiniMax-M3.1-Flash-Preview"), "Thinking · Fast");
});

test("classification ignores dynamic provider namespaces and versions, while preserving route IDs", () => {
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

test("Auto orders account candidates by prompt complexity and keeps authorized bare Local last", () => {
  assert.deepEqual(getAgentModelsForMode(catalog, "auto"), autoSimple);
  assert.deepEqual(getAgentRequestModels(catalog, "auto", flashModel, "Hi"), autoSimple);
  assert.deepEqual(getAgentRequestModels(catalog, "auto", flashModel, "Please analyze the architecture step by step"), autoThinking);
});

test("Auto never starts a bare Local request without a cloud candidate to fail first", () => {
  assert.deepEqual(getAgentModelsForMode([unknownModel, localModel], "auto"), []);
  assert.deepEqual(getAgentRequestModels([localModel], "auto", localModel, "Hi", true), []);
  assert.deepEqual(getAgentModelsForMode([localModel], "local"), [localModel]);
});

test("an explicitly selected Auto cloud model stays first without moving Local ahead of cloud", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "auto", minimaxFast, "Please analyze this", true), [
    minimaxFast,
    ...autoThinking.filter((model) => model !== minimaxFast),
  ]);
  assert.deepEqual(getAgentRequestModels(catalog, "auto", localModel, "Hi", true), autoSimple);
});

test("Thinking and Fast fallback stay within the selected category and never reach Local", () => {
  assert.deepEqual(getAgentRequestModels(catalog, "thinking", cloudMimo), [
    cloudMimo,
    ...thinkingModels.filter((model) => model !== cloudMimo),
  ]);
  assert.deepEqual(getAgentRequestModels(catalog, "fast", minimaxFast), [
    minimaxFast,
    ...fastModels.filter((model) => model !== minimaxFast),
  ]);
  assert.deepEqual(getAgentRequestModels(catalog, "fast", cloudMimo), []);
  assert.deepEqual(getAgentRequestModels(catalog, "thinking", freeRouter), []);
});

test("model selection preserves the current mode except an explicit bare Local selection", () => {
  for (const mode of ["auto", "thinking", "fast", "local"]) {
    for (const model of [flashModel, cloudMimo, minimaxFast]) {
      assert.equal(getAgentModeForModelSelection(mode, model), mode);
    }
    assert.equal(getAgentModeForModelSelection(mode, localModel), "local");
  }
});

test("unknown families remain unclassified rather than guessing their capabilities", () => {
  assert.equal(getAgentModelClassification(unknownModel), "Other / unclassified");
  for (const mode of ["auto", "thinking", "fast", "local"]) {
    assert.ok(!getAgentModelsForMode(catalog, mode).includes(unknownModel));
  }
});

test("Local contains only the authorized bare Mimo, never Gemini or a prefixed 9Router Mimo", () => {
  assert.equal(getAgentModelClassification(localModel), "Local");
  assert.deepEqual(getAgentModelsForMode(catalog, "local"), [localModel]);
  assert.deepEqual(getAgentRequestModels(catalog, "local", localModel), [localModel]);
  assert.deepEqual(getAgentModelsForMode(cloudCatalog, "local"), []);
  assert.deepEqual(getAgentRequestModels(cloudCatalog, "local", localModel), []);
  assert.deepEqual(getAgentRequestModels(catalog, "local", cloudMimo), []);
  assert.ok(!getAgentModelsForMode(catalog, "thinking").includes(localModel));
  assert.ok(!getAgentModelsForMode(catalog, "fast").includes(localModel));
});

test("catalogs remain per-user and a stale selection cannot import another account's model", () => {
  const accountB = ["another-provider/MiniMax-M3", "another-provider/mimo-v2.6:latest"];
  for (const mode of ["auto", "thinking", "fast", "local"]) {
    const selected = getAgentModelsForMode(cloudCatalog, mode);
    assert.ok(selected.every((model) => cloudCatalog.includes(model)));
    assert.ok(selected.every((model) => !accountB.includes(model)));
  }
  assert.deepEqual(getAgentRequestModels(cloudCatalog, "thinking", accountB[0]), []);
  assert.deepEqual(getAgentRequestModels(accountB, "thinking", cloudMimo), []);
  assert.deepEqual(new Set(getAgentRequestModels(accountB, "auto", flashModel, "analyze this", true)), new Set(accountB));
});

test("free status is recognized only for documented OpenRouter free routes", () => {
  assert.equal(isVerifiedFreeAgentModel(freeRouter), true);
  assert.equal(isVerifiedFreeAgentModel(catalogFixture[1].id), true);
  assert.equal(isVerifiedFreeAgentModel("provider/model:free"), false);
});

test("messages and preferences are namespaced by Firebase UID", () => {
  assert.notEqual(getAgentMessagesStorageKey("uid-a"), getAgentMessagesStorageKey("uid-b"));
  assert.notEqual(getAgentPreferencesStorageKey("uid-a"), getAgentPreferencesStorageKey("uid-b"));
  assert.deepEqual(parseAgentModeSettings('{"mode":"fast","model":"x"}'), { mode: "fast", model: "x" });
  assert.deepEqual(parseAgentModeSettings('{"mode":"manual","model":"x"}'), { mode: "auto", model: "x" });
  assert.deepEqual(parseAgentModeSettings("invalid"), { mode: "auto", model: "" });
});

test("stale Auto Local preferences are cleared without silently changing the mode", () => {
  assert.deepEqual(parseAgentModeSettings(JSON.stringify({ mode: "auto", model: localModel })), { mode: "auto", model: "" });
  assert.deepEqual(parseAgentModeSettings(JSON.stringify({ mode: "local", model: localModel })), { mode: "local", model: localModel });
  assert.deepEqual(parseAgentModeSettings(JSON.stringify({ mode: "auto", model: cloudMimo })), { mode: "auto", model: cloudMimo });
  const normalizedLocal = " MIMO-V2.6:LATEST ";
  assert.equal(getAgentModelClassification(normalizedLocal), "Local");
  assert.deepEqual(getAgentModelsForMode([normalizedLocal, cloudMimo, flashModel], "local"), [normalizedLocal]);
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
