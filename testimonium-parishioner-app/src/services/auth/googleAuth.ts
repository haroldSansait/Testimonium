import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { getGoogleWebClientId, isGoogleSignInEnabled } from "@/config/environment";
import { AppError } from "@/services/api/errors";
import { devDiagnostic, safeErrorDetails } from "@/services/devDiagnostics";

let isConfigured = false;

export const configureGoogleSignIn = () => {
  if (isConfigured) return;
  const webClientId = getGoogleWebClientId();
  if (!webClientId) return;

  try {
    GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
    });
    isConfigured = true;
  } catch {
    // Adapter configuration will be safely retried when webClientId is provided
  }
};

export const isGoogleAuthAvailable = (): boolean => {
  return isGoogleSignInEnabled();
};

export const signInWithGoogleNative = async (): Promise<string> => {
  if (!isGoogleAuthAvailable()) {
    throw new AppError({
      kind: "FORBIDDEN",
      message: "Google Sign-In is not currently enabled on this device.",
    });
  }

  configureGoogleSignIn();

  try {
    devDiagnostic("GoogleAuth", "Google native sign-in started");
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Local signOut before user-initiated login clears cached account for chooser prompt (does not revoke server access)
    try {
      await GoogleSignin.signOut();
    } catch {
      // Non-critical local session reset
    }

    const response = await GoogleSignin.signIn();
    // Support both modern v16+ response.data.idToken and legacy response.idToken
    const idToken =
      typeof response === "object" && response !== null && "data" in response && response.data
        ? (response.data as { idToken?: string }).idToken
        : (response as { idToken?: string }).idToken;

    devDiagnostic("GoogleAuth", "Google native sign-in returned", {
      idTokenPresent: Boolean(idToken),
    });

    if (!idToken) {
      throw new AppError({
        kind: "AUTH",
        message: "Google did not return an authentication token. Please try again.",
      });
    }

    return idToken;
  } catch (error) {
    if (error instanceof AppError) throw error;

    const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";

    if (code === statusCodes.SIGN_IN_CANCELLED || code === "12501" || code === "13") {
      devDiagnostic("GoogleAuth", "Google native sign-in cancelled", { code });
      throw new AppError({
        kind: "CANCELLED",
        message: "Sign-in was cancelled.",
      });
    }

    if (code === statusCodes.IN_PROGRESS) {
      devDiagnostic("GoogleAuth", "Google native sign-in already in progress", { code });
      throw new AppError({
        kind: "AUTH",
        message: "Google Sign-In is already in progress.",
      });
    }

    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      devDiagnostic("GoogleAuth", "Google Play Services unavailable", { code });
      throw new AppError({
        kind: "AUTH",
        message: "Google Play Services is not available or outdated on this device.",
      });
    }

    const normalized = new AppError({
      kind: "AUTH",
      code,
      message: "Could not complete Google Sign-In. Please check your configuration.",
    });
    devDiagnostic("GoogleAuth", "Google native sign-in failed", safeErrorDetails(normalized));
    throw normalized;
  }
};

export const signOutGoogleNative = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-destructive: ignore if not signed in
  }
};
