import { Category, ExpenseType } from "./types";

export function generateItemName(
  category: Category | null,
  type: ExpenseType | null,
  date: string // YYYY-MM-DD
): string {
  if (!category) return "";

  const d = new Date(date + "T00:00:00");
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();

  if (type === "Recurring Bill") {
    return `${category} — ${month} ${year}`;
  }

  return category;
}
