import { appErrorFromResponse, firebaseErrorToAppError } from "@/services/api/errors";

describe("application error normalization", () => {
  it("uses a safe status message for non-JSON backend errors", async () => {
    const error = await appErrorFromResponse(new Response("<html>server detail</html>", { status: 500, headers: { "content-type": "text/html" } }));
    expect(error.kind).toBe("SERVER");
    expect(error.message).toBe("The service is temporarily unavailable. Please try again.");
  });
  it("maps Firebase credential errors without exposing Firebase internals", () => {
    expect(firebaseErrorToAppError({ code: "auth/invalid-credential" }).message).toBe("The email address or password is incorrect.");
  });
});