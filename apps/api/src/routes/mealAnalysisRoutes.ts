import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../auth/authMiddleware.js";
import type { MealAnalyzer } from "../ai/mealAnalyzer.js";
import { createMealAnalyzer } from "../ai/mealAnalyzerFactory.js";
import { analyzeWithRetry } from "../ai/retryingMealAnalyzer.js";
import {
  AiProviderInvalidResponseError,
  AiProviderNetworkError,
  AiProviderNotConfiguredError,
  AiProviderQuotaExhaustedError,
  AiProviderRateLimitError,
  AiProviderRequestError,
  AiProviderTimeoutError,
  AiProviderUnavailableError,
  MealAnalyzerError,
} from "../ai/mealAnalyzerErrors.js";

const ATTEMPTS_HEADER = "X-Ai-Analysis-Attempts";

const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** Distinguishes a rejected MIME type from other multer failures below. */
class UnsupportedImageTypeError extends Error {}

// Memory storage only - the image is never written to disk, uploads/, or
// the database. It exists only as a Buffer for the duration of this
// request and is discarded once the response is sent.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
      callback(new UnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
});

// Resolved once from AI_PROVIDER at module load (see mealAnalyzerFactory.ts)
// - the route only ever depends on the MealAnalyzer abstraction, never on
// Mock or OpenAI specifics. An unsupported AI_PROVIDER value throws here,
// which fails server startup loudly rather than silently using Mock.
const mealAnalyzer: MealAnalyzer = createMealAnalyzer();

export const mealAnalysisRouter = Router();

// requireAuth runs first, before multer touches the request body and before
// any AI provider call - an unauthenticated request must be rejected with
// zero provider calls (see requireAuth's own docs) rather than only being
// checked after money-costing work has already started.
mealAnalysisRouter.post("/api/ai/meal-analysis", requireAuth, (req: Request, res: Response, next: NextFunction) => {
  upload.single("image")(req, res, async (error: unknown) => {
    if (error instanceof UnsupportedImageTypeError) {
      res.status(400).json({ error: "Unsupported image type" });
      return;
    }
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Image is too large" });
        return;
      }
      // Any other multer failure (e.g. an unexpected field) means no
      // usable image was received.
      res.status(400).json({ error: "Image is required" });
      return;
    }
    if (error) {
      next(error);
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Image is required" });
      return;
    }

    try {
      const { result, attempts } = await analyzeWithRetry(mealAnalyzer, {
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
      res.set(ATTEMPTS_HEADER, String(attempts));

      // Normalized provider behavior for "no food identifiable": zero
      // items (see openAiMealAnalyzer.ts / mockMealAnalyzer.ts). Converted
      // here, at the service boundary, into a controlled error rather than
      // returning a hollow 200 with an empty result for the UI to guess at.
      if (result.items.length === 0) {
        res.status(422).json({ error: "No food detected" });
        return;
      }

      res.status(200).json(result);
    } catch (analyzeError) {
      if (analyzeError instanceof MealAnalyzerError && analyzeError.attempts !== undefined) {
        res.set(ATTEMPTS_HEADER, String(analyzeError.attempts));
      }

      // Reliability principle: external AI failure must never crash
      // Express and must never expose raw provider details to the browser
      // - every branch below logs the classification/metadata server-side
      // (see mealAnalyzerErrors.ts) and responds with only a short,
      // provider-neutral, non-sensitive public message.
      if (analyzeError instanceof AiProviderNotConfiguredError) {
        console.error("[ai] provider not configured:", analyzeError.message, analyzeError.meta);
        res.status(503).json({ error: "AI provider is not configured" });
        return;
      }
      if (analyzeError instanceof AiProviderTimeoutError) {
        console.error("[ai] provider timed out:", analyzeError.message, analyzeError.meta);
        res.status(504).json({ error: "Meal analysis timed out" });
        return;
      }
      if (analyzeError instanceof AiProviderRateLimitError) {
        console.error("[ai] provider rate limited:", analyzeError.message, analyzeError.meta);
        res.status(429).json({ error: "Meal analysis is temporarily rate limited" });
        return;
      }
      if (analyzeError instanceof AiProviderQuotaExhaustedError) {
        // Deliberately the same public message/status as
        // AiProviderUnavailableError/AiProviderNetworkError below - billing
        // and credit-balance details never reach the browser, only logs.
        console.error("[ai] provider quota/credits exhausted:", analyzeError.message, analyzeError.meta);
        res.status(503).json({ error: "Meal analysis service is temporarily unavailable" });
        return;
      }
      if (analyzeError instanceof AiProviderInvalidResponseError) {
        console.error("[ai] provider returned an invalid response:", analyzeError.message, analyzeError.meta);
        res.status(502).json({ error: "Meal analysis provider returned an invalid response" });
        return;
      }
      if (analyzeError instanceof AiProviderUnavailableError || analyzeError instanceof AiProviderNetworkError) {
        console.error("[ai] provider unavailable:", analyzeError.message, analyzeError.meta);
        res.status(502).json({ error: "Meal analysis service is temporarily unavailable" });
        return;
      }
      if (analyzeError instanceof AiProviderRequestError) {
        console.error("[ai] provider request failed:", analyzeError.message, analyzeError.meta);
        res.status(502).json({ error: "Meal analysis provider failed" });
        return;
      }
      console.error(analyzeError);
      res.status(500).json({ error: "Meal analysis failed" });
    }
  });
});
