export const LOCAL_AGENT_MODEL = "mimo-v2.6:latest";
export const LOCAL_AGENT_MODEL_ALIAS = "openai-compatible-chat-0082e0a8-8fc6-41da-99d3-3c9f2f986404/mimo-v2.6:latest";

export const isLocalAgentModel = (model: string): boolean => {
  const normalized = model.trim().toLowerCase();
  return normalized === LOCAL_AGENT_MODEL || normalized === LOCAL_AGENT_MODEL_ALIAS;
};

export const resolveAgentModelRoute = (
  model: string,
  cloudApiBase: string,
  localApiBase: string,
): { apiBase: string; model: string } => {
  // Only the verified local identifiers use the VM; all other providers stay unchanged.
  if (isLocalAgentModel(model)) {
    return { apiBase: localApiBase, model: LOCAL_AGENT_MODEL };
  }
  return { apiBase: cloudApiBase, model };
};
