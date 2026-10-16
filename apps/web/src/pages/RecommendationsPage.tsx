import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DailyRecommendationsResponse } from "@healthy-eating-ai/shared";
import { getTodayRecommendations } from "../api/recommendationsApi";
import { NutritionSummaryCard } from "../components/NutritionSummaryCard";
import "./RecommendationsPage.css";

type Phase = "loading" | "ready" | "target-not-found" | "error";

function formatKcal(value: number): string {
  return `${value} kcal`;
}

function formatGrams(value: number): string {
  return `${value} g`;
}

export function RecommendationsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<DailyRecommendationsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Clears any previously loaded response immediately so a slow request
    // never leaves stale recommendations on screen while the new one loads.
    setPhase("loading");
    setData(null);

    void getTodayRecommendations().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.kind === "found") {
        setData(result.recommendations);
        setPhase("ready");
      } else if (result.kind === "target_not_found") {
        setPhase("target-not-found");
      } else {
        setPhase("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1>Recommendations</h1>

      {phase === "loading" && <p className="recommendations-page__message">Loading recommendations...</p>}

      {phase === "target-not-found" && (
        <div className="recommendations-page__message recommendations-page__message--error" role="alert">
          <p>Nutrition target is not available. Calculate your nutrition target first.</p>
          <Link className="recommendations-page__action" to="/dashboard">
            Go to Dashboard
          </Link>
        </div>
      )}

      {phase === "error" && (
        <p className="recommendations-page__message recommendations-page__message--error" role="alert">
          Unable to load recommendations
        </p>
      )}

      {phase === "ready" && data && (
        <>
          <p>Your nutrition recommendations for {data.date}.</p>

          <h2 className="recommendations-page__section-heading">Daily Summary</h2>
          <div className="nutrition-cards">
            <NutritionSummaryCard
              label="Calories"
              target={formatKcal(data.summary.target.calories)}
              consumed={formatKcal(data.summary.consumed.calories)}
              remaining={formatKcal(data.summary.remaining.calories)}
            />
            <NutritionSummaryCard
              label="Protein"
              target={formatGrams(data.summary.target.proteinG)}
              consumed={formatGrams(data.summary.consumed.proteinG)}
              remaining={formatGrams(data.summary.remaining.proteinG)}
            />
            <NutritionSummaryCard
              label="Fat"
              target={formatGrams(data.summary.target.fatG)}
              consumed={formatGrams(data.summary.consumed.fatG)}
              remaining={formatGrams(data.summary.remaining.fatG)}
            />
            <NutritionSummaryCard
              label="Carbohydrates"
              target={formatGrams(data.summary.target.carbsG)}
              consumed={formatGrams(data.summary.consumed.carbsG)}
              remaining={formatGrams(data.summary.remaining.carbsG)}
            />
          </div>

          <h2 className="recommendations-page__section-heading">Today's Recommendations</h2>
          {data.recommendations.length === 0 ? (
            <p>No recommendations available for today.</p>
          ) : (
            <ul className="recommendations-list">
              {data.recommendations.map((recommendation, index) => (
                <li
                  key={`${recommendation.code}-${index}`}
                  className={
                    recommendation.level === "warning"
                      ? "recommendations-list__item recommendations-list__item--warning"
                      : "recommendations-list__item recommendations-list__item--info"
                  }
                >
                  <span className="recommendations-list__level">
                    {recommendation.level === "warning" ? "Warning" : "Info"}
                  </span>
                  <p className="recommendations-list__message">{recommendation.message}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
