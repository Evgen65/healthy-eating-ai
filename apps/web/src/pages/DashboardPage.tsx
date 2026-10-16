import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NutritionSummary } from "@healthy-eating-ai/shared";
import { calculateNutritionTarget } from "../api/nutritionTargetApi";
import { getTodayNutrition } from "../api/nutritionSummaryApi";
import { NutritionSummaryCard } from "../components/NutritionSummaryCard";
import "./DashboardPage.css";

type Phase = "loading" | "profile-missing" | "target-missing" | "ready" | "error";

function formatKcal(value: number): string {
  return `${value} kcal`;
}

function formatGrams(value: number): string {
  return `${value} g`;
}

export function DashboardPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getTodayNutrition().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.kind === "found") {
        setSummary(result.summary);
        setPhase("ready");
      } else if (result.kind === "target_not_found") {
        setPhase("target-missing");
      } else {
        setPhase("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCalculate() {
    if (calculating) {
      return;
    }

    setCalculating(true);
    setActionError(null);
    const calcResult = await calculateNutritionTarget();

    if (calcResult.kind === "profile_not_found") {
      setCalculating(false);
      setPhase("profile-missing");
      return;
    }
    if (calcResult.kind === "failed") {
      setCalculating(false);
      setActionError(calcResult.message);
      return;
    }
    if (calcResult.kind === "error") {
      setCalculating(false);
      setActionError("Unable to calculate nutrition target");
      return;
    }

    // Recalculation succeeded - the target changed, so remaining must be
    // re-derived by the Backend rather than patched locally in React.
    const summaryResult = await getTodayNutrition();
    setCalculating(false);

    if (summaryResult.kind === "found") {
      setSummary(summaryResult.summary);
      setPhase("ready");
      return;
    }
    setActionError("Unable to refresh nutrition summary");
  }

  if (phase === "loading") {
    return (
      <section>
        <h1>Dashboard</h1>
        <p>Loading nutrition summary...</p>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section>
        <h1>Dashboard</h1>
        <p className="dashboard-message dashboard-message--error" role="alert">
          Unable to load nutrition target
        </p>
      </section>
    );
  }

  if (phase === "profile-missing") {
    return (
      <section>
        <h1>Dashboard</h1>
        <p>Complete your profile first.</p>
        <Link className="dashboard-action" to="/profile">
          Go to Profile
        </Link>
      </section>
    );
  }

  if (phase === "target-missing") {
    return (
      <section>
        <h1>Dashboard</h1>
        <p>Your nutrition target has not been calculated yet.</p>
        <button type="button" className="dashboard-action" onClick={handleCalculate} disabled={calculating}>
          {calculating ? "Calculating..." : "Calculate Nutrition Target"}
        </button>
        {actionError && (
          <p className="dashboard-message dashboard-message--error" role="alert">
            {actionError}
          </p>
        )}
      </section>
    );
  }

  if (phase === "ready" && summary) {
    return (
      <section>
        <h1>Dashboard</h1>
        <p>Your nutrition overview for {summary.date}.</p>
        <div className="nutrition-cards">
          <NutritionSummaryCard
            label="Calories"
            target={formatKcal(summary.target.calories)}
            consumed={formatKcal(summary.consumed.calories)}
            remaining={formatKcal(summary.remaining.calories)}
          />
          <NutritionSummaryCard
            label="Protein"
            target={formatGrams(summary.target.proteinG)}
            consumed={formatGrams(summary.consumed.proteinG)}
            remaining={formatGrams(summary.remaining.proteinG)}
          />
          <NutritionSummaryCard
            label="Fat"
            target={formatGrams(summary.target.fatG)}
            consumed={formatGrams(summary.consumed.fatG)}
            remaining={formatGrams(summary.remaining.fatG)}
          />
          <NutritionSummaryCard
            label="Carbohydrates"
            target={formatGrams(summary.target.carbsG)}
            consumed={formatGrams(summary.consumed.carbsG)}
            remaining={formatGrams(summary.remaining.carbsG)}
          />
        </div>
        <button type="button" className="dashboard-action" onClick={handleCalculate} disabled={calculating}>
          {calculating ? "Calculating..." : "Recalculate"}
        </button>
        {actionError && (
          <p className="dashboard-message dashboard-message--error" role="alert">
            {actionError}
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="dashboard-message dashboard-message--error" role="alert">
        Unable to load nutrition target
      </p>
    </section>
  );
}
