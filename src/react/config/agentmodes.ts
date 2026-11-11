import { LOCAL_AGENT_MODEL } from "./agentrouting.ts";

export type AgentMode = "auto" | "thinking" | "fast" | "local";
export type AgentModeSettings = { mode: AgentMode; model: string };
export type ScopedHistoryMessage = { role: "user" | "assistant"; content: string };
type StoredConversationMessage = {
  role: "user" | "bot";
  content: string;
  model?: string;
  requestedModel?: string;
  error?: boolean;
};

const normalizedId = (model: string): string => {
  const parts = model.trim().toLowerCase().split("/");
  if (parts[0] === "openrouter") return (parts.at(-1) || "").replace(/:free$/, "");
  return parts.length > 1 ? parts.slice(1).join("/") : parts[0];
};

const isTrueLocalModel = (model: string): boolean => model.trim().toLowerCase() === LOCAL_AGENT_MODEL;

export const isVerifiedFreeAgentModel = (model: string): boolean => {
  const normalized = model.trim().toLowerCase();
  return normalized === "openrouter/openrouter/free" ||
    (normalized.startsWith("openrouter/") && normalized.endsWith(":free"));
};

export const isDocumentedThinkingAgentModel = (model: string): boolean => {
  const id = normalizedId(model);
  // Exact Gemini 3 model IDs documented as reasoning-capable, with dynamic
  // thinking enabled by default. Unknown model IDs remain unclassified.
  return [
    "gemini-3.1-pro-preview",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-3.8-flash",
  ].includes(id);
};

export const isDocumentedFastAgentModel = (model: string): boolean => {
  const id = normalizedId(model);
  // Exact Flash-family Gemini IDs documented as fast, low-latency or high-throughput.
  return [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
  ].includes(id);
};

export const getAgentModelClassification = (model: string): string => {
  if (isTrueLocalModel(model)) return "Local";
  const tags = [
    ...(isDocumentedThinkingAgentModel(model) ? ["Thinking"] : []),
    ...(isDocumentedFastAgentModel(model) ? ["Fast"] : []),
  ];
  return tags.length ? tags.join(" · ") : "Other / unclassified";
};

const requestNeedsThinking = (prompt: string): boolean => {
  const normalized = prompt.toLowerCase();
  return normalized.length > 320 || /\b(analy[sz]e|reason|step by step|compare|plan|debug|design|prove|derive|architecture|review|audit|explain in detail|analisis|jelaskan|bandingkan|rencanakan|buktikan|rancang|arsitektur|telaah|langkah demi langkah|hitung kompleks)\b/.test(normalized);
};

const uniqueModels = (models: string[]): string[] => [...new Set(models)];

const getAutoModelSequence = (models: string[], prompt: string, preferredModel = ""): string[] => {
  const catalog = uniqueModels(models);
  const cloud = catalog.filter((model) =>
    !isTrueLocalModel(model) && (isDocumentedThinkingAgentModel(model) || isDocumentedFastAgentModel(model))
  );
  const fast = cloud.filter(isDocumentedFastAgentModel);
  const thinking = cloud.filter(isDocumentedThinkingAgentModel);
  const prioritized = uniqueModels(requestNeedsThinking(prompt) ? [...thinking, ...fast] : [...fast, ...thinking]);
  const cloudSequence = preferredModel && prioritized.includes(preferredModel)
    ? [preferredModel, ...prioritized.filter((model) => model !== preferredModel)]
    : prioritized;
  const local = catalog.filter(isTrueLocalModel);
  return [...cloudSequence, ...local];
};

export const getAgentModelsForMode = (models: string[], mode: AgentMode): string[] => {
  const deduplicated = uniqueModels(models);
  if (mode === "auto") return getAutoModelSequence(deduplicated, "");
  if (mode === "thinking") return deduplicated.filter(isDocumentedThinkingAgentModel);
  if (mode === "fast") return deduplicated.filter(isDocumentedFastAgentModel);
  if (mode === "local") return deduplicated.filter(isTrueLocalModel);
  return [];
};

export const getAgentRequestModels = (
  models: string[],
  mode: AgentMode,
  selectedModel: string,
  prompt = "",
  preferSelectedModel = false,
): string[] => {
  const catalog = uniqueModels(models);
  if (mode === "auto") return getAutoModelSequence(catalog, prompt, preferSelectedModel ? selectedModel : "");
  if (!selectedModel || !catalog.includes(selectedModel)) return [];
  if (mode === "local") return isTrueLocalModel(selectedModel) ? [selectedModel] : [];
  const eligible = getAgentModelsForMode(catalog, mode);
  if (!eligible.includes(selectedModel)) return [];
  return [selectedModel, ...eligible.filter((model) => model !== selectedModel)];
};

export const buildModelScopedHistory = (
  messages: StoredConversationMessage[],
  currentModel: string,
): ScopedHistoryMessage[] => {
  const activeModel = currentModel.trim().toLowerCase();
  const history: ScopedHistoryMessage[] = [];
  for (const message of messages) {
    if (message.error) continue;
    if (message.role === "user") {
      history.push({ role: "user", content: message.content });
      continue;
    }
    // The actual responding model owns the reply; requestedModel is only a fallback attribution.
    const sourceModel = (message.model || message.requestedModel || "unknown model").trim();
    if (sourceModel.toLowerCase() === activeModel) {
      history.push({ role: "assistant", content: message.content });
    } else {
      history.push({
        role: "user",
        content: `[Shared conversation context from another AI model (${sourceModel}); this was not written by you.]\n${message.content}`,
      });
    }
  }
  return history;
};

export const getAgentMessagesStorageKey = (uid: string): string => `aiagent_messages_${encodeURIComponent(uid)}`;
export const getAgentPreferencesStorageKey = (uid: string): string => `aiagent_preferences_${encodeURIComponent(uid)}`;

export const parseAgentModeSettings = (value: string | null): AgentModeSettings => {
  if (!value) return { mode: "auto", model: "" };
  try {
    const parsed = JSON.parse(value) as Partial<AgentModeSettings>;
    const validModes: AgentMode[] = ["auto", "thinking", "fast", "local"];
    return {
      mode: validModes.includes(parsed.mode as AgentMode) ? parsed.mode as AgentMode : "auto",
      model: typeof parsed.model === "string" ? parsed.model : "",
    };
  } catch {
    return { mode: "auto", model: "" };
  }
};
