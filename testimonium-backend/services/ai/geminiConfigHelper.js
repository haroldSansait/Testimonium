/**
 * Centralized generation-request compatibility helper.
 *
 * Gemini 3.8 Flash's generateContent contract does not accept legacy
 * sampling parameters (temperature, topP, topK).
 * Existing models (e.g. gemini-3.5-flash-lite, gemini-3.5-flash, gemini-2.5-flash)
 * retain their configured sampling parameters.
 */
export function buildGeminiGenerationConfig({ model, baseConfig = {}, purpose = "RAG_GENERATION" } = {}) {
  const modelStr = String(model || "").trim().toLowerCase();
  const isGemini38 = modelStr.startsWith("gemini-3.8");

  const config = { ...baseConfig };

  if (isGemini38) {
    // Strip unsupported sampling parameters for Gemini 3.8
    delete config.temperature;
    delete config.topP;
    delete config.topK;
  }

  return config;
}
