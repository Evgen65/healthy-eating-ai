import { createContext, useContext, useState, type ReactNode } from "react";
import { getCurrentWeekStart } from "../utils/week";

interface SelectedWeek {
  startDate: string;
  setStartDate: (startDate: string) => void;
}

const SelectedWeekContext = createContext<SelectedWeek | null>(null);

/**
 * The week (YYYY-MM-DD startDate) selected on Plan or Shopping, shared by
 * both tabs so Shopping always shows the list for the same week the user is
 * looking at in Plan (and vice versa). Lives in the authenticated tabs
 * layout, so it resets to the current week after logout/login.
 */
export function SelectedWeekProvider({ children }: { children: ReactNode }) {
  const [startDate, setStartDate] = useState(() => getCurrentWeekStart());
  return <SelectedWeekContext.Provider value={{ startDate, setStartDate }}>{children}</SelectedWeekContext.Provider>;
}

export function useSelectedWeek(): SelectedWeek {
  const value = useContext(SelectedWeekContext);
  if (!value) {
    throw new Error("useSelectedWeek must be used inside SelectedWeekProvider");
  }
  return value;
}
