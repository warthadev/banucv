export interface RouterAuthModalState {
  isLoading: boolean;
  userUid: string | null;
  isConfigured: boolean;
  configurationError?: string | null;
}

export const shouldShowRouterAuthModal = ({
  isLoading,
  userUid,
  isConfigured,
  configurationError,
}: RouterAuthModalState): boolean =>
  !isLoading && Boolean(userUid) && !isConfigured && !configurationError;

// Model lokal tidak butuh key OpenRouter: chat-nya lewat worker Kaggle milik sendiri.
export const canSendAgentModel = (isConfigured: boolean, selectedModelIsLocal: boolean): boolean =>
  selectedModelIsLocal || isConfigured;
