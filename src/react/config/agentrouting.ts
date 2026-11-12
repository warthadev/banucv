export const LOCAL_AGENT_MODEL = "mimo-v2.6:latest";
export const LOCAL_AGENT_MODEL_ALIAS = "openai-compatible-chat-0082e0a8-8fc6-41da-99d3-3c9f2f986404/mimo-v2.6:latest";

export const isLocalAgentModel = (model: string): boolean =>
  model.trim().toLowerCase().split("/").at(-1) === LOCAL_AGENT_MODEL;

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
  return /Agent runtime rate limit \(429\)/i.test(message) ||
    /Agent runtime temporarily unavailable \(503\)/i.test(message);
};

/** All chat traffic goes through the authenticated backend, including local models. */
export const resolveAgentModelRoute = (
  model: string,
  cloudApiBase: string,
): { apiBase: string; model: string } => ({ apiBase: cloudApiBase, model });
