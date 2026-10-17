import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./logging/errorHandler.js";
import { REQUEST_ID_HEADER, createRequestLogging } from "./logging/requestLogging.js";
import { authRouter } from "./routes/authRoutes.js";
import { healthRouter } from "./routes/health.js";
import { historyRouter } from "./routes/historyRoutes.js";
import { mealAnalysisRouter } from "./routes/mealAnalysisRoutes.js";
import { mealRouter } from "./routes/mealRoutes.js";
import { nutritionSummaryRouter } from "./routes/nutritionSummaryRoutes.js";
import { nutritionTargetRouter } from "./routes/nutritionTargetRoutes.js";
import { profileRouter } from "./routes/profileRoutes.js";
import { recommendationRouter } from "./routes/recommendationRoutes.js";
import { shoppingListRouter } from "./routes/shoppingListRoutes.js";
import { weeklyPlanRouter } from "./routes/weeklyPlanRoutes.js";

export const app = express();

// No need to advertise the framework to every client.
app.disable("x-powered-by");

// The Web app (Vite dev server) runs on a different origin than the API, so
// the browser needs CORS headers to read the response. Milestone 14 adds a
// credentialed (cookie-carrying) session, which the Fetch spec forbids
// combining with a wildcard `*` origin - `credentials: true` here requires
// echoing back one specific, configured origin instead (see env.webOrigin).
app.use(createRequestLogging());
app.use(cors({ origin: env.webOrigin, credentials: true, exposedHeaders: [REQUEST_ID_HEADER] }));
app.use(express.json());
app.use(cookieParser());

app.use(healthRouter);
app.use(authRouter);
app.use(profileRouter);
app.use(nutritionTargetRouter);
app.use(nutritionSummaryRouter);
app.use(mealRouter);
app.use(historyRouter);
app.use(mealAnalysisRouter);
app.use(recommendationRouter);
app.use(weeklyPlanRouter);
app.use(shoppingListRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);
