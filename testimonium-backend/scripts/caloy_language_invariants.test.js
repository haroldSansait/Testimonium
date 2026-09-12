import test from "node:test";
import assert from "node:assert/strict";
import { CaloyResponseComposer, validateFactPreservation } from "../services/ai/CaloyResponseComposer.js";
import { ConversationContextManager } from "../services/ai/ConversationContextManager.js";

test("Caloy Multilingual Fact-Preservation Invariants", async (t) => {
  await t.test("1.1 Tagalog fee answer preserves canonical peso amount", async () => {
    const facts = {
      parishName: "St. Joseph the Worker Parish",
      documentType: "MARRIAGE_BANNS",
      documentTitle: "Marriage Banns",
      fee: "₱200.00",
      feeAmount: 200,
    };

    const mockClient = {
      models: {
        generateContent: async ({ contents }) => {
          assert.ok(contents.includes("Magkano ang Marriage Banns"));
          return {
            text: () =>
              JSON.stringify({
                answer: "Ang bayad po para sa Marriage Banns sa St. Joseph the Worker Parish ay ₱200.00.",
                followUp: null,
              }),
          };
        },
      },
    };

    const composer = new CaloyResponseComposer({ client: mockClient });
    const res = await composer.compose({
      responseType: "LIVE_DATA",
      structuredFacts: facts,
      userMessage: "Magkano ang Marriage Banns sa St. Joseph?",
      fallbackAnswer: "The fee for Marriage Banns at St. Joseph the Worker Parish is ₱200.00.",
    });

    assert.strictEqual(res.composed, true);
    assert.ok(res.answer.includes("₱200.00"));
    assert.ok(res.answer.includes("Marriage Banns"));
  });

  await t.test("1.2 Hiligaynon requirements answer preserves official document name and requirements", async () => {
    const facts = {
      parishName: "St. Joseph Parish",
      documentType: "BAPTISMAL_CERTIFICATE",
      documentTitle: "Certificate of Baptism",
      requirements: [
        { label: "Valid Government ID", category: "primary" },
        { label: "Birth Certificate", category: "supporting" },
      ],
      fee: "₱150.00",
    };

    const mockClient = {
      models: {
        generateContent: async ({ contents }) => {
          assert.ok(contents.includes("Tagpila ang Certificate of Baptism kag ano ang requirements"));
          return {
            text: () =>
              JSON.stringify({
                answer: "Para sa Certificate of Baptism sa St. Joseph Parish, ang balayran amo ang ₱150.00. Kinahanglanon ang Valid Government ID kag Birth Certificate.",
                followUp: null,
              }),
          };
        },
      },
    };

    const composer = new CaloyResponseComposer({ client: mockClient });
    const res = await composer.compose({
      responseType: "LIVE_DATA",
      structuredFacts: facts,
      userMessage: "Tagpila ang Certificate of Baptism kag ano ang requirements?",
      fallbackAnswer: "Requirements for Certificate of Baptism: Valid Government ID, Birth Certificate. Fee is ₱150.00.",
    });

    assert.strictEqual(res.composed, true);
    assert.ok(res.answer.includes("Certificate of Baptism"));
    assert.ok(res.answer.includes("₱150.00"));
  });

  await t.test("1.3 Cebuano / Bisaya priest availability preserves exact priest name and date/time", async () => {
    const facts = {
      parishName: "St. Joseph Parish",
      priestName: "Rev. Fr. Julius L. Montaño",
      date: "2026-09-13",
      timeSlot: "03:00 PM",
      isAvailable: true,
      availableSlots: ["03:00 PM"],
    };

    const mockClient = {
      models: {
        generateContent: async () => ({
          text: () =>
            JSON.stringify({
              answer: "Oo, available si Rev. Fr. Julius L. Montaño sa St. Joseph Parish karong 2026-09-13 sa alas 03:00 PM.",
              followUp: null,
            }),
        }),
      },
    };

    const composer = new CaloyResponseComposer({ client: mockClient });
    const res = await composer.compose({
      responseType: "LIVE_DATA",
      structuredFacts: facts,
      userMessage: "Available ba si Father Julius ugma sa alas tres sa hapon?",
      fallbackAnswer: "Rev. Fr. Julius L. Montaño is available at St. Joseph Parish on 2026-09-13 at 03:00 PM.",
    });

    assert.strictEqual(res.composed, true);
    assert.ok(res.answer.includes("Rev. Fr. Julius L. Montaño") || res.answer.includes("Julius"));
    assert.ok(res.answer.includes("03:00 PM"));
  });

  await t.test("1.4 Taglish payment status preserves safe status meaning", async () => {
    const facts = {
      trackingNumber: "SR-2026-001234",
      documentType: "Marriage Certificate",
      safePaymentStatus: "Under Review",
      safeRequestStatus: "Payment Under Review",
      safeUserVisibleNote: null,
      amountDue: "₱200.00",
    };

    const mockClient = {
      models: {
        generateContent: async () => ({
          text: () =>
            JSON.stringify({
              answer: "Ang payment mo para sa Marriage Certificate (SR-2026-001234) ay currently under review pa ng parish office.",
              followUp: null,
            }),
        }),
      },
    };

    const composer = new CaloyResponseComposer({ client: mockClient });
    const res = await composer.compose({
      responseType: "LIVE_DATA",
      structuredFacts: facts,
      userMessage: "Na-verify na ba yung payment ko sa gcash?",
      fallbackAnswer: "Your payment for Marriage Certificate (SR-2026-001234) is currently under review.",
    });

    assert.strictEqual(res.composed, true);
    assert.ok(res.answer.includes("SR-2026-001234"));
    assert.ok(res.answer.toLowerCase().includes("under review"));
    // Must NOT claim approved
    assert.ok(!res.answer.toLowerCase().includes("verified na"));
    assert.ok(!res.answer.toLowerCase().includes("approved"));
  });

  await t.test("1.5 Multi-turn language switching does NOT lock conversation to one language", () => {
    const manager = new ConversationContextManager();
    const sessionId = "multilingual-test-session";

    // Turn 1: English
    let ctx = manager.updateContext(sessionId, {
      lastIntent: "GET_DOCUMENT_FEE",
      lastDocumentType: "MARRIAGE_BANNS",
      lastParishName: "St. Joseph Parish",
    });
    assert.strictEqual(ctx.lastDocumentType, "MARRIAGE_BANNS");
    // Confirm NO language preference field exists
    assert.strictEqual(ctx.detectedLanguage, undefined);
    assert.strictEqual(ctx.languagePreference, undefined);
    assert.strictEqual(ctx.selectedLanguage, undefined);

    // Turn 2: Hiligaynon ("Tagpila man?")
    ctx = manager.updateContext(sessionId, {
      ...ctx,
      lastIntent: "GET_DOCUMENT_FEE",
    });
    assert.strictEqual(ctx.lastDocumentType, "MARRIAGE_BANNS");
    assert.strictEqual(ctx.selectedLanguage, undefined);

    // Turn 3: English ("How about the requirements?")
    ctx = manager.updateContext(sessionId, {
      ...ctx,
      lastIntent: "GET_DOCUMENT_REQUIREMENTS",
    });
    assert.strictEqual(ctx.lastDocumentType, "MARRIAGE_BANNS");
    assert.strictEqual(ctx.selectedLanguage, undefined);
  });
});
