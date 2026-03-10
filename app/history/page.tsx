"use client";

import { useState, useEffect, useMemo } from "react";
import { Expense } from "@/lib/types";
import ExpenseRow from "@/components/ExpenseRow";
import Spinner from "@/components/Spinner";

export default function HistoryPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"unsettled" | "all">("unsettled");
  const [selectedSettlement, setSelectedSettlement] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/expenses")
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setExpenses(data as Expense[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Settlement rows (Type = "Settlement")
  const settlements = useMemo(
    () =>
      expenses
        .filter((e) => e.type === "Settlement")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses]
  );

  // Filtered expenses
  const filtered = useMemo(() => {
    if (selectedSettlement) {
      const settlement = expenses.find((e) => e.id === selectedSettlement);
      if (!settlement) return [];
      // Show expenses whose settlement array contains this settlement ID
      return expenses.filter(
        (e) => e.settlement.includes(selectedSettlement) && e.id !== selectedSettlement
      );
    }

    if (viewMode === "unsettled") {
      return expenses
        .filter((e) => e.settlement.length === 0 && e.type !== "Settlement")
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    // "all" mode
    return expenses
      .filter((e) => e.type !== "Settlement")
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, viewMode, selectedSettlement]);

  const selectedSettlementData = selectedSettlement
    ? expenses.find((e) => e.id === selectedSettlement)
    : null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-4">History</h1>

      {/* View toggle */}
      <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
        {(["unsettled", "all"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              setViewMode(mode);
              setSelectedSettlement(null);
            }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all capitalize ${
              viewMode === mode && !selectedSettlement
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Settlement filter */}
      {settlements.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">
            Filter by Settlement
          </label>
          <select
            value={selectedSettlement || ""}
            onChange={(e) => {
              setSelectedSettlement(e.target.value || null);
              if (e.target.value) setViewMode("all");
            }}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm bg-white"
          >
            <option value="">No filter</option>
            {settlements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.item} — {new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selected settlement summary */}
      {selectedSettlementData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-blue-800">
            {selectedSettlementData.item}
          </p>
          <div className="flex gap-4 mt-1 text-xs text-blue-600">
            <span>Amount: ${selectedSettlementData.amount.toFixed(2)}</span>
            {selectedSettlementData.settlementMethod && (
              <span>Method: {selectedSettlementData.settlementMethod}</span>
            )}
            <span>
              {new Date(selectedSettlementData.date + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" }
              )}
            </span>
          </div>
        </div>
      )}

      {/* Expense list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No expenses found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              showKarenOwes
            />
          ))}
        </div>
      )}
    </div>
  );
}
