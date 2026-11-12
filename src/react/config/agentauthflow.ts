export interface RouterAuthModalState {
  isLoading: boolean;
  userUid: string | null;
  isConfigured: boolean;
  hasLocalModels: boolean;
  selectedModelIsLocal: boolean;
}

export const shouldShowRouterAuthModal = ({
  isLoading,
  userUid,
  isConfigured,
  hasLocalModels,
  selectedModelIsLocal,
}: RouterAuthModalState): boolean =>
  !isLoading && Boolean(userUid) && !isConfigured && !(hasLocalModels && selectedModelIsLocal);

export const canSendAgentModel = (isConfigured: boolean, selectedModelIsLocal: boolean): boolean =>
  isConfigured || selectedModelIsLocal;
