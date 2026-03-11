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
import Spinner from "@/components/Spinner";
import Toast from "@/components/Toast";

interface MonthlyBreakdown {
  key: string;
  label: string;
  karenPaid: number;
  njPaid: number;
  monthlyNet: number;
  settled: boolean;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  items: Expense[];
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function autoSettlementName(date: string): string {
  const d = new Date(date + "T00:00:00");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = String(d.getFullYear()).slice(-2);
  return `Settlement ${month} ${year}`;
}

export default function BalancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [baseRent, setBaseRent] = useState(3000);
  const [loading, setLoading] = useState(true);

  // Create settlement state
  const [showCreate, setShowCreate] = useState(false);
  const [settlDate, setSettlDate] = useState(todayStr);
  const [settlMethod, setSettlMethod] = useState<
    "Cash payment" | "Bank transfer"
  >("Cash payment");
  const [settlName, setSettlName] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Collapsible category
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    return Promise.all([
      fetch("/api/expenses").then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      }),
      fetch("/api/config").then((r) => r.json()),
    ])
      .then(([data, config]: [unknown, { baseRent: number }]) => {
        if (Array.isArray(data)) setExpenses(data as Expense[]);
        setBaseRent(config.baseRent);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Exclude toDiscuss from unsettled balance
  const unsettled = expenses.filter(
    (e) =>
      e.settlement.length === 0 &&
      e.type !== "Settlement" &&
      !e.toDiscuss
  );

  // Net balance
  const netBalance = unsettled.reduce((sum, e) => sum + e.karensOwes, 0);
  const roundedBalance = Math.round(netBalance * 100) / 100;

  // Last settlement
  const lastSettlement = expenses
    .filter((e) => e.type === "Settlement")
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const daysAgo = lastSettlement
    ? Math.floor(
        (new Date().getTime() -
          new Date(lastSettlement.date + "T00:00:00").getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Monthly breakdown (exclude toDiscuss)
  const monthlyMap = new Map<string, { expenses: Expense[]; key: string }>();
  for (const e of expenses) {
    if (e.type === "Settlement") continue;
    if (e.toDiscuss) continue;
    if (!e.date) continue;
    const d = new Date(e.date + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap.has(key)) monthlyMap.set(key, { expenses: [], key });
    monthlyMap.get(key)!.expenses.push(e);
  }

  const sortedMonths = Array.from(monthlyMap.entries()).sort(([a], [b]) =>
    b.localeCompare(a)
  );

  const monthlyBreakdowns: MonthlyBreakdown[] = [];
  const chronological = [...sortedMonths].reverse();
  for (const [, { expenses: monthExpenses, key }] of chronological) {
    const d = new Date(key + "-01T00:00:00");
    const label = d.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });

    let karenPaid = 0;
    let njPaid = 0;
    let netDebt = 0;
    let allSettled = true;

    for (const e of monthExpenses) {
      if (e.paidBy === "Karen") karenPaid += e.amount;
      else if (e.paidBy === "Nash & Jordi") njPaid += e.amount;
      netDebt += e.karensOwes;
      if (e.settlement.length === 0) allSettled = false;
    }

    const monthlyNet = Math.round(netDebt * 100) / 100;

    monthlyBreakdowns.push({
      key,
      label,
      karenPaid: Math.round(karenPaid * 100) / 100,
      njPaid: Math.round(njPaid * 100) / 100,
      monthlyNet,
      settled: allSettled,
    });
  }
  monthlyBreakdowns.reverse();

  // Category breakdown (unsettled only, exclude toDiscuss)
  const categoryMap = new Map<string, { total: number; items: Expense[] }>();
  for (const e of unsettled) {
    if (e.karensOwes === 0) continue;
    const cat = e.category || "Other";
    if (!categoryMap.has(cat)) categoryMap.set(cat, { total: 0, items: [] });
    const entry = categoryMap.get(cat)!;
    entry.total += e.karensOwes;
    entry.items.push(e);
  }

  const categoryBreakdowns: CategoryBreakdown[] = Array.from(
    categoryMap.entries()
  )
    .map(([category, { total, items }]) => ({
      category,
      total: Math.round(total * 100) / 100,
      items,
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  // Qualifying items for settlement
  const qualifyingItems = expenses.filter(
    (e) =>
      (e.split === "Shared (all 3)" || e.category === "Loan") &&
      !e.toDiscuss &&
      e.settlement.length === 0 &&
      e.type !== "Settlement"
  );
  const qualifyingNet =
    Math.round(
      qualifyingItems.reduce((sum, e) => sum + e.karensOwes, 0) * 100
    ) / 100;

  const handleCreateSettlement = async () => {
    setCreating(true);
    try {
      const name = settlName.trim() || autoSettlementName(settlDate);
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date: settlDate,
          amount: Math.abs(qualifyingNet),
          method: settlMethod,
          itemIds: qualifyingItems.map((e) => e.id),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setShowCreate(false);
      setSettlDate(todayStr());
      setSettlName("");
      setSettlMethod("Cash payment");
      setLoading(true);
      await fetchAll();
      setToast({ message: "Settlement created", type: "success" });
    } catch {
      setToast({ message: "Failed to create settlement", type: "error" });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-4">Balance</h1>

      {/* Net balance */}
      <div
        className={`rounded-xl p-5 mb-2 ${
          roundedBalance > 0
            ? "bg-green-50 border border-green-200"
            : roundedBalance < 0
            ? "bg-orange-50 border border-orange-200"
            : "bg-gray-50 border border-gray-200"
        }`}
      >
        <p className="text-sm text-gray-600 mb-1">Net Balance</p>
        <p
          className={`text-2xl font-bold ${
            roundedBalance > 0
              ? "text-green-700"
              : roundedBalance < 0
              ? "text-orange-700"
              : "text-gray-500"
          }`}
        >
          {roundedBalance > 0
            ? `Karen owes N&J — MXN $${roundedBalance.toFixed(2)}`
            : roundedBalance < 0
            ? `N&J owe Karen — MXN $${Math.abs(roundedBalance).toFixed(2)}`
            : "All square \u2713"}
        </p>
      </div>

      {/* Last settlement info */}
      <p className="text-xs text-gray-400 mb-4 px-1">
        {daysAgo !== null
          ? `Last settlement: ${daysAgo === 0 ? "today" : `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`}`
          : "No settlements yet"}
      </p>

      {/* Create Settlement button */}
      {!showCreate ? (
        <button
          onClick={() => {
            setShowCreate(true);
            setSettlDate(todayStr());
            setSettlName(autoSettlementName(todayStr()));
          }}
          className="w-full mb-6 py-3 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 active:scale-[0.98] transition-all"
        >
          Create Settlement
        </button>
      ) : (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">New Settlement</h2>

          {/* Qualifying items list */}
          {qualifyingItems.length === 0 ? (
            <p className="text-sm text-gray-400">No qualifying items</p>
          ) : (
            <div className="space-y-1">
              {qualifyingItems.map((e) => (
                <div
                  key={e.id}
                  className="flex justify-between text-xs text-gray-600"
                >
                  <span className="truncate mr-2">{e.item}</span>
                  <span
                    className={`shrink-0 ${
                      e.karensOwes > 0 ? "text-green-600" : "text-orange-600"
                    }`}
                  >
                    {e.karensOwes > 0 ? "+" : ""}
                    {e.karensOwes.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-1">
                <span>Net</span>
                <span
                  className={
                    qualifyingNet > 0 ? "text-green-700" : "text-orange-700"
                  }
                >
                  {qualifyingNet > 0
                    ? `Karen pays MXN $${qualifyingNet.toFixed(2)}`
                    : `N&J pay MXN $${Math.abs(qualifyingNet).toFixed(2)}`}
                </span>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={settlDate}
              onChange={(e) => {
                setSettlDate(e.target.value);
                if (!settlName || settlName === autoSettlementName(settlDate)) {
                  setSettlName(autoSettlementName(e.target.value));
                }
              }}
              className="w-full h-11 px-3 rounded-lg border border-gray-200 text-sm focus:border-orange-400 outline-none"
            />
          </div>

          {/* Method */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Method
            </label>
            <div className="flex rounded-xl bg-gray-100 p-1">
              {(["Cash payment", "Bank transfer"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSettlMethod(m)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    settlMethod === m
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Name
            </label>
            <input
              type="text"
              value={settlName}
              onChange={(e) => setSettlName(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-200 text-sm focus:border-orange-400 outline-none"
            />
          </div>

          {/* Warning */}
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            &#9888; Only confirm when payment has actually been made
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateSettlement}
              disabled={creating || qualifyingItems.length === 0}
              className="flex-1 py-3 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-all"
            >
              {creating ? "Creating..." : "Create Settlement"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-3 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Next Rent Preview */}
      {(() => {
        const approved = getApprovedDeductions(expenses);
        const pending = getPendingDeductions(expenses);
        if (approved.length === 0 && pending.length === 0) return null;
        const adjustedRent = calculateAdjustedRent(baseRent, approved);
        const pendingTotal =
          Math.round(
            pending.reduce((s, e) => s + e.karensOwes, 0) * 100
          ) / 100;
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-blue-800 mb-2">
              Next Rent
            </h2>
            <div className="text-xs space-y-1 text-blue-700">
              <div className="flex justify-between">
                <span>Base rent</span>
                <span>MXN ${baseRent.toLocaleString()}</span>
              </div>
              {approved.map((d) => (
                <div
                  key={d.id}
                  className="flex justify-between text-green-700"
                >
                  <span className="truncate mr-2">- {d.item}</span>
                  <span className="shrink-0">
                    -${effectiveDeductionAmount(d).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-blue-200 pt-1 mt-1 text-blue-900">
                <span>Adjusted rent</span>
                <span>MXN ${adjustedRent.toLocaleString()}</span>
              </div>
            </div>
            {pending.length > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                + {pending.length} item{pending.length !== 1 ? "s" : ""}{" "}
                pending approval (${pendingTotal.toFixed(2)}){" "}
                <Link href="/review" className="underline">
                  Review
                </Link>
              </p>
            )}
          </div>
        );
      })()}

      {/* Monthly breakdown */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Monthly Breakdown
      </h2>
      {monthlyBreakdowns.length === 0 ? (
        <p className="text-gray-500 text-sm mb-6">No expenses yet</p>
      ) : (
        <div className="overflow-x-auto mb-6 -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-3 font-medium text-gray-500">Month</th>
                <th className="py-2 pr-3 font-medium text-gray-500 text-right">
                  Paid by Karen
                </th>
                <th className="py-2 pr-3 font-medium text-gray-500 text-right">
                  Paid by N&J
                </th>
                <th className="py-2 font-medium text-gray-500 text-right">
                  Net
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdowns.map((m) => (
                <tr key={m.key} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3 text-gray-900 whitespace-nowrap">
                    {m.label}
                    {m.settled && (
                      <span className="ml-1 text-green-500">\u2713</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-gray-700">
                    {m.karenPaid > 0 ? `$${m.karenPaid.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-gray-700">
                    {m.njPaid > 0 ? `$${m.njPaid.toFixed(2)}` : "—"}
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      m.monthlyNet > 0
                        ? "text-green-600"
                        : m.monthlyNet < 0
                        ? "text-orange-600"
                        : "text-gray-400"
                    }`}
                  >
                    {m.monthlyNet === 0
                      ? "—"
                      : m.monthlyNet > 0
                      ? `Karen $${m.monthlyNet.toFixed(2)}`
                      : `N&J $${Math.abs(m.monthlyNet).toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Category breakdown */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        By Category (Unsettled)
      </h2>
      {categoryBreakdowns.length === 0 ? (
        <p className="text-gray-500 text-sm">No unsettled debts</p>
      ) : (
        <div className="space-y-2">
          {categoryBreakdowns.map((c) => (
            <div key={c.category}>
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === c.category ? null : c.category
                  )
                }
                className="w-full flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-gray-50"
              >
                <span className="text-sm text-gray-700">{c.category}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      c.total > 0 ? "text-green-600" : "text-orange-600"
                    }`}
                  >
                    {c.total > 0
                      ? `Karen owes $${c.total.toFixed(2)}`
                      : `N&J owe $${Math.abs(c.total).toFixed(2)}`}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {expandedCategory === c.category ? "▲" : "▼"}
                  </span>
                </div>
              </button>
              {expandedCategory === c.category && (
                <div className="mt-1 bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                  {c.items.map((e) => {
                    const dateStr = e.date
                      ? new Date(e.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )
                      : "";
                    return (
                      <div
                        key={e.id}
                        className="flex justify-between items-center px-3 py-2 text-xs"
                      >
                        <span className="text-gray-600 truncate mr-2">
                          {e.item}
                          {dateStr && (
                            <span className="text-gray-400"> · {dateStr}</span>
                          )}
                        </span>
                        <span
                          className={`shrink-0 font-medium ${
                            e.karensOwes > 0
                              ? "text-green-600"
                              : "text-orange-600"
                          }`}
                        >
                          {e.karensOwes > 0 ? "+" : ""}
                          {e.karensOwes.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
