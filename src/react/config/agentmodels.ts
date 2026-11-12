export interface AgentModelCapabilities {
  reasoning?: boolean;
  thinkingCanDisable?: boolean;
  vision?: boolean;
  tools?: boolean;
  contextLength?: number;
  maxOutputTokens?: number;
}

export interface AgentModel {
  id: string;
  capabilities?: AgentModelCapabilities;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const findModelEntries = (value: unknown, depth = 0): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value) || depth >= 3) return [];

  const entries: unknown[][] = [];
  for (const key of ["data", "models", "result"]) {
    if (key in value) entries.push(findModelEntries(value[key], depth + 1));
  }
  return entries.find((candidate) => candidate.length > 0) ?? [];
};

const readBoolean = (
  sources: Record<string, unknown>[],
  keys: string[],
): boolean | undefined => {
  for (const source of sources) {
    for (const key of keys) {
      if (typeof source[key] === "boolean") return source[key] as boolean;
    }
  }
  return undefined;
};

const readLimit = (
  sources: Record<string, unknown>[],
  keys: string[],
): number | undefined => {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
    }
  }
  return undefined;
};

export const extractAgentModels = (payload: unknown): AgentModel[] => {
  const models: AgentModel[] = [];
  const seen = new Set<string>();
  for (const entry of findModelEntries(payload)) {
    const rawId = typeof entry === "string"
      ? entry
      : isRecord(entry)
        ? (typeof entry.id === "string" && entry.id.trim() ? entry.id : entry.name)
        : undefined;
    if (typeof rawId !== "string") continue;
    const id = rawId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const record = isRecord(entry) ? entry : undefined;
    const nested = record && isRecord(record.capabilities) ? record.capabilities : undefined;
    const limits = record && isRecord(record.limits) ? record.limits : undefined;
    const sources = [nested, limits, record].filter(
      (source): source is Record<string, unknown> => Boolean(source),
    );
    const capabilities: AgentModelCapabilities = {};
    const reasoning = readBoolean(sources, ["reasoning"]);
    const thinkingCanDisable = readBoolean(sources, ["thinkingCanDisable", "thinking_can_disable"]);
    const vision = readBoolean(sources, ["vision"]);
    const tools = readBoolean(sources, ["tools"]);
    const contextLength = readLimit(sources, ["contextLength", "context_length", "contextWindow", "context_window"]);
    const maxOutputTokens = readLimit(sources, ["maxOutputTokens", "max_output_tokens", "maxCompletionTokens", "max_completion_tokens"]);
    if (reasoning !== undefined) capabilities.reasoning = reasoning;
    if (thinkingCanDisable !== undefined) capabilities.thinkingCanDisable = thinkingCanDisable;
    if (vision !== undefined) capabilities.vision = vision;
    if (tools !== undefined) capabilities.tools = tools;
    if (contextLength !== undefined) capabilities.contextLength = contextLength;
    if (maxOutputTokens !== undefined) capabilities.maxOutputTokens = maxOutputTokens;
    models.push({ id, ...(Object.keys(capabilities).length ? { capabilities } : {}) });
  }
  return models;
};

export const extractAgentModelIds = (payload: unknown): string[] =>
  extractAgentModels(payload).map((model) => model.id);
