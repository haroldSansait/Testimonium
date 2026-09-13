import { env } from "./env.js";

/**
 * Authoritative backend catalog of approved generation models for Caloy.
 * Only tested and compatible models are allowed to be configured by coordinators.
 */
export const KNOWN_COMPATIBLE_GENERATION_MODELS = Object.freeze([
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    description: "Fastest response time, lowest latency, and cost-effective (Recommended).",
    isRecommended: true,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    description: "High intelligence and reasoning capability for complex diocesan queries.",
    isRecommended: false,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    description: "Standard multimodal Flash model with balanced reasoning and latency.",
    isRecommended: false,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Stable legacy generation model fallback.",
    isRecommended: false,
  },
]);

// Backward-compatible export name for callers/tests. The values are the
// deliberate compatibility catalog, never deployment-provided model IDs.
export const APPROVED_GENERATION_MODELS = KNOWN_COMPATIBLE_GENERATION_MODELS;

/**
 * Returns the selectable deployment allowlist. CALOY_ALLOWED_GENERATION_MODELS
 * may only narrow the known-compatible catalog; it cannot declare compatibility.
 */
export function getApprovedGenerationModels() {
  const configuredAllowlist = Array.isArray(env.chatbot?.allowedGenerationModels)
    ? new Set(env.chatbot.allowedGenerationModels.map((id) => String(id).trim()).filter(Boolean))
    : new Set();

  if (configuredAllowlist.size === 0) {
    return [...KNOWN_COMPATIBLE_GENERATION_MODELS];
  }

  return KNOWN_COMPATIBLE_GENERATION_MODELS.filter((model) => configuredAllowlist.has(model.id));
}

export function isKnownCompatibleGenerationModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  const normalized = modelId.trim();
  return KNOWN_COMPATIBLE_GENERATION_MODELS.some((model) => model.id === normalized);
}

/**
 * Validates whether a model identifier is in the approved catalog.
 */
export function isApprovedGenerationModel(modelId) {
  if (!modelId || typeof modelId !== "string") return false;
  return getApprovedGenerationModels().some((model) => model.id === modelId.trim());
}
