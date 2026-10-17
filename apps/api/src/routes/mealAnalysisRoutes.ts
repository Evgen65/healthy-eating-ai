import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../auth/authMiddleware.js";
import { env } from "../config/env.js";
import { runWithLogger } from "../logging/requestContext.js";
import { logAiAnalysisFailed } from "../ai/aiAnalysisLogging.js";
import { recordAiAnalysisFailure, recordAiAnalysisSuccess, recordAiRetry } from "../ai/aiMetrics.js";
import { metrics } from "../metrics/index.js";
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

    const log = req.log;
    const startedAt = Date.now();
    log.info({ event: "ai_analysis_started", provider: env.aiProvider, mimeType: file.mimetype, sizeBytes: file.size });

    try {
      // Multer's stream callbacks may not carry the async context, so the
      // request logger is re-established explicitly for the provider layer.
      const { result, attempts } = await runWithLogger(log, () =>
        analyzeWithRetry(mealAnalyzer, {
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname,
        }, undefined, (retryError) => recordAiRetry(metrics, env.aiProvider, retryError)),
      );
      recordAiAnalysisSuccess(metrics, env.aiProvider, Date.now() - startedAt, result.items.length);
      res.set(ATTEMPTS_HEADER, String(attempts));
      log.info({
        event: "ai_analysis_succeeded",
        provider: env.aiProvider,
        attempts,
        itemCount: result.items.length,
        durationMs: Date.now() - startedAt,
      });

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

      recordAiAnalysisFailure(metrics, env.aiProvider, Date.now() - startedAt, analyzeError);
      logAiAnalysisFailed(log, analyzeError, { provider: env.aiProvider, durationMs: Date.now() - startedAt });

      // Reliability principle: external AI failure must never crash
      // Express and must never expose raw provider details to the browser
      // - the classification/metadata is logged server-side above
      // (ai_analysis_failed, see aiAnalysisLogging.ts) and every branch below responds with only a short,
      // provider-neutral, non-sensitive public message.
      if (analyzeError instanceof AiProviderNotConfiguredError) {
        res.status(503).json({ error: "AI provider is not configured" });
        return;
      }
      if (analyzeError instanceof AiProviderTimeoutError) {
        res.status(504).json({ error: "Meal analysis timed out" });
        return;
      }
      if (analyzeError instanceof AiProviderRateLimitError) {
        res.status(429).json({ error: "Meal analysis is temporarily rate limited" });
        return;
      }
      if (analyzeError instanceof AiProviderQuotaExhaustedError) {
        // Deliberately the same public message/status as
        // AiProviderUnavailableError/AiProviderNetworkError below - billing
        // and credit-balance details never reach the browser, only logs.
        res.status(503).json({ error: "Meal analysis service is temporarily unavailable" });
        return;
      }
      if (analyzeError instanceof AiProviderInvalidResponseError) {
        res.status(502).json({ error: "Meal analysis provider returned an invalid response" });
        return;
      }
      if (analyzeError instanceof AiProviderUnavailableError || analyzeError instanceof AiProviderNetworkError) {
        res.status(502).json({ error: "Meal analysis service is temporarily unavailable" });
        return;
      }
      if (analyzeError instanceof AiProviderRequestError) {
        res.status(502).json({ error: "Meal analysis provider failed" });
        return;
      }
      res.status(500).json({ error: "Meal analysis failed" });
    }
  });
});
