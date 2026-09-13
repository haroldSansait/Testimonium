import { env } from "../../config/env.js";
import { GeminiEmbeddingAdapter } from "./GeminiEmbeddingAdapter.js";
import { GeminiChatAdapter } from "./GeminiChatAdapter.js";
import { FakeEmbeddingProvider } from "./FakeEmbeddingProvider.js";
import { FakeChatCompletionProvider } from "./FakeChatCompletionProvider.js";
import { SemanticIntentRouter } from "./SemanticIntentRouter.js";
import { FakeSemanticRouter } from "./FakeSemanticRouter.js";
import { CaloyResponseComposer } from "./CaloyResponseComposer.js";
import { FakeCaloyResponseComposer } from "./FakeCaloyResponseComposer.js";
import { isApprovedGenerationModel } from "../../config/caloyModelCatalog.js";

let customEmbeddingProvider = null;
let customChatProvider = null;
let customSemanticRouter = null;
let customCaloyResponseComposer = null;

const chatAdapterCache = new Map();
const composerCache = new Map();

export const setCustomEmbeddingProvider = (provider) => {
  customEmbeddingProvider = provider;
};

export const setCustomChatProvider = (provider) => {
  customChatProvider = provider;
};

export const setCustomSemanticRouter = (router) => {
  customSemanticRouter = router;
};

export const setCustomCaloyResponseComposer = (composer) => {
  customCaloyResponseComposer = composer;
};

export const resetCustomProviders = () => {
  customEmbeddingProvider = null;
  customChatProvider = null;
  customSemanticRouter = null;
  customCaloyResponseComposer = null;
  chatAdapterCache.clear();
  composerCache.clear();
};

export const getEmbeddingProvider = () => {
  if (customEmbeddingProvider) {
    return customEmbeddingProvider;
  }

  const providerType = env.chatbot?.embeddingProvider || "gemini";
  const nodeEnv = process.env.NODE_ENV || "development";

  if (providerType === "fake" || providerType === "test") {
    if (nodeEnv !== "test") {
      throw new Error(
        `Fake embedding providers are strictly prohibited in ${nodeEnv} environment. Only NODE_ENV=test or explicit dependency injection may use fake providers.`
      );
    }
    return new FakeEmbeddingProvider(env.chatbot?.embeddingDimensions || 768);
  }

  if (providerType === "gemini") {
    if (env.chatbot?.enabled) {
      if (!env.chatbot?.geminiApiKey) {
        throw new Error("GEMINI_API_KEY is required when chatbot is enabled with Gemini embedding provider");
      }
      if (!env.chatbot?.embeddingModel) {
        throw new Error("AI_EMBEDDING_MODEL is required when chatbot is enabled with Gemini embedding provider");
      }
      if (env.chatbot?.embeddingDimensions !== 768) {
        throw new Error("AI_EMBEDDING_DIMENSIONS must be 768 for gemini-embedding-2");
      }
    }

    return new GeminiEmbeddingAdapter({
      apiKey: env.chatbot?.geminiApiKey,
      model: env.chatbot?.embeddingModel,
      dimensions: env.chatbot?.embeddingDimensions,
      timeoutMs: env.chatbot?.embeddingTimeoutMs,
      maxRetries: env.chatbot?.maxRetries,
    });
  }

  throw new Error(`Unsupported embedding provider: ${providerType}`);
};

export const getChatCompletionProvider = (modelOverride = null) => {
  if (customChatProvider) {
    return customChatProvider;
  }

  const providerType = env.chatbot?.generationProvider || "gemini";
  const nodeEnv = process.env.NODE_ENV || "development";

  if (providerType === "fake" || providerType === "test") {
    if (nodeEnv !== "test") {
      throw new Error(
        `Fake chat providers are strictly prohibited in ${nodeEnv} environment. Only NODE_ENV=test or explicit dependency injection may use fake providers.`
      );
    }
    return new FakeChatCompletionProvider();
  }

  if (providerType === "gemini") {
    const model = modelOverride || env.chatbot?.generationModel || "gemini-3.5-flash-lite";
    if (!isApprovedGenerationModel(model)) {
      throw new Error(`Generation model "${model}" is not in the known-compatible deployment allowlist`);
    }

    if (env.chatbot?.enabled) {
      if (!env.chatbot?.geminiApiKey) {
        throw new Error("GEMINI_API_KEY is required when chatbot is enabled with Gemini generation provider");
      }
      if (!model) {
        throw new Error("AI_GENERATION_MODEL is required when chatbot is enabled with Gemini generation provider");
      }
    }

    if (chatAdapterCache.has(model)) {
      return chatAdapterCache.get(model);
    }

    const adapter = new GeminiChatAdapter({
      apiKey: env.chatbot?.geminiApiKey,
      model,
      timeoutMs: env.chatbot?.generationTimeoutMs,
      maxRetries: env.chatbot?.maxRetries,
    });
    chatAdapterCache.set(model, adapter);
    return adapter;
  }

  throw new Error(`Unsupported chat generation provider: ${providerType}`);
};

export const getGeminiChatAdapter = getChatCompletionProvider;

export const getSemanticRouter = () => {
  if (customSemanticRouter) {
    return customSemanticRouter;
  }

  const isTestRuntime =
    process.env.NODE_ENV === "test" ||
    process.execArgv.includes("--test") ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    env.chatbot?.generationProvider === "fake" ||
    env.chatbot?.generationProvider === "test";

  if (isTestRuntime) {
    return new FakeSemanticRouter();
  }

  return new SemanticIntentRouter({
    apiKey: env.chatbot?.geminiApiKey,
    model: env.chatbot?.semanticRouterModel || "gemini-3.5-flash-lite",
    timeoutMs: env.chatbot?.generationTimeoutMs,
    maxRetries: env.chatbot?.maxRetries,
  });
};

export const getCaloyResponseComposer = (modelOverride = null) => {
  if (customCaloyResponseComposer) {
    return customCaloyResponseComposer;
  }

  const isTestRuntime =
    process.env.NODE_ENV === "test" ||
    process.execArgv.includes("--test") ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    env.chatbot?.generationProvider === "fake" ||
    env.chatbot?.generationProvider === "test";

  if (isTestRuntime) {
    return new FakeCaloyResponseComposer();
  }

  const model = modelOverride || env.chatbot?.generationModel || "gemini-3.5-flash-lite";
  if (!isApprovedGenerationModel(model)) {
    throw new Error(`Composer model "${model}" is not in the known-compatible deployment allowlist`);
  }

  if (composerCache.has(model)) {
    return composerCache.get(model);
  }

  const composer = new CaloyResponseComposer({
    apiKey: env.chatbot?.geminiApiKey,
    model,
    timeoutMs: 12000,
  });
  composerCache.set(model, composer);
  return composer;
};
