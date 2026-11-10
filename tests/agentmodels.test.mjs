import test from "node:test";
import assert from "node:assert/strict";
import { extractAgentModelIds } from "../src/react/config/agentmodels.ts";

test("parses OpenAI-style data array and returns catalog IDs only", () => {
  assert.deepEqual(extractAgentModelIds({
    data: [
      { id: "provider/model-a", name: "Model A" },
      { id: "provider/model-b" },
    ],
  }), ["provider/model-a", "provider/model-b"]);
});

test("accepts the model list envelopes used by the API checker and nested API responses", () => {
  assert.deepEqual(extractAgentModelIds({ models: [{ id: "model-a" }] }), ["model-a"]);
  assert.deepEqual(extractAgentModelIds({ data: { models: [{ id: "model-b" }] } }), ["model-b"]);
  assert.deepEqual(extractAgentModelIds({ data: { data: [{ id: "model-c" }] } }), ["model-c"]);
  assert.deepEqual(extractAgentModelIds({ result: { models: [{ id: "model-d" }] } }), ["model-d"]);
});

test("uses a nonempty name only when an ID is missing, trims, and deduplicates", () => {
  assert.deepEqual(extractAgentModelIds([
    { name: "  provider/model-a  " },
    { id: "provider/model-a", name: "ignored label" },
    " provider/model-b ",
    { id: " ", name: "provider/model-c" },
    { id: 123, name: "provider/model-d" },
    null,
    {},
  ]), ["provider/model-a", "provider/model-b", "provider/model-c", "provider/model-d"]);
});

test("returns no models for empty, malformed, or unrelated payloads", () => {
  assert.deepEqual(extractAgentModelIds({ data: [] }), []);
  assert.deepEqual(extractAgentModelIds({ data: "not a model list" }), []);
  assert.deepEqual(extractAgentModelIds({ detail: "catalog unavailable" }), []);
  assert.deepEqual(extractAgentModelIds(null), []);
});
