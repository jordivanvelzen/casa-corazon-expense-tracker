"use client";

import { useState, useEffect, useCallback } from "react";
import { Expense } from "@/lib/types";
import ExpenseRow from "@/components/ExpenseRow";
import Spinner from "@/components/Spinner";
import Toast from "@/components/Toast";

export default function ReviewPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid response");
      setExpenses(data as Expense[]);
    } catch {
      setToast({ message: "Failed to load expenses", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleApprove = async (id: string) => {
    setUpdating((prev) => new Set(prev).add(id));
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, toDiscuss: false } : e)));

    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toDiscuss: false }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: "Approved", type: "success" });
    } catch {
      fetchExpenses();
      setToast({ message: "Failed to update", type: "error" });
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleResolve = async (id: string) => {
    setUpdating((prev) => new Set(prev).add(id));
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, toDiscuss: false } : e)));

    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toDiscuss: false }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: "Resolved", type: "success" });
    } catch {
      fetchExpenses();
      setToast({ message: "Failed to update", type: "error" });
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const pendingRentDeductions = expenses.filter(
    (e) => e.split === "Deduct from rent" && e.toDiscuss && e.settlement.length === 0
  );

  const toDiscussItems = expenses.filter(
    (e) => e.toDiscuss && e.split !== "Deduct from rent"
  );

  const hasItems = pendingRentDeductions.length > 0 || toDiscussItems.length > 0;

  return (
    <div className="px-4 pt-4 pb-24">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-4">For Review</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8 text-orange-500" />
        </div>
      ) : !hasItems ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">&#10003;</p>
          <p className="text-gray-500">Nothing to review</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Rent Deductions */}
          {pendingRentDeductions.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
                Pending Rent Deductions
              </h2>
              <div className="space-y-3">
                {pendingRentDeductions.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    showKarenOwes
                    action={
                      <button
                        onClick={() => handleApprove(expense.id)}
                        disabled={updating.has(expense.id)}
                        className="w-full py-2.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                      >
                        {updating.has(expense.id) ? "Updating..." : "Approve"}
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* To Discuss */}
          {toDiscussItems.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
                To Discuss
              </h2>
              <div className="space-y-3">
                {toDiscussItems.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    showKarenOwes
                    action={
                      <button
                        onClick={() => handleResolve(expense.id)}
                        disabled={updating.has(expense.id)}
                        className="w-full py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                      >
                        {updating.has(expense.id) ? "Updating..." : "Resolved"}
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
