import { Split, PaidBy } from "./types";

export function calculateKarenOwes(
  amount: number,
  split: Split | null,
  paidBy: PaidBy | null
): number {
  if (!split || !paidBy) return 0;

  if (split === "N&J only" || split === "Karen only") return 0;

  // Deduct from rent — Karen owes full amount when N&J paid
  if (split === "Deduct from rent") {
    if (paidBy === "Nash & Jordi") return Math.round(amount * 100) / 100;
    return 0;
  }

  // Shared (all 3)
  if (paidBy === "Nash & Jordi") return Math.round((amount / 3) * 100) / 100;
  if (paidBy === "Karen")
    return Math.round((-(amount * 2) / 3) * 100) / 100;

  return 0;
}
