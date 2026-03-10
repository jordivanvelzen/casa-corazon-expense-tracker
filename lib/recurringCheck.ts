import { Expense, Category } from "./types";
import { RECURRING_CATEGORIES } from "./categoryRules";

export interface MissingRecurring {
  category: Category;
  month: string; // "March 2026"
  year: number;
  monthIndex: number; // 0-11
}

export function getMissingRecurringForMonth(
  expenses: Expense[],
  year: number,
  monthIndex: number
): MissingRecurring[] {
  const month = new Date(year, monthIndex, 1).toLocaleString("en-US", {
    month: "long",
  });

  return RECURRING_CATEGORIES.filter((category) => {
    const exists = expenses.some((e) => {
      if (e.type !== "Recurring Bill") return false;
      if (e.category !== category) return false;
      const d = new Date(e.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    });
    return !exists;
  }).map((category) => ({ category, month, year, monthIndex }));
}
