type ModelEntry = string | { id?: unknown; name?: unknown };
type ModelPayload = ModelEntry[] | { data?: unknown; models?: unknown; result?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const findModelEntries = (value: unknown, depth = 0): ModelEntry[] => {
  if (Array.isArray(value)) return value as ModelEntry[];
  if (!isRecord(value) || depth >= 3) return [];

  const entries: ModelEntry[][] = [];
  for (const key of ["data", "models", "result"]) {
    if (key in value) entries.push(findModelEntries(value[key], depth + 1));
  }
  return entries.find((candidate) => candidate.length > 0) ?? [];
};

export const extractAgentModelIds = (payload: ModelPayload | unknown): string[] => {
  const entries = findModelEntries(payload);
  const models: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const rawId = typeof entry === "string"
      ? entry
      : isRecord(entry)
        ? (typeof entry.id === "string" && entry.id.trim() ? entry.id : entry.name)
        : undefined;
    if (typeof rawId !== "string") continue;
    const id = rawId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push(id);
  }
  return models;
};
