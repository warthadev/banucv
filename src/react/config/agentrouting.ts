// AI Local runs on the Kaggle GPU worker. There is no placeholder model
// name anymore: the worker reports the model by its real GGUF filename
// (e.g. "model-Q4_K_M.gguf"), and the local chat path falls back to the
// "ai-local" sentinel. Both are the local model.
export const isLocalAgentModel = (model: string): boolean => {
  const normalized = model.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "ai-local") return true;
  return normalized.endsWith(".gguf");
};

export const shouldRetryWithNextAgentModel = (
  model: string,
  isRetryableFailure: boolean,
  modelIndex: number,
  modelCount: number,
): boolean => !isLocalAgentModel(model) && isRetryableFailure && modelIndex < modelCount - 1;

export const isRetryableAgentAvailabilityError = (error: unknown): boolean => {
  const message = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "";
  return /Provider rate limit \(429\)/i.test(message) ||
    /Agent runtime rate limit \(429\)/i.test(message) ||
    /Agent runtime temporarily unavailable \(503\)/i.test(message);
};

/** All chat traffic goes through the authenticated backend. */
export const resolveAgentModelRoute = (
  model: string,
  cloudApiBase: string,
): { apiBase: string; model: string } => ({ apiBase: cloudApiBase, model });
