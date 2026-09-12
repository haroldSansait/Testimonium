import { validateFactPreservation, isDuplicateOrRedundantFollowUp, isLanguageConsistent, impliesBookingCapability } from "./CaloyResponseComposer.js";
import { TOOL_IDS } from "./liveTools/liveToolSchemas.js";

/**
 * Fake Caloy Response Composer for Testing
 *
 * Simulates response composition without external Gemini calls.
 * Records call parameters for verification of private boundaries and payload shapes.
 */
export class FakeCaloyResponseComposer {
  constructor() {
    this.calls = [];
    this.customResult = null;
    this.customGenerator = null;
    this.simulateError = null;
    this.allowedCapabilities = new Set(Object.values(TOOL_IDS));
  }

  reset() {
    this.calls = [];
    this.customResult = null;
    this.customGenerator = null;
    this.simulateError = null;
  }

  setMockResult(result) {
    this.customResult = result;
  }

  setMockGenerator(fn) {
    this.customGenerator = fn;
  }

  setSimulateError(err) {
    this.simulateError = err;
  }

  async compose({
    responseType = "LIVE_DATA",
    structuredFacts = null,
    conversationContext = null,
    capabilityHints = [],
    userMessage = "",
    fallbackAnswer = "",
    signal = null,
  }) {
    this.calls.push({
      responseType,
      structuredFacts: structuredFacts ? JSON.parse(JSON.stringify(structuredFacts)) : null,
      conversationContext: conversationContext ? { ...conversationContext } : null,
      capabilityHints: [...capabilityHints],
      userMessage,
      fallbackAnswer,
    });

    if (this.simulateError) {
      const err = this.simulateError;
      const is429 =
        err.status === 429 ||
        err.statusCode === 429 ||
        err.code === "RESOURCE_EXHAUSTED" ||
        err.code === "AI_PROVIDER_RATE_LIMITED" ||
        String(err.message || "").toLowerCase().includes("quota") ||
        String(err.message || "").toLowerCase().includes("rate limit");

      const isTimeout = err.code === "COMPOSER_TIMEOUT" || err.message?.includes("TIMEOUT");

      return {
        answer: fallbackAnswer,
        composed: false,
        fallbackReason: is429 ? "PROVIDER_429" : isTimeout ? "TIMEOUT" : (err.code || "COMPOSER_ERROR"),
      };
    }

    if (this.customResult !== null) {
      // Validate fact preservation on custom output if requested
      const isValid = validateFactPreservation({
        structuredFacts,
        composedAnswer: this.customResult.answer,
        responseType,
      });

      if (!isValid) {
        return {
          answer: fallbackAnswer,
          composed: false,
          fallbackReason: "FACT_MUTATION_DETECTED",
        };
      }

      if (impliesBookingCapability(this.customResult.answer)) {
        return {
          answer: fallbackAnswer,
          composed: false,
          fallbackReason: "PROHIBITED_BOOKING_CLAIM",
        };
      }

      let finalAnswer = this.customResult.answer;
      let followUpCap = null;
      if (this.customResult.followUp && this.allowedCapabilities.has(this.customResult.followUp.capability)) {
        const text = (this.customResult.followUp.text || "").trim();
        const isDuplicate = isDuplicateOrRedundantFollowUp(this.customResult.answer, text);
        const isConsistent = isLanguageConsistent(this.customResult.answer, text);
        const isBookingClaim = impliesBookingCapability(text);

        if (!isDuplicate && isConsistent && !isBookingClaim) {
          followUpCap = this.customResult.followUp.capability;
          if (text) {
            finalAnswer = `${finalAnswer}\n\n${text}`;
          }
        }
      }

      return {
        answer: finalAnswer,
        composed: true,
        fallbackReason: null,
        followUpCapability: followUpCap,
      };
    }

    if (this.customGenerator) {
      const genResult = await this.customGenerator({
        responseType,
        structuredFacts,
        conversationContext,
        capabilityHints,
        userMessage,
        fallbackAnswer,
      });

      const isValid = validateFactPreservation({
        structuredFacts,
        composedAnswer: genResult.answer,
        responseType,
      });

      if (!isValid) {
        return {
          answer: fallbackAnswer,
          composed: false,
          fallbackReason: "FACT_MUTATION_DETECTED",
        };
      }

      if (impliesBookingCapability(genResult.answer)) {
        return {
          answer: fallbackAnswer,
          composed: false,
          fallbackReason: "PROHIBITED_BOOKING_CLAIM",
        };
      }

      let finalAnswer = genResult.answer;
      let followUpCap = null;
      if (genResult.followUp && this.allowedCapabilities.has(genResult.followUp.capability)) {
        const text = (genResult.followUp.text || "").trim();
        const isDuplicate = isDuplicateOrRedundantFollowUp(genResult.answer, text);
        const isConsistent = isLanguageConsistent(genResult.answer, text);
        const isBookingClaim = impliesBookingCapability(text);

        if (!isDuplicate && isConsistent && !isBookingClaim) {
          followUpCap = genResult.followUp.capability;
          if (text) {
            finalAnswer = `${finalAnswer}\n\n${text}`;
          }
        }
      }

      return {
        answer: finalAnswer,
        composed: true,
        fallbackReason: null,
        followUpCapability: followUpCap,
      };
    }

    // Default simulation: return fallbackAnswer as base, or generate natural phrasing preserving facts
    if (responseType === "WHO_ARE_YOU") {
      return {
        answer: "Hello! I'm Caloy, your TESTIMONIUM assistant. I'm here to help you with sacramental certificates, parish schedules, requirements, and office information across member parishes.",
        composed: true,
        fallbackReason: null,
      };
    }

    if (responseType === "HOW_ARE_YOU") {
      return {
        answer: "I'm doing well and glad to assist you! How may I help you with your parish records or appointments today?",
        composed: true,
        fallbackReason: null,
      };
    }

    // Default for LIVE_DATA in tests: if fallbackAnswer provided, simulate successful natural composition
    return {
      answer: fallbackAnswer,
      composed: true,
      fallbackReason: null,
    };
  }
}
