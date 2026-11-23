export const LOCAL_AGENT_MODEL_PREFIX = "local:";

/** Model lokal di-expose sebagai "local:<nama-file-gguf>" di katalog model. */
export const isLocalAgentModel = (model: string): boolean =>
  model.trim().toLowerCase().startsWith(LOCAL_AGENT_MODEL_PREFIX);

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
