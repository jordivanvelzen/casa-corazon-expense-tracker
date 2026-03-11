"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Expense } from "@/lib/types";
import {
  getApprovedDeductions,
  getPendingDeductions,
  calculateAdjustedRent,
  effectiveDeductionAmount,
} from "@/lib/rentDeductions";
import ExpenseRow from "@/components/ExpenseRow";
import Spinner from "@/components/Spinner";
import Toast from "@/components/Toast";

export default function UnpaidPage() {
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [baseRent, setBaseRent] = useState(3000);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<Set<string>>(new Set());
  const [payingRentId, setPayingRentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [expRes, cfgRes] = await Promise.all([
        fetch("/api/expenses"),
        fetch("/api/config"),
      ]);
      if (!expRes.ok) throw new Error("API error");
      const data = await expRes.json();
      const config = await cfgRes.json();
      if (!Array.isArray(data)) throw new Error("Invalid response");
      setAllExpenses(data as Expense[]);
      setBaseRent(config.baseRent ?? 3000);
    } catch {
      setToast({ message: "Failed to load expenses", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const pendingExpenses = allExpenses
    .filter((e) => e.status === "Pending")
    .sort((a, b) => a.date.localeCompare(b.date));

  const approvedDeductions = getApprovedDeductions(allExpenses);
  const pendingDeductions = getPendingDeductions(allExpenses);
  const adjustedRent = calculateAdjustedRent(baseRent, approvedDeductions);

  const markAsPaid = async (id: string) => {
    setMarkingPaid((prev) => new Set(prev).add(id));
    setAllExpenses((prev) => prev.map((e) => e.id === id ? { ...e, status: "Paid" } : e));
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paid" }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: "Marked as paid ✓", type: "success" });
    } catch {
      fetchAll();
      setToast({ message: "Failed to update", type: "error" });
    } finally {
      setMarkingPaid((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handlePayRent = async (rentEntry: Expense) => {
    setPayingRentId(rentEntry.id);
    try {
      const res = await fetch("/api/rent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rentId: rentEntry.id,
          date: rentEntry.date,
          deductions: approvedDeductions.map((d) => ({
            id: d.id,
            karenOwes: effectiveDeductionAmount(d),
            item: d.item,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: "Rent paid ✓", type: "success" });
      await fetchAll();
    } catch {
      setToast({ message: "Failed to process rent", type: "error" });
    } finally {
      setPayingRentId(null);
    }
  };

  const isRentEntry = (e: Expense) =>
    e.type === "Recurring Bill" && e.category === "Rent";

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
      ) : pendingExpenses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">✓</p>
          <p className="text-gray-500">All expenses are paid</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingExpenses.map((expense) =>
            isRentEntry(expense) ? (
              /* ── Rent entry: show deduction card ── */
              <div
                key={expense.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{expense.item}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(expense.date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                    Unpaid
                  </span>
                </div>

                {/* Deduction breakdown */}
                <div className="text-xs space-y-1 text-gray-600 bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span>Base rent</span>
                    <span>MXN ${baseRent.toLocaleString()}</span>
                  </div>
                  {approvedDeductions.map((d) => (
                    <div key={d.id} className="flex justify-between text-green-700">
                      <span className="truncate mr-2">- {d.item}</span>
                      <span className="shrink-0">-${effectiveDeductionAmount(d).toFixed(2)}</span>
                    </div>
                  ))}
                  {approvedDeductions.length === 0 && (
                    <p className="text-gray-400 italic">No approved deductions</p>
                  )}
                  <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                    <span>Total</span>
                    <span>MXN ${adjustedRent.toLocaleString()}</span>
                  </div>
                </div>

                {/* Pending deductions notice */}
                {pendingDeductions.length > 0 && (
                  <p className="text-xs text-amber-600">
                    + {pendingDeductions.length} item{pendingDeductions.length !== 1 ? "s" : ""} pending Karen&apos;s approval{" "}
                    <Link href="/review" className="underline font-medium">Review →</Link>
                  </p>
                )}

                <button
                  onClick={() => handlePayRent(expense)}
                  disabled={payingRentId === expense.id}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1 transition-all"
                >
                  {payingRentId === expense.id ? (
                    <><Spinner className="h-4 w-4" /> Processing...</>
                  ) : (
                    "Apply deductions & mark paid"
                  )}
                </button>
              </div>
            ) : (
              /* ── Regular pending expense ── */
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
            )
          )}
        </div>
      )}
    </div>
  );
}
