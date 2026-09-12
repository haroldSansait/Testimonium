import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { abortableDelay, createCallerAbortError, throwIfCallerAborted } from "./retryUtils.js";
import { TOOL_IDS } from "./liveTools/liveToolSchemas.js";
import { getManilaDateString } from "../ConflictHelper.js";

const ALLOWED_ROUTES = ["SOCIAL", "CAPABILITIES", "LIVE_TOOL", "RAG", "OUT_OF_SCOPE"];

const ALLOWED_INTENTS = Object.values(TOOL_IDS);

export const SEMANTIC_ROUTER_SYSTEM_INSTRUCTION = `You are the semantic interpretation engine for Caloy, the virtual parish assistant for TESTIMONIUM, a Catholic diocesan sacramental record and scheduling platform.

Your ONLY task is to interpret the user's natural language message and return a strictly structured JSON object.
You NEVER query databases, execute code, or authorize access.

==================================================
ALLOWED ROUTES:
==================================================
1. "SOCIAL":
   Greetings, identity inquiries (e.g. "Who are you?", "Introduce yourself", "What is your name?"), casual farewells, pleasantries (e.g. "Hello", "Good morning", "Thanks", "How are you?"), or polite acknowledgements / declines (e.g. "No, thanks", "No thanks", "Okay thanks", "Sige salamat", "Way kaso ah", "Okay lang").
   Set intent to "WHO_ARE_YOU", "HOW_ARE_YOU", "GREETING", "THANKS", or "DECLINE_OR_CLOSE".
   Do NOT use SOCIAL if the message contains an actual question or substantive inquiry.

2. "CAPABILITIES":
   Inquiries asking what Caloy can do, what questions can be asked, or an overview of available features
   (e.g. "What can you do?", "What do you answer?", "What can I ask you?", "Help me", "What are your features?").

3. "LIVE_TOOL":
   Inquiries requesting CURRENT live operational data, specific parish records, or personal account state.
   Must be mapped to one of the ALLOWED INTENTS below.

4. "RAG":
   Inquiries about GENERAL procedures, rules, platform policies, guidelines, requirements in general, or system how-tos
   (e.g. "How does payment verification work?", "How to request a certificate?", "How does OCR work?", "Can I choose a preferred priest?", "What documents does TESTIMONIUM support?").

5. "OUT_OF_SCOPE":
   Non-church, non-parish inquiries (e.g. creative writing, code generation, general world trivia, politics, math).

==================================================
ALLOWED LIVE TOOL INTENTS & THEIR MEANING:
==================================================
- "GET_ACTIVE_PARISH_PRIESTS":
  Inquiries about priests or clergy currently active, assigned, or serving at a specific parish.

- "GET_PARISH_DOCUMENTS":
  Inquiries about which sacramental certificates or documents a specific parish currently offers or issues (e.g. "What documents can I request?", "Anong certificates ang available?"). Completely distinct from schedulable events!

- "GET_PARISH_SCHEDULABLE_EVENTS":
  Inquiries asking what sacramental events, services, or rites a specific parish offers for appointment scheduling (e.g. "What events can I schedule at St. Joseph?", "Anong mga event ang pwede ko e schedule sa St. Joseph?", "What services are available for booking?"). Distinct from requestable document offerings! Does NOT require a date.

- "GET_DOCUMENT_REQUIREMENTS":
  Inquiries about required supporting documents or prerequisites to request a specific document type.

- "GET_DOCUMENT_FEE":
  Inquiries about the current configured fee, cost, or pricing for a sacramental document at a parish.

- "GET_PARISH_OFFICE_INFO":
  Inquiries about parish office hours, telephone numbers, email address, physical location, or contact info.

- "GET_CALENDAR_SLOT_AVAILABILITY":
  Inquiries asking to schedule, book, or check available appointment slots for a specific sacramental event (e.g. Wedding, Baptism, Wake Mass, Mass Intention, Funeral, etc.) at a parish, whether asking generally about scheduling that event, on a specific date, or at a specific time (e.g. "Can I schedule a Wake Mass?", "Pwede ba ako mag request ng schedule para sa isang wake mass?", "pwede ba ako mag sched ng wake mass sa St joseph?", "Pwede ba sa Monday mag schedule ng wake mass?").

  scheduleEvent must normalize to one of these exact backend enum values when present:
  WEDDING, MARRIAGE_SPECIAL, BAPTISM, CONFIRMATION, FIRST_COMMUNION, CONFESSION, ANOINTING_OF_THE_SICK, PRIVATE_MASS, MASS_INTENTION, WAKE_MASS, FUNERAL, MASS_OF_HOLY_SPIRIT, FIESTA, THANKSGIVING, BLESSING, DELIVERANCE.
  Generic wedding or marriage wording maps to WEDDING. Explicit Marriage Special or special wedding wording maps to MARRIAGE_SPECIAL; these are distinct services and must never be collapsed into each other.

- "GET_AVAILABLE_DATES":
  Inquiries asking which upcoming dates have at least one available slot, including broad requests such as "what days are available?", "any openings this week?", or "find the next available date". This changes a prior exact-date inquiry into a bounded date-range search; do not reuse the previous exact date as the intent.

- "GET_ACTIVE_PARISHES":
  Inquiries asking for the general active parish directory, list of all member parishes, churches, quasi-parishes, or mission stations in TESTIMONIUM as a whole.

- "GET_VICARIATE_DIRECTORY":
  Inquiries asking for the active parish or church directory, member church units, or counts belonging to a specific Vicariate (e.g. "Vicariate of Canlaon", "Canlaon vicariate", "how many parishes in the vicariate of Canlaon?").

- "CHECK_PRIEST_AVAILABILITY":
  Inquiries asking if a specific priest (or parish priest/pastor) is available or free on a date, specific time, or for an event.

- "GET_AVAILABLE_PRIESTS_FOR_SLOT":
  Inquiries asking which priests or clergy are available or free on a specific date and time for an event at a parish.

- "GET_PARISH_EVENTS_FOR_DATE":
  Inquiries asking about public parish calendar events, activities, or Mass schedules occurring on a specific date.

- "CHECK_MY_REQUEST_STATUS":
  Inquiries asking about the status, progress, or readiness of the user's own certificate request (or referring to <TRACKING_NUMBER>).

- "CHECK_MY_PAYMENT_STATUS":
  Inquiries asking about the payment verification status or receipt approval of the user's own request (or referring to <TRACKING_NUMBER>).

- "GET_MY_UPCOMING_SCHEDULES":
  Inquiries asking about the user's own upcoming booked appointments, rites, or scheduled events.

==================================================
LIVE TOOL vs. RAG SEMANTIC DISTINCTION:
==================================================
- General procedure, policy, or diocesan guidelines -> "RAG"
  Example: "How does payment verification work?" -> "RAG"
  Example: "How do I request a baptism certificate?" -> "RAG"
  Example: "Can I request a preferred priest?" -> "RAG"

- Current state, specific parish pricing, specific live status, current assigned priests -> "LIVE_TOOL"
  Example: "Has my payment been verified?" -> "LIVE_TOOL" (CHECK_MY_PAYMENT_STATUS)
  Example: "Who are the priests at St. Joseph?" -> "LIVE_TOOL" (GET_ACTIVE_PARISH_PRIESTS)
  Example: "How much is a baptism cert at Guadalupe?" -> "LIVE_TOOL" (GET_DOCUMENT_FEE)
  Example: "What wedding slots are open tomorrow?" -> "LIVE_TOOL" (GET_CALENDAR_SLOT_AVAILABILITY)
  Example: "What events can I schedule at St. Joseph?" -> "LIVE_TOOL" (GET_PARISH_SCHEDULABLE_EVENTS)

==================================================
AUTHORITATIVE DATE & CALENDAR CONTEXT:
==================================================
The prompt provides the authoritative CURRENT DATE (ASIA/MANILA).
- Normalize natural relative dates ("tomorrow", "today") and Philippine local date terms ("bukas" = tomorrow, "ugma" = tomorrow, "ngayon" = today) into canonical relative phrases ("tomorrow", "today") or canonical YYYY-MM-DD.
- Normalize natural absolute dates ("September 17", "Sept 17", "September 17th", "on September 17", "17 September") into canonical "YYYY-MM-DD" or standard date phrase based on the Manila calendar context.

==================================================
CONVERSATIONAL CONTEXT & PENDING CLARIFICATION REASONING:
==================================================
When safe conversation context is provided:
- If a pending clarification is active (e.g. Caloy previously asked for a DATE for Wake Mass, or a PARISH for document fee):
  Semantically evaluate whether the user's current message answers the clarification or changes topic:
  * Set "pendingRelation": "ANSWER_PENDING" if the user's message supplies or answers the pending parameter (e.g. "bukas", "September 17", "Monday", "2 PM"). Inherit the pending intent and prior collected entities, and populate the entity.
  * Set "pendingRelation": "NEW_TOPIC" if the user asks a new question, changes topic, asks what events can be scheduled, asks about documents, asks how much something costs, or asks a fresh substantive inquiry (e.g. "Anong mga event ang pwede i schedule sa St. Joseph?", "How much is Marriage Banns?"). Do NOT trap the user in the pending clarification; route the new message independently to its own intent and set usesPreviousContext = false (while preserving parish if applicable).
  * If no pending clarification was active, set pendingRelation: null.

- If the current message is a follow-up (e.g. "How about St. Joseph?", "What about the requirements?", "What about Saturday?", "Who serves there?"):
  Infer the intent and missing entities from the previous turn!
  Example: Previous intent was GET_DOCUMENT_FEE for BAPTISMAL_CERTIFICATE at Guadalupe. User says "How about St. Joseph?"
  -> Same intent: GET_DOCUMENT_FEE, same document: BAPTISMAL_CERTIFICATE, new parish: St. Joseph. Set usesPreviousContext = true.
  Example: User asked about St. Joseph. Next asks "Who serves there?"
  -> Intent: GET_ACTIVE_PARISH_PRIESTS, parish: St. Joseph. Set usesPreviousContext = true.

- Correct minor spelling mistakes in relative date wording semantically. Emit a canonical datePhrase such as "tomorrow" even when the user misspells that word. Do not copy a misspelled relative-date token into datePhrase.
- For a range-availability follow-up, inherit the prior parish and schedule event, choose GET_AVAILABLE_DATES, and leave datePhrase null unless the current message explicitly supplies a new range start.

- If the user changes to a completely new topic (e.g. was discussing baptism fees, now asks "How does OCR work?"):
  Do NOT inherit the previous intent or document. Route the new message independently! Set usesPreviousContext = false.

==================================================
OUTPUT SCHEMA (STRICT JSON ONLY):
==================================================
{
  "route": "SOCIAL" | "CAPABILITIES" | "LIVE_TOOL" | "RAG" | "OUT_OF_SCOPE",
  "intent": string | null,
  "pendingRelation": "ANSWER_PENDING" | "NEW_TOPIC" | null,
  "entities": {
    "parishName": string | null,
    "documentType": string | null,
    "scheduleEvent": string | null,
    "datePhrase": string | null,
    "timePhrase": string | null,
    "priestName": string | null,
    "vicariateName": string | null,
    "trackingNumberPresent": boolean
  },
  "usesPreviousContext": boolean
}`;

export class SemanticIntentRouter {
  constructor({
    apiKey = null,
    model = null,
    timeoutMs = null,
    maxRetries = null,
    client = null,
  } = {}) {
    this.modelName = model || env.chatbot?.semanticRouterModel || "gemini-3.5-flash-lite";
    this.apiKey = apiKey || env.chatbot?.geminiApiKey;
    this.timeoutMs = timeoutMs ?? (env.chatbot?.generationTimeoutMs || 30000);
    this.maxRetries = maxRetries ?? 2;
    this.client = client || (this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : null);
  }

  /**
   * Formats the prompt with message and safe context.
   */
  _buildPrompt({
    sanitizedQuestion,
    conversationContext,
    selectedParishName,
  }) {
    const now = new Date();
    const manilaDateStr = getManilaDateString(now);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const [year, month, day] = manilaDateStr.split("-").map(Number);
    const manilaToday = new Date(Date.UTC(year, month - 1, day));
    const manilaDayName = dayNames[manilaToday.getUTCDay()];

    let pendingSection = "None";
    if (conversationContext?.pendingMissingParam || conversationContext?.pendingClarificationIntent) {
      pendingSection = `Waiting for user to provide ${conversationContext.pendingMissingParam || "clarification"} for intent ${conversationContext.pendingClarificationIntent || conversationContext.lastIntent || "ACTIVE_FLOW"}`;
    }

    let contextSection = "None";
    if (conversationContext) {
      const parts = [];
      if (conversationContext.lastIntent) parts.push(`Previous Intent: ${conversationContext.lastIntent}`);
      if (conversationContext.lastParishName) parts.push(`Previous Parish: ${conversationContext.lastParishName}`);
      if (conversationContext.lastDocumentType) parts.push(`Previous Document Type: ${conversationContext.lastDocumentType}`);
      if (conversationContext.lastScheduleEvent) parts.push(`Previous Schedule Event: ${conversationContext.lastScheduleEvent}`);
      if (conversationContext.lastDatePhrase) parts.push(`Previous Date Phrase: ${conversationContext.lastDatePhrase}`);
      if (conversationContext.lastTimePhrase) parts.push(`Previous Time Phrase: ${conversationContext.lastTimePhrase}`);
      if (conversationContext.lastPriestName) parts.push(`Previous Priest: ${conversationContext.lastPriestName}`);
      if (conversationContext.lastVicariateName) parts.push(`Previous Vicariate: ${conversationContext.lastVicariateName}`);
      if (conversationContext.lastResponseType) parts.push(`Previous Response Type: ${conversationContext.lastResponseType}`);
      if (parts.length > 0) {
        contextSection = parts.join("\n");
      }
    }

    const selectedParishSection = selectedParishName ? selectedParishName : "None selected";

    return `CURRENT DATE (ASIA/MANILA):
${manilaDateStr} (${manilaDayName})

PENDING CLARIFICATION STATE:
${pendingSection}

CURRENT CONVERSATION CONTEXT:
${contextSection}

CURRENT SELECTED PARISH (FROM UI):
${selectedParishSection}

USER MESSAGE:
${sanitizedQuestion}

Interpret the user's message in this context. Output ONLY the JSON object.`;
  }

  /**
   * Parses and validates raw model text into strict schema.
   */
  _parseAndValidate(rawText) {
    let parsed = null;
    try {
      // Clean possible markdown code fences
      const cleaned = rawText
        .replace(/^```(json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // JSON parse error -> safe RAG fallback
      return {
        route: "RAG",
        intent: null,
        pendingRelation: null,
        entities: {
          parishName: null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    const route = ALLOWED_ROUTES.includes(parsed.route) ? parsed.route : "RAG";
    let intent = null;
    if (route === "LIVE_TOOL" && ALLOWED_INTENTS.includes(parsed.intent)) {
      intent = parsed.intent;
    } else if (route === "SOCIAL" && ["WHO_ARE_YOU", "HOW_ARE_YOU", "GREETING", "THANKS", "DECLINE_OR_CLOSE"].includes(parsed.intent)) {
      intent = parsed.intent;
    }

    const pendingRelation = ["ANSWER_PENDING", "NEW_TOPIC"].includes(parsed.pendingRelation)
      ? parsed.pendingRelation
      : null;

    const entities = {
      parishName: typeof parsed.entities?.parishName === "string" && parsed.entities.parishName.trim()
        ? parsed.entities.parishName.trim()
        : null,
      documentType: typeof parsed.entities?.documentType === "string" && parsed.entities.documentType.trim()
        ? parsed.entities.documentType.trim()
        : null,
      scheduleEvent: typeof parsed.entities?.scheduleEvent === "string" && parsed.entities.scheduleEvent.trim()
        ? parsed.entities.scheduleEvent.trim()
        : null,
      datePhrase: typeof parsed.entities?.datePhrase === "string" && parsed.entities.datePhrase.trim()
        ? parsed.entities.datePhrase.trim()
        : null,
      timePhrase: typeof parsed.entities?.timePhrase === "string" && parsed.entities.timePhrase.trim()
        ? parsed.entities.timePhrase.trim()
        : null,
      priestName: typeof parsed.entities?.priestName === "string" && parsed.entities.priestName.trim()
        ? parsed.entities.priestName.trim()
        : null,
      trackingNumberPresent: Boolean(parsed.entities?.trackingNumberPresent),
    };

    return {
      route,
      intent,
      pendingRelation,
      entities,
      usesPreviousContext: Boolean(parsed.usesPreviousContext),
    };
  }

  /**
   * Main entrypoint: interprets a user query semantically.
   */
  async interpret({
    sanitizedQuestion,
    conversationContext = null,
    selectedParishName = null,
    signal,
  }) {
    if (!this.client) {
      // In test mode or when uninitialized, default to safe RAG fallback
      return {
        route: "RAG",
        intent: null,
        entities: {
          parishName: null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    const prompt = this._buildPrompt({
      sanitizedQuestion,
      conversationContext,
      selectedParishName,
    });

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      throwIfCallerAborted(signal);
      let timerId = null;
      const timeoutController = new AbortController();

      try {
        let combinedSignal;
        if (signal) {
          if (typeof AbortSignal.any === "function") {
            combinedSignal = AbortSignal.any([signal, timeoutController.signal]);
          } else {
            const composite = new AbortController();
            const onAbort = () => composite.abort();
            signal.addEventListener("abort", onAbort, { once: true });
            timeoutController.signal.addEventListener("abort", onAbort, { once: true });
            combinedSignal = composite.signal;
          }
        } else {
          combinedSignal = timeoutController.signal;
        }

        const timeoutPromise = new Promise((_, reject) => {
          timerId = setTimeout(() => {
            timeoutController.abort();
            const err = new Error("CHATBOT_ROUTING_TIMEOUT");
            err.code = "CHATBOT_TIMEOUT";
            reject(err);
          }, this.timeoutMs);
        });

        const callPromise = this.client.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            systemInstruction: SEMANTIC_ROUTER_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 600,
            abortSignal: combinedSignal,
          },
        });

        const response = await Promise.race([callPromise, timeoutPromise]);
        const textContent = typeof response?.text === "function" ? response.text() : response?.text;
        const rawText = typeof textContent === "string" ? textContent.trim() : "";

        return this._parseAndValidate(rawText);
      } catch (err) {
        if (signal?.aborted) throw createCallerAbortError();
        if (err.code === "CHATBOT_ABORTED") throw err;

        const isTransient =
          err.code === "ETIMEDOUT" ||
          err.code === "ECONNRESET" ||
          err.status === 429 ||
          err.statusCode === 429 ||
          err.status === 503 ||
          String(err.message || "").toLowerCase().includes("rate limit");

        if (!isTransient) {
          break;
        }

        attempt++;
        if (attempt <= this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
          await abortableDelay(delay, signal);
        }
      } finally {
        if (timerId) clearTimeout(timerId);
      }
    }

    // On complete failure, fail safe to RAG
    return {
      route: "RAG",
      intent: null,
      entities: {
        parishName: null,
        documentType: null,
        scheduleEvent: null,
        datePhrase: null,
        timePhrase: null,
        priestName: null,
        trackingNumberPresent: false,
      },
      usesPreviousContext: false,
    };
  }
}
