"use client";

import { useState, useEffect, useCallback } from "react";
import { Expense, Category } from "@/lib/types";
import { CATEGORY_RULES } from "@/lib/categoryRules";
import { getMissingRecurringForMonth, MissingRecurring } from "@/lib/recurringCheck";
import { generateItemName } from "@/lib/generateItemName";
import Spinner from "./Spinner";

interface RecurringBannerProps {
  onAdded: () => void;
}

export default function RecurringBanner({ onAdded }: RecurringBannerProps) {
  const [missing, setMissing] = useState<MissingRecurring[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("recurringBannerDismissed")) {
      setDismissed(true);
      return;
    }

    fetch("/api/expenses")
      .then((r) => r.json())
      .then((data: Expense[]) => {
        setExpenses(data);
        const now = new Date();
        const m = getMissingRecurringForMonth(data, now.getFullYear(), now.getMonth());
        setMissing(m);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const getLastAmount = useCallback(
    (category: Category): number => {
      const match = expenses.find(
        (e) => e.category === category && e.type === "Recurring Bill"
      );
      return match ? match.amount : 0;
    },
    [expenses]
  );

  const handleAddAll = async () => {
    setAdding(true);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    for (const m of missing) {
      const rule = CATEGORY_RULES[m.category];
      const amount = getLastAmount(m.category);
      const item = generateItemName(m.category, "Recurring Bill", dateStr);

      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          amount,
          date: dateStr,
          category: m.category,
          paidBy: rule.paidBy || "Nash & Jordi",
          split: rule.split || "Shared (all 3)",
          type: "Recurring Bill",
          status: "Pending",
          toDiscuss: false,
          notes: "",
        }),
      });
    }

    setAdding(false);
    setMissing([]);
    onAdded();
  };

  const handleDismiss = () => {
    sessionStorage.setItem("recurringBannerDismissed", "1");
    setDismissed(true);
  };

  if (dismissed || !loaded || missing.length === 0) return null;

  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-amber-800">
            <span className="font-medium">📅 {monthName}</span> — missing recurring:{" "}
            <span className="font-semibold">
              {missing.map((m) => m.category).join(", ")}
            </span>
          </p>
          <button
            onClick={handleAddAll}
            disabled={adding}
            className="mt-2 text-sm font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50 flex items-center gap-2"
          >
            {adding ? <><Spinner className="h-4 w-4" /> Adding...</> : "Add all"}
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-600 ml-2 text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
