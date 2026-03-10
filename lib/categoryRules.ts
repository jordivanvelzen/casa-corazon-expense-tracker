import { Category, Split, PaidBy } from "./types";

interface CategoryRule {
  split: Split | null;
  paidBy: PaidBy | null;
}

export const CATEGORY_RULES: Record<Category, CategoryRule> = {
  Rent: { split: "N&J only", paidBy: "Nash & Jordi" },
  Internet: { split: "Shared (all 3)", paidBy: "Nash & Jordi" },
  Gas: { split: "Shared (all 3)", paidBy: "Nash & Jordi" },
  "Water Filter": { split: "Shared (all 3)", paidBy: null },
  Electricity: { split: "Shared (all 3)", paidBy: "Karen" },
  Garden: { split: "Shared (all 3)", paidBy: "Nash & Jordi" },
  Kitchen: { split: "Shared (all 3)", paidBy: "Nash & Jordi" },
  Cleaning: { split: "Shared (all 3)", paidBy: "Nash & Jordi" },
  "House Supplies": { split: "Shared (all 3)", paidBy: "Nash & Jordi" },
  Pet: { split: "Shared (all 3)", paidBy: "Nash & Jordi" },
  Maintenance: { split: "Shared (all 3)", paidBy: "Nash & Jordi" },
  Loan: { split: "N&J only", paidBy: "Nash & Jordi" },
  Other: { split: null, paidBy: null },
};

export const RECURRING_CATEGORIES: Category[] = ["Rent", "Internet"];
