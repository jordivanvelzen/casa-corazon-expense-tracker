"use client";

import { useState, useEffect, useCallback } from "react";
import { Expense } from "@/lib/types";
import ExpenseRow from "@/components/ExpenseRow";
import Spinner from "@/components/Spinner";
import Toast from "@/components/Toast";

export default function UnpaidPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid response");
      setExpenses((data as Expense[]).filter((e) => e.status === "Pending").sort((a, b) => a.date.localeCompare(b.date)));
    } catch {
      setToast({ message: "Failed to load expenses", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const markAsPaid = async (id: string) => {
    setMarkingPaid((prev) => new Set(prev).add(id));
    // Optimistic: remove from list
    setExpenses((prev) => prev.filter((e) => e.id !== id));

    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paid" }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: "Marked as paid \u2713", type: "success" });
    } catch {
      // Revert
      fetchExpenses();
      setToast({ message: "Failed to update", type: "error" });
    } finally {
      setMarkingPaid((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="px-4 pt-4 pb-24">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-4">Unpaid Expenses</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-orange-500" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">✓</p>
          <p className="text-gray-500">All expenses are paid</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              action={
                <button
                  onClick={() => markAsPaid(expense.id)}
                  disabled={markingPaid.has(expense.id)}
                  className="w-full py-2.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                >
                  {markingPaid.has(expense.id) ? "Updating..." : "Mark as paid"}
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
