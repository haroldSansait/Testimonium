import { env } from "../../config/env.js";
import { OcrProviderInterface } from "./OcrProviderInterface.js";

/**
 * OCRSpaceProvider — Production OCR implementation using the OCR.space API.
 *
 * Selected when OCR_PROVIDER=ocrspace.
 *
 * Requirements:
 *   - Performs exactly ONE HTTP request (no retry logic, no backoff).
 *   - No business logic, no parsing, no logging.
 *   - Returns: rawText, ocrSuccess, failureReason, failureType, httpStatusCode.
 *
 * Note: Uses native fetch (Node.js 18+) with AbortController for timeout.
 */
export class OCRSpaceProvider extends OcrProviderInterface {
  get providerName() {
    return "ocrspace";
  }

  /**
   * @param {Buffer} imageBuffer  - Compressed image buffer (from ImageCompressionService)
   * @param {string} mimeType     - Always 'image/jpeg' from the compression pipeline
   * @returns {Promise<{
   *   rawText: string,
   *   ocrSuccess: boolean,
   *   failureReason: string|null,
   *   failureType: "INFRASTRUCTURE"|"UNREADABLE"|null,
   *   httpStatusCode: number|null
   * }>}
   */
  async extractFromReceipt(imageBuffer, mimeType) {
    const apiKey = env.ocr.spaceApiKey;

    if (!apiKey) {
      return {
        rawText: "",
        ocrSuccess: false,
        failureReason: "OCR_SPACE_API_KEY is not configured",
        failureType: "INFRASTRUCTURE",
        httpStatusCode: null,
      };
    }

    // Build multipart/form-data request using native FormData and Blob
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType || "image/jpeg" });
    formData.append("file", blob, "receipt.jpg");
    formData.append("apikey", apiKey);
    formData.append("OCREngine", env.ocr.spaceEngine ?? "2");
    formData.append("isOverlayRequired", "false");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("isTable", "false");
    formData.append("language", "eng");

    // Set up timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      env.ocr.timeout ?? 10000
    );

    let response;
    let responseJson;

    try {
      response = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData, // No manual headers, fetch sets multipart boundary automatically
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      try {
        responseJson = JSON.parse(responseText);
      } catch {
        return {
          rawText: "",
          ocrSuccess: false,
          failureReason: `Invalid JSON response from OCR.space`,
          failureType: "INFRASTRUCTURE",
          httpStatusCode: response.status,
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        return {
          rawText: "",
          ocrSuccess: false,
          failureReason: `OCR request timed out after ${env.ocr.timeout ?? 10000}ms`,
          failureType: "INFRASTRUCTURE",
          httpStatusCode: 408, // Request Timeout HTTP code
        };
      }

      // Network-level errors (DNS, connection refused, etc.)
      return {
        rawText: "",
        ocrSuccess: false,
        failureReason: `Network error contacting OCR.space: ${err.message}`,
        failureType: "INFRASTRUCTURE",
        httpStatusCode: null,
      };
    }

    const statusCode = response.status;

    // OCR.space returns HTTP 200 even for failures (like rate limits, key errors, etc.)
    // Always inspect IsErroredOnProcessing before consuming parsed results.
    if (responseJson.IsErroredOnProcessing === true) {
      const reason = Array.isArray(responseJson.ErrorMessage)
        ? responseJson.ErrorMessage.join("; ")
        : responseJson.ErrorMessage || "OCR.space processing error";

      // Redact any API key leakage
      const safeReason = OCRSpaceProvider._redactApiKey(reason, apiKey);
      const exitCode = Number(responseJson.OCRExitCode);
      const isInfrastructureFailure =
        statusCode === 408 ||
        statusCode === 429 ||
        statusCode >= 500 ||
        exitCode === 4 ||
        /api\s*key|quota|rate\s*limit|maximum|timeout|temporar|server|service/i.test(safeReason);

      return {
        rawText: "",
        ocrSuccess: false,
        failureReason: safeReason,
        failureType: isInfrastructureFailure ? "INFRASTRUCTURE" : "UNREADABLE",
        httpStatusCode: statusCode,
      };
    }

    // Extract parsed text
    const parsedResults = responseJson.ParsedResults;
    if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
      return {
        rawText: "",
        ocrSuccess: false,
        failureReason: "OCR.space returned no parsed results",
        failureType: statusCode >= 400 ? "INFRASTRUCTURE" : "UNREADABLE",
        httpStatusCode: statusCode,
      };
    }

    const rawText = parsedResults
      .map((r) => (r.ParsedText || "").trim())
      .filter(Boolean)
      .join("\n");

    if (!rawText) {
      return {
        rawText: "",
        ocrSuccess: false,
        failureReason: "OCR.space returned empty text",
        failureType: "UNREADABLE",
        httpStatusCode: statusCode,
      };
    }

    return {
      rawText,
      ocrSuccess: true,
      failureReason: null,
      failureType: null,
      httpStatusCode: statusCode,
    };
  }

  /**
   * Generic text extraction alias for extractFromReceipt.
   */
  async extractText(imageBuffer, mimeType) {
    return this.extractFromReceipt(imageBuffer, mimeType);
  }

  /**
   * Redacts the OCR.space API key from any string to prevent accidental leakage.
   * @param {string} str
   * @param {string} apiKey
   * @returns {string}
   */
  static _redactApiKey(str, apiKey) {
    if (!apiKey || !str) return str;
    return str.replace(new RegExp(apiKey, "g"), "[REDACTED]");
  }
}
