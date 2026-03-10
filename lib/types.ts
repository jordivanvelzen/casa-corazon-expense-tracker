export type Split = "Shared (all 3)" | "N&J only" | "Karen only" | "Deduct from rent";

export type PaidBy = "Nash & Jordi" | "Karen";

export type ExpenseType = "Recurring Bill" | "One-Off" | "Settlement";

export type Status = "Paid" | "Pending";

export type SettlementMethod =
  | "Direct payment"
  | "Rent deduction"
  | "Bank transfer";

export type Category =
  | "Rent"
  | "Internet"
  | "Electricity"
  | "Gas"
  | "Water Filter"
  | "Kitchen"
  | "Garden"
  | "Cleaning"
  | "House Supplies"
  | "Pet"
  | "Maintenance"
  | "Loan"
  | "Other";

export interface Expense {
  id: string;
  notionUrl: string;
  item: string;
  amount: number;
  karensOwes: number;
  date: string; // ISO date string YYYY-MM-DD
  category: Category | null;
  paidBy: PaidBy | null;
  split: Split | null;
  type: ExpenseType | null;
  status: Status | null;
  settlementMethod: SettlementMethod | null;
  toDiscuss: boolean;
  notes: string;
  settlement: string[]; // array of related page IDs
}
