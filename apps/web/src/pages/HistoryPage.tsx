import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import type { DailyHistory, MealType } from "@healthy-eating-ai/shared";
import { getDailyHistory } from "../api/historyApi";
import { NutritionSummaryCard } from "../components/NutritionSummaryCard";
import "./HistoryPage.css";

type Phase = "loading" | "ready" | "target-not-found" | "invalid-date" | "error";

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function formatKcal(value: number): string {
  return `${value} kcal`;
}

function formatGrams(value: number): string {
  return `${value} g`;
}

/**
 * Local calendar date as YYYY-MM-DD - deliberately built from the local
 * getters (not toISOString().slice()), which would report the UTC date
 * and can be a day off from what the user sees on their own calendar.
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMealTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function HistoryPage() {
  const [date, setDate] = useState<string>(() => formatLocalDate(new Date()));
  const [phase, setPhase] = useState<Phase>("loading");
  const [history, setHistory] = useState<DailyHistory | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Clears any previously loaded date's data immediately so a slow
    // request never leaves stale values on screen while the new one loads.
    setPhase("loading");
    setHistory(null);

    void getDailyHistory(date).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.kind === "found") {
        setHistory(result.history);
        setPhase("ready");
      } else if (result.kind === "target_not_found") {
        setPhase("target-not-found");
      } else if (result.kind === "invalid_date") {
        setPhase("invalid-date");
      } else {
        setPhase("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [date]);

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (value) {
      setDate(value);
    }
  }

  return (
    <section>
      <h1>History</h1>

      <div className="history-page__date-field">
        <label htmlFor="history-date">Date</label>
        <input id="history-date" type="date" value={date} onChange={handleDateChange} />
      </div>

      {phase === "loading" && <p className="history-page__message">Loading history...</p>}

      {phase === "target-not-found" && (
        <div className="history-page__message history-page__message--error" role="alert">
          <p>Nutrition target is not available. Calculate your nutrition target first.</p>
          <Link className="history-page__action" to="/dashboard">
            Go to Dashboard
          </Link>
        </div>
      )}

      {phase === "invalid-date" && (
        <p className="history-page__message history-page__message--error" role="alert">
          The selected date is invalid.
        </p>
      )}

      {phase === "error" && (
        <p className="history-page__message history-page__message--error" role="alert">
          Unable to load history
        </p>
      )}

      {phase === "ready" && history && (
        <>
          <h2 className="history-page__section-heading">Daily Summary</h2>
          <div className="nutrition-cards">
            <NutritionSummaryCard
              label="Calories"
              target={formatKcal(history.target.calories)}
              consumed={formatKcal(history.consumed.calories)}
              remaining={formatKcal(history.remaining.calories)}
            />
            <NutritionSummaryCard
              label="Protein"
              target={formatGrams(history.target.proteinG)}
              consumed={formatGrams(history.consumed.proteinG)}
              remaining={formatGrams(history.remaining.proteinG)}
            />
            <NutritionSummaryCard
              label="Fat"
              target={formatGrams(history.target.fatG)}
              consumed={formatGrams(history.consumed.fatG)}
              remaining={formatGrams(history.remaining.fatG)}
            />
            <NutritionSummaryCard
              label="Carbohydrates"
              target={formatGrams(history.target.carbsG)}
              consumed={formatGrams(history.consumed.carbsG)}
              remaining={formatGrams(history.remaining.carbsG)}
            />
          </div>

          <h2 className="history-page__section-heading">Meals</h2>
          {history.meals.length === 0 ? (
            <p>No meals recorded for this date.</p>
          ) : (
            <ul className="history-meals-list">
              {history.meals.map((meal) => (
                <li key={meal.id} className="history-meals-list__item">
                  <p className="history-meals-list__time">{formatMealTime(meal.eatenAt)}</p>
                  <h3 className="history-meals-list__type">{MEAL_TYPE_LABELS[meal.mealType]}</h3>
                  <p className="history-meals-list__calories">{meal.calories} kcal</p>
                  <p className="history-meals-list__macros">
                    Protein {meal.proteinG} g &middot; Fat {meal.fatG} g &middot; Carbohydrates {meal.carbsG} g
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
