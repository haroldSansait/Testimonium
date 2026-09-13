import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chatbotQuerySchema } from "../validators/chatbotSchemas.js";

const VALID_UUID = "c3d3a0e1-4567-489a-bcde-0123456789ab";

describe("Mobile Caloy Request Contract vs Backend Production Validator", () => {
  it("passes validation for fresh normal question 'Hello caloy' with All-Parishes context", () => {
    const payload = {
      question: "Hello caloy",
      sessionId: VALID_UUID,
      selectedParishId: null,
    };

    const parsed = chatbotQuerySchema.parse(payload);
    assert.equal(parsed.question, "Hello caloy");
    assert.equal(parsed.sessionId, VALID_UUID);
    assert.equal(parsed.selectedParishId, null);
    assert.equal(parsed.structuredClarification, undefined);
    assert.equal(parsed.conversationContext, undefined);
  });

  it("passes validation for fresh question 'What are the parishes here' with specific parish ID", () => {
    const payload = {
      question: "What are the parishes here",
      sessionId: VALID_UUID,
      selectedParishId: 4,
    };

    const parsed = chatbotQuerySchema.parse(payload);
    assert.equal(parsed.question, "What are the parishes here");
    assert.equal(parsed.sessionId, VALID_UUID);
    assert.equal(parsed.selectedParishId, 4);
  });

  it("passes validation with normalized structuredClarification (only backend fields)", () => {
    const payload = {
      question: "Baptism requirements",
      sessionId: VALID_UUID,
      selectedParishId: 2,
      structuredClarification: {
        toolId: "lookupRequirements",
        originalIntent: "GET_DOC_REQUIREMENTS",
        originalQuestion: "What do I need for baptism?",
        collected: { docType: "BAPTISM" },
        missing: "parishId",
        nextRequired: "parishId",
      },
    };

    const parsed = chatbotQuerySchema.parse(payload);
    assert.equal(parsed.question, "Baptism requirements");
    assert.equal(parsed.structuredClarification?.toolId, "lookupRequirements");
    assert.equal(parsed.structuredClarification?.missing, "parishId");
  });

  it("passes validation with normalized conversationContext (only backend fields)", () => {
    const payload = {
      question: "How much is it?",
      sessionId: VALID_UUID,
      selectedParishId: 1,
      conversationContext: {
        lastIntent: "DOC_FEE",
        lastParishId: 1,
        lastParishName: "Cathedral",
        lastDocumentType: "BAPTISMAL_CERTIFICATE",
        lastScheduleEvent: null,
        lastDatePhrase: null,
        lastResponseType: "LIVE_DATA",
      },
    };

    const parsed = chatbotQuerySchema.parse(payload);
    assert.equal(parsed.conversationContext?.lastIntent, "DOC_FEE");
    assert.equal(parsed.conversationContext?.lastParishId, 1);
  });

  it("rejects non-UUID sessionId (the previous mobile bug)", () => {
    const badPayload = {
      question: "Hello caloy",
      sessionId: "mob_1726202400000_abc123",
      selectedParishId: null,
    };

    assert.throws(
      () => chatbotQuerySchema.parse(badPayload),
      (err) => {
        const issue = (err.errors || err.issues || [])[0];
        assert.equal(issue.path[0], "sessionId");
        assert.match(issue.message, /Session ID must be a valid UUID/);
        return true;
      }
    );
  });

  it("rejects selectedParishId = 0 (positive integer required)", () => {
    const badPayload = {
      question: "Hello caloy",
      sessionId: VALID_UUID,
      selectedParishId: 0,
    };

    assert.throws(
      () => chatbotQuerySchema.parse(badPayload),
      (err) => {
        const issue = (err.errors || err.issues || [])[0];
        assert.equal(issue.path[0], "selectedParishId");
        assert.match(issue.message, /selectedParishId must be a positive integer/);
        return true;
      }
    );
  });

  it("rejects unknown top-level fields due to strict() schema guard", () => {
    const badPayload = {
      question: "Hello caloy",
      sessionId: VALID_UUID,
      selectedParishId: null,
      userId: "parishioner_123", // Forbidden client field
    };

    assert.throws(
      () => chatbotQuerySchema.parse(badPayload),
      (err) => {
        const issue = (err.errors || err.issues || [])[0];
        assert.match(issue.message, /Unrecognized key|Unknown fields/);
        return true;
      }
    );
  });
});
