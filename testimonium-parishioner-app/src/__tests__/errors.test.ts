import { appErrorFromResponse, firebaseErrorToAppError } from "@/services/api/errors";

describe("application error normalization", () => {
  it("uses a safe status message for non-JSON backend errors", async () => {
    const error = await appErrorFromResponse(
      new Response("<html>server detail</html>", {
        status: 500,
        headers: { "content-type": "text/html" },
      })
    );
    expect(error.kind).toBe("SERVER");
    expect(error.message).toBe("The service is temporarily unavailable. Please try again.");
  });

  it("extracts backend JSON message when provided", async () => {
    const error = await appErrorFromResponse(
      new Response(JSON.stringify({ message: "Custom validation issue", code: "VALIDATION_FAILED" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );
    expect(error.kind).toBe("VALIDATION");
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toBe("Custom validation issue");
  });

  it("extracts Retry-After header on 429 rate limit responses", async () => {
    const error = await appErrorFromResponse(
      new Response(JSON.stringify({ message: "Rate limited" }), {
        status: 429,
        headers: { "content-type": "application/json", "Retry-After": "45" },
      })
    );
    expect(error.kind).toBe("RATE_LIMIT");
    expect(error.retryAfterMs).toBe(45000);
    expect(error.retryable).toBe(true);
  });

  it("maps Firebase credential errors without exposing Firebase internals", () => {
    expect(firebaseErrorToAppError({ code: "auth/invalid-credential" }).message).toBe(
      "The email address or password is incorrect."
    );
    expect(firebaseErrorToAppError({ code: "auth/wrong-password" }).message).toBe(
      "The email address or password is incorrect."
    );
    expect(firebaseErrorToAppError({ code: "auth/user-not-found" }).message).toBe(
      "The email address or password is incorrect."
    );
  });

  it("maps Firebase registration error codes safely", () => {
    const emailInUse = firebaseErrorToAppError({ code: "auth/email-already-in-use" });
    expect(emailInUse.kind).toBe("CONFLICT");
    expect(emailInUse.message).toContain("already exists");

    const weakPassword = firebaseErrorToAppError({ code: "auth/weak-password" });
    expect(weakPassword.kind).toBe("VALIDATION");
    expect(weakPassword.message).toContain("6 characters");

    const invalidEmail = firebaseErrorToAppError({ code: "auth/invalid-email" });
    expect(invalidEmail.kind).toBe("VALIDATION");
    expect(invalidEmail.message).toContain("valid email");
  });

  it("maps network and rate limit errors with retryable flag", () => {
    const netErr = firebaseErrorToAppError({ code: "auth/network-request-failed" });
    expect(netErr.kind).toBe("NETWORK");
    expect(netErr.retryable).toBe(true);
    expect(netErr.message).toContain("Firebase Authentication");
    expect(netErr.message).not.toContain("A network connection is required");

    const rateErr = firebaseErrorToAppError({ code: "auth/too-many-requests" });
    expect(rateErr.kind).toBe("RATE_LIMIT");
    expect(rateErr.retryable).toBe(true);
  });
});
