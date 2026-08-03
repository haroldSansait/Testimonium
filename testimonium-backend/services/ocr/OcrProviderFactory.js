import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { StubOcrProvider } from "./StubOcrProvider.js";
import { OCRSpaceProvider } from "./OCRSpaceProvider.js";

/**
 * OcrProviderFactory — Returns the appropriate OCR provider based on environment config.
 *
 * Provider selection is driven exclusively by the OCR_PROVIDER environment variable.
 * Swapping providers requires ONLY an environment variable change — no code changes needed.
 *
 * Supported values:
 *   OCR_PROVIDER=ocrspace  → OCRSpaceProvider (production)
 *   OCR_PROVIDER=stub      → StubOcrProvider  (development / testing)
 *   (unset)                → StubOcrProvider  (safe default)
 *
 * Future providers:
 *   OCR_PROVIDER=googlevision → GoogleVisionProvider (not yet implemented)
 *   OCR_PROVIDER=azure        → AzureDocumentAIProvider (not yet implemented)
 */
export class OcrProviderFactory {
  /**
   * Creates and returns an OCR provider instance.
   *
   * @returns {import("./OcrProviderInterface.js").OcrProviderInterface}
   */
  static create() {
    const providerName = (env.ocr.provider ?? "stub").toLowerCase().trim();

    switch (providerName) {
      case "ocrspace":
        return new OCRSpaceProvider();

      case "stub":
        return new StubOcrProvider();

      default:
        logger.warn(
          { providerName },
          "[OcrProviderFactory] Unknown OCR_PROVIDER. Falling back to StubOcrProvider. Valid options: ocrspace, stub."
        );
        return new StubOcrProvider();
    }
  }
}

