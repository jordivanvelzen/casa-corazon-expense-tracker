import { Expense } from "./types";
import { calculateKarenOwes } from "./calculateKarenOwes";

/**
 * The effective deduction amount for a "Deduct from rent" expense.
 * Always recalculated from source fields so stale stored karensOwes doesn't matter.
 */
export function effectiveDeductionAmount(e: Expense): number {
  return calculateKarenOwes(e.amount, e.split, e.paidBy, e.category);
}

/** Get expenses approved for rent deduction but not yet settled */
export function getApprovedDeductions(expenses: Expense[]): Expense[] {
  return expenses.filter(
    (e) =>
      e.split === "Deduct from rent" &&
      !e.toDiscuss &&
      e.settlement.length === 0 &&
      effectiveDeductionAmount(e) > 0
  );
}

/** Get expenses pending Karen's approval for rent deduction */
export function getPendingDeductions(expenses: Expense[]): Expense[] {
  return expenses.filter(
    (e) =>
      e.split === "Deduct from rent" &&
      e.toDiscuss &&
      e.settlement.length === 0
  );
}

/** Calculate adjusted rent given base rent and approved deductions */
export function calculateAdjustedRent(
  baseRent: number,
  approvedDeductions: Expense[]
): number {
  const totalDeductions = approvedDeductions.reduce(
    (sum, e) => sum + effectiveDeductionAmount(e),
    0
  );
  return Math.max(0, Math.round((baseRent - totalDeductions) * 100) / 100);
}
