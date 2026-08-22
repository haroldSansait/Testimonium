export const navigateBackOrReplace = (
  canGoBack: () => boolean,
  goBack: () => void,
  replaceFallback: () => void
) => {
  if (canGoBack()) {
    goBack();
    return;
  }

  replaceFallback();
};
