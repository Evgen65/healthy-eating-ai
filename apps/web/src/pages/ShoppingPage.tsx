import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import type { WeeklyShoppingList } from "@healthy-eating-ai/shared";
import { getWeeklyShoppingList } from "../api/shoppingListApi";
import "./ShoppingPage.css";

type Phase = "loading" | "ready" | "target-not-found" | "invalid-date" | "error";

/**
 * Local calendar date as YYYY-MM-DD - built from the local getters (not
 * toISOString().slice()), which would report the UTC date and can be a day
 * off from what the user sees on their own calendar. Mirrors
 * PlanPage.tsx's/HistoryPage.tsx's formatLocalDate.
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Monday of the local calendar week containing `date` - same default as
 * PlanPage.tsx, so both pages open on the current week. Built entirely from
 * local Date getters/constructor, never UTC, so it can't shift a day
 * relative to what the user sees on their own calendar.
 */
function getMondayOfCurrentWeek(date: Date = new Date()): string {
  const weekday = date.getDay(); // 0 (Sun) - 6 (Sat)
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetToMonday);
  return formatLocalDate(monday);
}

export function ShoppingPage() {
  const [startDate, setStartDate] = useState<string>(() => getMondayOfCurrentWeek());
  const [phase, setPhase] = useState<Phase>("loading");
  const [shoppingList, setShoppingList] = useState<WeeklyShoppingList | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Clears any previously loaded week's items immediately so a slow
    // request never leaves stale items on screen as if they belong to the
    // newly selected week.
    setPhase("loading");
    setShoppingList(null);

    void getWeeklyShoppingList(startDate).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.kind === "found") {
        setShoppingList(result.shoppingList);
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
      <h1>Weekly Shopping List</h1>

      <div className="shopping-page__date-field">
        <label htmlFor="shopping-week-start">Week start</label>
        <input id="shopping-week-start" type="date" value={startDate} onChange={handleStartDateChange} />
      </div>

      {phase === "loading" && <p className="shopping-page__message">Loading shopping list...</p>}

      {phase === "target-not-found" && (
        <div className="shopping-page__message shopping-page__message--error" role="alert">
          <p>Nutrition target is not available. Calculate your nutrition target first.</p>
          <Link className="shopping-page__action" to="/dashboard">
            Go to Dashboard
          </Link>
        </div>
      )}

      {phase === "invalid-date" && (
        <p className="shopping-page__message shopping-page__message--error" role="alert">
          The selected week start date is invalid.
        </p>
      )}

      {phase === "error" && (
        <p className="shopping-page__message shopping-page__message--error" role="alert">
          Unable to load shopping list
        </p>
      )}

      {phase === "ready" && shoppingList && (
        <>
          <p className="shopping-page__week-range">
            Week: {shoppingList.startDate} &mdash; {shoppingList.endDate}
          </p>

          <p className="shopping-page__total-items">{shoppingList.totalItems} items</p>

          <p className="shopping-page__notice" role="note">
            {shoppingList.notice}
          </p>

          <p className="shopping-page__link">
            <Link to="/plan">View weekly plan</Link>
          </p>

          {shoppingList.items.length === 0 ? (
            <p>No shopping items are available for this week.</p>
          ) : (
            <ul className="shopping-page__items">
              {shoppingList.items.map((item) => (
                <li key={`${item.name}__${item.unit}`} className="shopping-item">
                  <span className="shopping-item__name">{item.name}</span>
                  <span className="shopping-item__quantity">
                    {item.quantity} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="shopping-page__version">
            Shopping list version: {shoppingList.shoppingListVersion} &middot; Source plan version:{" "}
            {shoppingList.sourcePlanVersion}
          </p>
        </>
      )}
    </section>
  );
}
