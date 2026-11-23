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

export const canSendAgentModel = (isConfigured: boolean, selectedModelIsLocal: boolean): boolean =>
  isConfigured && !selectedModelIsLocal;
