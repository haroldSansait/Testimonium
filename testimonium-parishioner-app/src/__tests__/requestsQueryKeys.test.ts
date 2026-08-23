import { paymentKeys, requestKeys } from "../features/requests/queryKeys";

describe("Requests and Payment UID-Scoped Query Keys (Cross-Account Safety)", () => {
  it("scopes all request keys by user ID", () => {
    const userA = "user_alpha_123";
    const userB = "user_beta_456";

    expect(requestKeys.all(userA)).toEqual(["requests", userA]);
    expect(requestKeys.all(userB)).toEqual(["requests", userB]);
    expect(requestKeys.all(userA)).not.toEqual(requestKeys.all(userB));

    expect(requestKeys.lists(userA)).toEqual(["requests", userA, "list"]);
    expect(requestKeys.list(userA, { status: "PENDING" })).toEqual([
      "requests",
      userA,
      "list",
      { status: "PENDING" },
    ]);

    expect(requestKeys.detail(userA, 42)).toEqual(["requests", userA, "detail", "42"]);
    expect(requestKeys.tracking(userA, "SR-2026-000001")).toEqual([
      "requests",
      userA,
      "tracking",
      "SR-2026-000001",
    ]);

    expect(
      requestKeys.requirements(userA, {
        documentType: "BAPTISMAL_CERTIFICATE",
        parishId: 2,
      })
    ).toEqual([
      "requests",
      userA,
      "requirements",
      { documentType: "BAPTISMAL_CERTIFICATE", parishId: "2" },
    ]);
  });

  it("scopes payment configuration keys by user ID and request ID", () => {
    const userA = "user_alpha_123";
    const userB = "user_beta_456";

    expect(paymentKeys.configuration(userA, 10)).toEqual([
      "payments",
      userA,
      "configuration",
      { requestId: "10" },
    ]);

    expect(paymentKeys.configuration(userB, 10)).toEqual([
      "payments",
      userB,
      "configuration",
      { requestId: "10" },
    ]);

    expect(paymentKeys.configuration(userA, 10)).not.toEqual(
      paymentKeys.configuration(userB, 10)
    );
  });

  it("handles anonymous/empty fallback UID safely without crashing", () => {
    expect(requestKeys.all(null)).toEqual(["requests", "anon"]);
    expect(requestKeys.detail(null, 5)).toEqual(["requests", "anon", "detail", "5"]);
    expect(paymentKeys.all(undefined)).toEqual(["payments", "anon"]);
  });
});
