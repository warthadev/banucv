import { LOCAL_AGENT_MODEL } from "./agentrouting.ts";

export type AgentMode = "auto" | "thinking" | "fast" | "local";
export type AgentModeSettings = { mode: AgentMode; model: string };
export type ScopedHistoryMessage = { role: "user" | "assistant"; content: string };
type StoredConversationMessage = {
  role: "user" | "bot";
  content: string;
  files?: { name: string; content: string }[];
  model?: string;
  requestedModel?: string;
  error?: boolean;
};

// Provider namespaces (including user-configured providers) are not capabilities.
// Normalize only for classification; catalog IDs are always returned/routed unchanged.
const normalizedId = (model: string): string =>
  (model.trim().toLowerCase().split("/").at(-1) || "").replace(/:free$/, "");

// Local is an inference category, not a transport switch. The configured Mimo
// identity may be exposed through a per-user 9Router provider namespace. Keep
// the full catalog ID for authorization and requests; never synthesize a bare ID.
export const isLocalInferenceAgentModel = (model: string): boolean =>
  (model.trim().toLowerCase().split("/").at(-1) || "") === LOCAL_AGENT_MODEL.toLowerCase();

export const isVerifiedFreeAgentModel = (model: string): boolean => {
  const normalized = model.trim().toLowerCase();
  return normalized === "openrouter/openrouter/free" ||
    (normalized.startsWith("openrouter/") && normalized.endsWith(":free"));
};

// /agent/models currently exposes IDs, not the upstream capabilities object.
// These reasoning families were verified against 9Router catalog metadata. Match
// families/explicit capability markers, not a vendor-only list of exact versions
// or user-specific provider IDs. Unknown families remain unclassified.
const thinkingFamilies = [
  /^gemini-3(?:\.\d+)?-(?:pro|flash)(?:-|$)/,
  /^nemotron-3(?:[.-]|$)/,
  /^mimo-v2(?:[.:-]|$)/,
  /^minimax-m(?:2|3)(?:[.-]|$)/,
];

export const isDocumentedThinkingAgentModel = (model: string): boolean => {
  if (isLocalInferenceAgentModel(model)) return false;
  const id = normalizedId(model);
  return thinkingFamilies.some((family) => family.test(id)) ||
    /(?:^|[-_.])(?:thinking|reasoning|reasoner)(?:[-_.:]|$)/.test(id);
};

export const isDocumentedFastAgentModel = (model: string): boolean => {
  if (isLocalInferenceAgentModel(model)) return false;
  const id = normalizedId(model);
  // Fast means direct-response or explicitly speed-optimized, not a latency
  // guarantee. The free router and Dots Note advertise reasoning:false; Flash
  // and highspeed variants can also be reasoning-capable and belong in both modes.
  return model.trim().toLowerCase() === "openrouter/openrouter/free" ||
    /^dots-3-note(?:-|$)/.test(id) ||
    /(?:^|[-_.])(?:flash|fast|highspeed|turbo|instant)(?:[-_.:]|$)/.test(id);
};

export const getAgentModelClassification = (model: string): string => {
  if (isLocalInferenceAgentModel(model)) return "Local";
  const tags = [
    ...(isDocumentedThinkingAgentModel(model) ? ["Thinking"] : []),
    ...(isDocumentedFastAgentModel(model) ? ["Fast"] : []),
  ];
  return tags.length ? tags.join(" · ") : "Other / unclassified";
};

export const getAgentModeForModelSelection = (mode: AgentMode, model: string): AgentMode =>
  isLocalInferenceAgentModel(model) ? "local" : mode;

const requestNeedsThinking = (prompt: string): boolean => {
  const normalized = prompt.toLowerCase();
  return normalized.length > 320 || /\b(analy[sz]e|reason|step by step|compare|plan|debug|design|prove|derive|architecture|review|audit|explain in detail|analisis|jelaskan|bandingkan|rencanakan|buktikan|rancang|arsitektur|telaah|langkah demi langkah|hitung kompleks)\b/.test(normalized);
};

const uniqueModels = (models: string[]): string[] => [...new Set(models)];

const getAutoModelSequence = (models: string[], prompt: string, preferredModel = ""): string[] => {
  const catalog = uniqueModels(models);
  const cloud = catalog.filter((model) =>
    !isLocalInferenceAgentModel(model) && (isDocumentedThinkingAgentModel(model) || isDocumentedFastAgentModel(model))
  );
  const fast = cloud.filter(isDocumentedFastAgentModel);
  const thinking = cloud.filter(isDocumentedThinkingAgentModel);
  const prioritized = uniqueModels(requestNeedsThinking(prompt) ? [...thinking, ...fast] : [...fast, ...thinking]);
  const cloudSequence = preferredModel && prioritized.includes(preferredModel)
    ? [preferredModel, ...prioritized.filter((model) => model !== preferredModel)]
    : prioritized;
  // Only an existing account catalog route can be Local. It never starts an
  // Auto request and keeps its original provider-qualified ID as the last fallback.
  if (!cloudSequence.length) return [];
  return [...cloudSequence, ...catalog.filter(isLocalInferenceAgentModel)];
};

export const getAgentModelsForMode = (models: string[], mode: AgentMode): string[] => {
  const deduplicated = uniqueModels(models);
  if (mode === "auto") return getAutoModelSequence(deduplicated, "");
  if (mode === "thinking") return deduplicated.filter(isDocumentedThinkingAgentModel);
  if (mode === "fast") return deduplicated.filter(isDocumentedFastAgentModel);
  if (mode === "local") return deduplicated.filter(isLocalInferenceAgentModel);
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
  if (mode === "local") return isLocalInferenceAgentModel(selectedModel) ? [selectedModel] : [];
  const eligible = getAgentModelsForMode(catalog, mode);
  if (!eligible.includes(selectedModel)) return [];
  return [selectedModel, ...eligible.filter((model) => model !== selectedModel)];
};

export const formatAgentFileContext = (files: { name: string; content: string }[]): string => {
  if (!files.length) return "";
  const formatted = files.map((file) => {
    const longestFence = (file.content.match(/`+/g) || []).reduce((longest, fence) => Math.max(longest, fence.length), 0);
    const fence = "`".repeat(Math.max(3, longestFence + 1));
    return `File: ${file.name}\n${fence}\n${file.content}\n${fence}`;
  });
  return `\n\n--- Context from uploaded files ---\n\n${formatted.join("\n\n")}\n\n--- End of context from uploaded files ---\n`;
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
      history.push({ role: "user", content: `${message.content}${formatAgentFileContext(message.files || [])}` });
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
    const mode = validModes.includes(parsed.mode as AgentMode) ? parsed.mode as AgentMode : "auto";
    const model = typeof parsed.model === "string" ? parsed.model : "";
    return {
      mode,
      // Old Auto preferences must not visually select Local while routing cloud first.
      model: mode === "auto" && isLocalInferenceAgentModel(model) ? "" : model,
    };
  } catch {
    return { mode: "auto", model: "" };
  }
};
