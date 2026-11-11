export interface RouterAuthModalState {
  isLoading: boolean;
  userUid: string | null;
  isConfigured: boolean;
}

export const shouldShowRouterAuthModal = ({
  isLoading,
  userUid,
  isConfigured,
}: RouterAuthModalState): boolean => !isLoading && Boolean(userUid) && !isConfigured;
