"use client";

import { useState, useEffect, useCallback } from "react";
import { Expense, Split, Category } from "@/lib/types";
import { calculateKarenOwes } from "@/lib/calculateKarenOwes";
import { CATEGORY_RULES } from "@/lib/categoryRules";
import ExpenseRow from "@/components/ExpenseRow";
import Spinner from "@/components/Spinner";
import Toast from "@/components/Toast";

/**
 * Returns the split to use for an expense — stored value, or falls back
 * to the category's default rule if no split has been explicitly set.
 */
function effectiveSplit(expense: Expense): Split | null {
  if (expense.split) return expense.split;
  const rule = expense.category
    ? CATEGORY_RULES[expense.category as Category]
    : null;
  return rule?.split ?? null;
}

const SPLIT_OPTIONS: Split[] = [
  "Shared (all 3)",
  "N&J only",
  "Karen only",
  "Deduct from rent",
];

function formatDecision(action: string, comment?: string): string {
  const d = new Date();
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  const dateStr = `${month} ${day}, ${year}`;
  let entry = `[${dateStr}] ${action}`;
  if (comment?.trim()) entry += `. Note: ${comment.trim()}`;
  return entry;
}

function appendDecision(existingNotes: string, decision: string): string {
  return existingNotes ? `${existingNotes}\n${decision}` : decision;
}

export default function ReviewPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Approve flow state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [approveComment, setApproveComment] = useState("");

  // Change-split flow state
  const [changingSplitId, setChangingSplitId] = useState<string | null>(null);
  const [newSplit, setNewSplit] = useState<Split>("Shared (all 3)");
  const [splitNote, setSplitNote] = useState("");

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

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed");
  };

  const setUpdatingId = (id: string, active: boolean) => {
    setUpdating((prev) => {
      const next = new Set(prev);
      active ? next.add(id) : next.delete(id);
      return next;
    });
  };

  // Approve a pending rent deduction
  const handleApproveRentDeduction = async (expense: Expense) => {
    const { id } = expense;
    setUpdatingId(id, true);
    try {
      // Recalculate the correct karensOwes in case the stored value is stale
      const liveOwes = calculateKarenOwes(
        expense.amount,
        expense.split,
        expense.paidBy,
        expense.category
      );
      const decision = formatDecision("Approved rent deduction");
      const newNotes = appendDecision(expense.notes, decision);
      await patch(id, { toDiscuss: false, karensOwes: liveOwes, notes: newNotes });
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, toDiscuss: false, karensOwes: liveOwes, notes: newNotes }
            : e
        )
      );
      setToast({ message: "Approved", type: "success" });
    } catch {
      fetchExpenses();
      setToast({ message: "Failed to update", type: "error" });
    } finally {
      setUpdatingId(id, false);
    }
  };

  // Confirm approval for a to-discuss item
  const handleApproveConfirm = async (expense: Expense) => {
    const { id } = expense;
    setUpdatingId(id, true);
    try {
      // Always recalculate so stale/missing stored values don't affect the label or balance.
      // effectiveSplit falls back to the category default if no split is stored.
      const split = effectiveSplit(expense);
      const liveOwes = calculateKarenOwes(
        expense.amount,
        split,
        expense.paidBy,
        expense.category
      );
      const actionLabel =
        liveOwes > 0
          ? "Approved by Karen"
          : liveOwes < 0
          ? "Approved by Nash & Jordi"
          : "Approved";
      const decision = formatDecision(actionLabel, approveComment);
      const newNotes = appendDecision(expense.notes, decision);
      // Patch split too if it was inferred (wasn't stored)
      const patchBody: Record<string, unknown> = {
        toDiscuss: false,
        karensOwes: liveOwes,
        notes: newNotes,
      };
      if (!expense.split && split) patchBody.split = split;
      await patch(id, patchBody);
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                toDiscuss: false,
                karensOwes: liveOwes,
                split: split ?? e.split,
                notes: newNotes,
              }
            : e
        )
      );
      setConfirmingId(null);
      setApproveComment("");
      setToast({ message: "Done", type: "success" });
    } catch {
      fetchExpenses();
      setToast({ message: "Failed to update", type: "error" });
    } finally {
      setUpdatingId(id, false);
    }
  };

  // Apply split change to a to-discuss item
  const handleChangeSplit = async (expense: Expense) => {
    const { id } = expense;
    setUpdatingId(id, true);
    try {
      const newKarensOwes = calculateKarenOwes(
        expense.amount,
        newSplit,
        expense.paidBy,
        expense.category
      );
      const decision = formatDecision(
        `Split changed to "${newSplit}"`,
        splitNote
      );
      const newNotes = appendDecision(expense.notes, decision);
      await patch(id, {
        split: newSplit,
        karensOwes: newKarensOwes,
        notes: newNotes,
      });
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, split: newSplit, karensOwes: newKarensOwes, notes: newNotes }
            : e
        )
      );
      setChangingSplitId(null);
      setSplitNote("");
      setToast({ message: "Split updated", type: "success" });
    } catch {
      fetchExpenses();
      setToast({ message: "Failed to update", type: "error" });
    } finally {
      setUpdatingId(id, false);
    }
  };

  const pendingRentDeductions = expenses.filter(
    (e) =>
      e.split === "Deduct from rent" &&
      e.toDiscuss &&
      e.settlement.length === 0
  );

  const toDiscussItems = expenses.filter(
    (e) => e.toDiscuss && e.split !== "Deduct from rent"
  );

  const hasItems =
    pendingRentDeductions.length > 0 || toDiscussItems.length > 0;

  return (
    <div className="px-4 pt-4 pb-24">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
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
          {/* ── Pending Rent Deductions ── */}
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
                    action={
                      <>
                        {expense.notes && (
                          <p className="text-xs text-gray-400 mb-2 whitespace-pre-line">
                            {expense.notes}
                          </p>
                        )}
                        <button
                          onClick={() => handleApproveRentDeduction(expense)}
                          disabled={updating.has(expense.id)}
                          className="w-full py-2.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          {updating.has(expense.id) ? "Updating..." : "Approve"}
                        </button>
                      </>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── To Discuss ── */}
          {toDiscussItems.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
                To Discuss
              </h2>
              <div className="space-y-3">
                {toDiscussItems.map((expense) => {
                  const isConfirming = confirmingId === expense.id;
                  const isChangingSplit = changingSplitId === expense.id;

                  const liveOwes = calculateKarenOwes(
                    expense.amount,
                    effectiveSplit(expense),
                    expense.paidBy,
                    expense.category
                  );

                  const approveLabel =
                    liveOwes > 0
                      ? "Approved by Karen"
                      : liveOwes < 0
                      ? "Approved by Nash & Jordi"
                      : "Approve";

                  const approveColor =
                    liveOwes > 0
                      ? "text-green-600 bg-green-50 hover:bg-green-100"
                      : liveOwes < 0
                      ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                      : "text-gray-600 bg-gray-50 hover:bg-gray-100";

                  return (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      showKarenOwes
                      action={
                        <div className="space-y-2">
                          {expense.notes && (
                            <p className="text-xs text-gray-400 whitespace-pre-line">
                              {expense.notes}
                            </p>
                          )}

                          {/* Change split inline form */}
                          {isChangingSplit ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1">
                                {SPLIT_OPTIONS.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => setNewSplit(s)}
                                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                      newSplit === s
                                        ? "bg-orange-500 text-white"
                                        : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {s === "Deduct from rent" ? "Rent ded." : s}
                                  </button>
                                ))}
                              </div>
                              <input
                                type="text"
                                value={splitNote}
                                onChange={(e) => setSplitNote(e.target.value)}
                                placeholder="Note (optional)"
                                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-orange-400 outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleChangeSplit(expense)}
                                  disabled={updating.has(expense.id)}
                                  className="flex-1 py-2 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50"
                                >
                                  {updating.has(expense.id)
                                    ? "Updating..."
                                    : "Apply"}
                                </button>
                                <button
                                  onClick={() => setChangingSplitId(null)}
                                  className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : isConfirming ? (
                            /* Approve confirm form */
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={approveComment}
                                onChange={(e) =>
                                  setApproveComment(e.target.value)
                                }
                                placeholder="Comment (optional)"
                                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-orange-400 outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveConfirm(expense)}
                                  disabled={updating.has(expense.id)}
                                  className="flex-1 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                  {updating.has(expense.id)
                                    ? "Updating..."
                                    : "Confirm"}
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmingId(null);
                                    setApproveComment("");
                                  }}
                                  className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Default action buttons */
                            <div className="flex gap-2">
                              {expense.category !== "Loan" && (
                                <button
                                  onClick={() => {
                                    setChangingSplitId(expense.id);
                                    setConfirmingId(null);
                                    setNewSplit(
                                      expense.split ?? "Shared (all 3)"
                                    );
                                    setSplitNote("");
                                  }}
                                  className="flex-1 py-2.5 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                                >
                                  Change split
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setConfirmingId(expense.id);
                                  setChangingSplitId(null);
                                  setApproveComment("");
                                }}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${approveColor}`}
                              >
                                {approveLabel}
                              </button>
                            </div>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
