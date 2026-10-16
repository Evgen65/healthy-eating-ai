import "./NutritionSummaryCard.css";

interface NutritionSummaryCardProps {
  label: string;
  target: string;
  consumed: string;
  remaining: string;
}

/**
 * Each row is its own `role="group"` labelled `"<nutrient> <row>"` (e.g.
 * "Calories target") so it stays reliably targetable even when its value
 * text collides with another row's - e.g. Target and Remaining render the
 * same text whenever nothing has been consumed yet.
 */
export function NutritionSummaryCard({ label, target, consumed, remaining }: NutritionSummaryCardProps) {
  return (
    <div className="nutrition-summary-card">
      <h2 className="nutrition-summary-card__label">{label}</h2>

      <div className="nutrition-summary-card__row" role="group" aria-label={`${label} target`}>
        <span className="nutrition-summary-card__row-label">Target</span>
        <span className="nutrition-summary-card__row-value">{target}</span>
      </div>

      <div className="nutrition-summary-card__row" role="group" aria-label={`${label} consumed`}>
        <span className="nutrition-summary-card__row-label">Consumed</span>
        <span className="nutrition-summary-card__row-value">{consumed}</span>
      </div>

      <div className="nutrition-summary-card__row" role="group" aria-label={`${label} remaining`}>
        <span className="nutrition-summary-card__row-label">Remaining</span>
        <span className="nutrition-summary-card__row-value">{remaining}</span>
      </div>
    </div>
  );
}
