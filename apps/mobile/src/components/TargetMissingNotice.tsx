import { NavLinkButton } from "./NavLinkButton";
import { InfoText } from "./StatusMessage";

/**
 * Shown when the backend answers 404 "Nutrition target not found" (which
 * also covers a user with no profile yet) - same wording as the Web pages.
 * Dashboard then guides through calculating the target, or to Profile first.
 */
export function TargetMissingNotice() {
  return (
    <>
      <InfoText
        text="Nutrition target is not available. Calculate your nutrition target first."
        testID="target-missing"
      />
      <NavLinkButton href="/dashboard" label="Go to Dashboard" />
    </>
  );
}
