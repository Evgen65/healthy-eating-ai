import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import type { MealType, WeeklyMealPlan } from "@healthy-eating-ai/shared";
import { getWeeklyPlan } from "../api/weeklyPlanApi";
import "./PlanPage.css";

type Phase = "loading" | "ready" | "target-not-found" | "invalid-date" | "error";

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/**
 * Local calendar date as YYYY-MM-DD - built from the local getters (not
 * toISOString().slice()), which would report the UTC date and can be a day
 * off from what the user sees on their own calendar. Mirrors
 * HistoryPage.tsx's formatLocalDate.
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Monday of the local calendar week containing `date` - a sensible default
 * so the page opens on the current week rather than an arbitrary one. Built
 * entirely from local Date getters/constructor, never UTC, so it can't
 * shift a day relative to what the user sees on their own calendar.
 */
function getMondayOfCurrentWeek(date: Date = new Date()): string {
  const weekday = date.getDay(); // 0 (Sun) - 6 (Sat)
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetToMonday);
  return formatLocalDate(monday);
}

/**
 * Display-only weekday label derived from a Backend-returned YYYY-MM-DD.
 * Built from explicit local y/m/d components (not by parsing the string as
 * an instant), so the weekday is stable regardless of the browser's
 * timezone. Never used to pick recipes or influence any business logic -
 * that decision already happened on the Backend.
 */
function getWeekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "long" });
}

function formatSignedKcal(value: number): string {
  return value > 0 ? `+${value} kcal` : `${value} kcal`;
}

function formatSignedGrams(value: number): string {
  return value > 0 ? `+${value} g` : `${value} g`;
}

function differenceClass(value: number): string {
  if (value > 0) {
    return "plan-day-card__difference-value--positive";
  }
  if (value < 0) {
    return "plan-day-card__difference-value--negative";
  }
  return "plan-day-card__difference-value--zero";
}

export function PlanPage() {
  const [startDate, setStartDate] = useState<string>(() => getMondayOfCurrentWeek());
  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Clears any previously loaded week's plan immediately so a slow
    // request never leaves stale meals on screen as if they belong to the
    // newly selected week.
    setPhase("loading");
    setPlan(null);

    void getWeeklyPlan(startDate).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.kind === "found") {
        setPlan(result.plan);
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
  }, [startDate]);

  function handleStartDateChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (value) {
      setStartDate(value);
    }
  }

  return (
    <section>
      <h1>Weekly Meal Plan</h1>

      <div className="plan-page__date-field">
        <label htmlFor="plan-week-start">Week start</label>
        <input id="plan-week-start" type="date" value={startDate} onChange={handleStartDateChange} />
      </div>

      {phase === "loading" && <p className="plan-page__message">Loading weekly plan...</p>}

      {phase === "target-not-found" && (
        <div className="plan-page__message plan-page__message--error" role="alert">
          <p>Nutrition target is not available. Calculate your nutrition target first.</p>
          <Link className="plan-page__action" to="/dashboard">
            Go to Dashboard
          </Link>
        </div>
      )}

      {phase === "invalid-date" && (
        <p className="plan-page__message plan-page__message--error" role="alert">
          The selected week start date is invalid.
        </p>
      )}

      {phase === "error" && (
        <p className="plan-page__message plan-page__message--error" role="alert">
          Unable to load weekly plan
        </p>
      )}

      {phase === "ready" && plan && (
        <>
          <p className="plan-page__week-range">
            Week: {plan.startDate} &mdash; {plan.endDate}
          </p>

          <div className="plan-page__target">
            <h2 className="plan-page__section-heading">Daily nutrition target</h2>
            <p>
              {plan.dailyTarget.calories} kcal &middot; Protein {plan.dailyTarget.proteinG} g &middot; Fat{" "}
              {plan.dailyTarget.fatG} g &middot; Carbohydrates {plan.dailyTarget.carbsG} g
            </p>
          </div>

          <p className="plan-page__notice" role="note">
            {plan.notice}
          </p>

          <p className="plan-page__version">Plan version: {plan.planVersion}</p>

          {plan.days.length === 0 ? (
            <p>No weekly plan is available.</p>
          ) : (
            <div className="plan-page__days">
              {plan.days.map((day) => (
                <article key={day.date} className="plan-day-card">
                  <h2 className="plan-day-card__weekday">{getWeekdayLabel(day.date)}</h2>
                  <p className="plan-day-card__date">{day.date}</p>

                  <div className="plan-day-card__meals">
                    {day.meals.map((meal) => (
                      <section key={meal.mealType} className="plan-meal">
                        <h3 className="plan-meal__type">{MEAL_TYPE_LABELS[meal.mealType]}</h3>
                        <p className="plan-meal__title">{meal.title}</p>

                        <p className="plan-meal__label">Ingredients</p>
                        <ul className="plan-meal__ingredients">
                          {meal.ingredients.map((ingredient, index) => (
                            <li key={index}>
                              {ingredient.quantity} {ingredient.unit} {ingredient.name}
                            </li>
                          ))}
                        </ul>

                        <p className="plan-meal__label">Planned nutrition</p>
                        <p className="plan-meal__nutrition">
                          {meal.plannedNutrition.calories} kcal &middot; Protein {meal.plannedNutrition.proteinG} g
                          &middot; Fat {meal.plannedNutrition.fatG} g &middot; Carbohydrates{" "}
                          {meal.plannedNutrition.carbsG} g
                        </p>
                      </section>
                    ))}
                  </div>

                  <div className="plan-day-card__totals">
                    <h3>Daily planned totals</h3>
                    <p>
                      {day.plannedTotals.calories} kcal &middot; Protein {day.plannedTotals.proteinG} g &middot; Fat{" "}
                      {day.plannedTotals.fatG} g &middot; Carbohydrates {day.plannedTotals.carbsG} g
                    </p>
                  </div>

                  <div className="plan-day-card__difference">
                    <h3>Difference from target</h3>
                    <ul className="plan-day-card__difference-list">
                      <li>
                        Calories:{" "}
                        <span className={differenceClass(day.differenceFromTarget.calories)}>
                          {formatSignedKcal(day.differenceFromTarget.calories)}
                        </span>
                      </li>
                      <li>
                        Protein:{" "}
                        <span className={differenceClass(day.differenceFromTarget.proteinG)}>
                          {formatSignedGrams(day.differenceFromTarget.proteinG)}
                        </span>
                      </li>
                      <li>
                        Fat:{" "}
                        <span className={differenceClass(day.differenceFromTarget.fatG)}>
                          {formatSignedGrams(day.differenceFromTarget.fatG)}
                        </span>
                      </li>
                      <li>
                        Carbohydrates:{" "}
                        <span className={differenceClass(day.differenceFromTarget.carbsG)}>
                          {formatSignedGrams(day.differenceFromTarget.carbsG)}
                        </span>
                      </li>
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
