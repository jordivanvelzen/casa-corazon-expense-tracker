"use client";

import { useState, useEffect, useCallback } from "react";
import { Expense } from "@/lib/types";
import Spinner from "@/components/Spinner";
import Toast from "@/components/Toast";

interface MonthlyBreakdown {
  key: string;
  label: string;
  karenPaid: number;
  njPaid: number;
  monthlyNet: number;
  settled: boolean;
  sharedExpenses: Expense[];
}

interface CategoryBreakdown {
  category: string;
  total: number;
  items: Expense[];
}

interface SimpleMonthGroup {
  key: string;
  label: string;
  total: number;
  net: number;
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

function groupByMonth(items: Expense[], valueKey: "amount" | "karensOwes"): SimpleMonthGroup[] {
  const map = new Map<string, Expense[]>();
  for (const e of items) {
    if (!e.date) continue;
    const d = new Date(e.date + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, exps]) => {
      const d = new Date(key + "-01T00:00:00");
      const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      const total = Math.round(exps.reduce((s, e) => s + e.amount, 0) * 100) / 100;
      const net = Math.round(exps.reduce((s, e) => s + e[valueKey], 0) * 100) / 100;
      return { key, label, total, net, items: [...exps].sort((a, b) => b.date.localeCompare(a.date)) };
    });
}

function fmtDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""} ${className ?? ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function BalancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Create settlement state
  const [showCreate, setShowCreate] = useState(false);
  const [settlDate, setSettlDate] = useState(todayStr);
  const [settlMethod, setSettlMethod] = useState<"Cash payment" | "Bank transfer">("Cash payment");
  const [settlName, setSettlName] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Collapsible state
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [netExpanded, setNetExpanded] = useState(false);
  const [expandedNetMonth, setExpandedNetMonth] = useState<string | null>(null);
  const [njExpanded, setNJExpanded] = useState(false);
  const [expandedNJMonth, setExpandedNJMonth] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    return fetch("/api/expenses")
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) setExpenses(data as Expense[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Exclude toDiscuss from unsettled balance
  const unsettled = expenses.filter(
    (e) => e.settlement.length === 0 && e.type !== "Settlement" && !e.toDiscuss
  );

  // Net balance
  const netBalance = unsettled.reduce((sum, e) => sum + e.karensOwes, 0);
  const roundedBalance = Math.round(netBalance * 100) / 100;

  // Net balance monthly groups (for collapsible net card)
  const netMonths = groupByMonth(unsettled, "karensOwes");

  // N&J only expenses
  const njOnlyExpenses = expenses.filter(
    (e) => e.split === "N&J only" && e.type !== "Settlement" && e.category !== "Rent"
  );
  const njOnlyTotal = Math.round(njOnlyExpenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  const njMonths = groupByMonth(njOnlyExpenses, "amount");

  // Last settlement
  const lastSettlement = expenses
    .filter((e) => e.type === "Settlement")
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const daysAgo = lastSettlement
    ? Math.floor(
        (new Date().getTime() - new Date(lastSettlement.date + "T00:00:00").getTime()) /
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

  const sortedMonths = Array.from(monthlyMap.entries()).sort(([a], [b]) => b.localeCompare(a));

  const monthlyBreakdowns: MonthlyBreakdown[] = [];
  const chronological = [...sortedMonths].reverse();
  for (const [, { expenses: monthExpenses, key }] of chronological) {
    const d = new Date(key + "-01T00:00:00");
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });

    const sharedExpenses = monthExpenses
      .filter((e) => e.split === "Shared (all 3)")
      .sort((a, b) => b.date.localeCompare(a.date));

    let karenPaid = 0;
    let njPaid = 0;
    let netDebt = 0;
    let allSettled = true;

    for (const e of sharedExpenses) {
      if (e.paidBy === "Karen") karenPaid += e.amount;
      else if (e.paidBy === "Nash & Jordi") njPaid += e.amount;
      netDebt += e.karensOwes;
      if (e.settlement.length === 0) allSettled = false;
    }

    monthlyBreakdowns.push({
      key,
      label,
      karenPaid: Math.round(karenPaid * 100) / 100,
      njPaid: Math.round(njPaid * 100) / 100,
      monthlyNet: Math.round(netDebt * 100) / 100,
      settled: allSettled,
      sharedExpenses,
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

  const categoryBreakdowns: CategoryBreakdown[] = Array.from(categoryMap.entries())
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
    Math.round(qualifyingItems.reduce((sum, e) => sum + e.karensOwes, 0) * 100) / 100;

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
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-4">Balance</h1>

      {/* Net balance — collapsible */}
      <div
        className={`rounded-xl mb-2 overflow-hidden ${
          roundedBalance > 0
            ? "bg-green-50 border border-green-200"
            : roundedBalance < 0
            ? "bg-orange-50 border border-orange-200"
            : "bg-gray-50 border border-gray-200"
        }`}
      >
        <button
          onClick={() => setNetExpanded(!netExpanded)}
          className="w-full p-5 text-left"
        >
          <div className="flex items-start justify-between">
            <div>
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
            {netMonths.length > 0 && (
              <Chevron open={netExpanded} className="text-gray-400 mt-1.5 ml-3 shrink-0" />
            )}
          </div>
        </button>

        {netExpanded && netMonths.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-3 space-y-0.5">
            {netMonths.map((m) => {
              const open = expandedNetMonth === m.key;
              return (
                <div key={m.key}>
                  <button
                    onClick={() => setExpandedNetMonth(open ? null : m.key)}
                    className="w-full flex items-center justify-between py-2 text-sm"
                  >
                    <span className="flex items-center gap-1.5 text-gray-700">
                      <Chevron open={open} className="text-gray-400" />
                      {m.label}
                    </span>
                    <span
                      className={`font-medium ${
                        m.net > 0 ? "text-green-600" : m.net < 0 ? "text-orange-600" : "text-gray-400"
                      }`}
                    >
                      {m.net === 0
                        ? "—"
                        : m.net > 0
                        ? `Karen owes $${m.net.toFixed(2)}`
                        : `N&J owe $${Math.abs(m.net).toFixed(2)}`}
                    </span>
                  </button>
                  {open && (
                    <div className="ml-5 mb-1 space-y-0.5">
                      {m.items.map((e) => (
                        <div key={e.id} className="flex justify-between text-xs py-1 text-gray-600">
                          <span className="truncate mr-2">
                            {e.item}
                            {e.date && <span className="text-gray-400"> · {fmtDate(e.date)}</span>}
                          </span>
                          <span
                            className={`shrink-0 font-medium ${
                              e.karensOwes > 0 ? "text-green-600" : e.karensOwes < 0 ? "text-orange-600" : "text-gray-400"
                            }`}
                          >
                            {e.karensOwes === 0
                              ? "—"
                              : e.karensOwes > 0
                              ? `+$${e.karensOwes.toFixed(2)}`
                              : `-$${Math.abs(e.karensOwes).toFixed(2)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nash & Jordi paid — red, collapsible */}
      {njOnlyTotal > 0 && (
        <div className="rounded-xl mb-2 overflow-hidden bg-red-50 border border-red-200">
          <button
            onClick={() => setNJExpanded(!njExpanded)}
            className="w-full p-5 text-left"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-red-600 mb-1">Nash &amp; Jordi paid</p>
                <p className="text-2xl font-bold text-red-700">
                  MXN ${njOnlyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              {njMonths.length > 0 && (
                <Chevron open={njExpanded} className="text-red-300 mt-1.5 ml-3 shrink-0" />
              )}
            </div>
          </button>

          {njExpanded && njMonths.length > 0 && (
            <div className="border-t border-red-100 px-4 py-3 space-y-0.5">
              {njMonths.map((m) => {
                const open = expandedNJMonth === m.key;
                return (
                  <div key={m.key}>
                    <button
                      onClick={() => setExpandedNJMonth(open ? null : m.key)}
                      className="w-full flex items-center justify-between py-2 text-sm"
                    >
                      <span className="flex items-center gap-1.5 text-gray-700">
                        <Chevron open={open} className="text-red-300" />
                        {m.label}
                      </span>
                      <span className="font-medium text-red-700">
                        ${m.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </button>
                    {open && (
                      <div className="ml-5 mb-1 space-y-0.5">
                        {m.items.map((e) => (
                          <div key={e.id} className="flex justify-between text-xs py-1 text-gray-600">
                            <span className="truncate mr-2">
                              {e.item}
                              {e.date && <span className="text-gray-400"> · {fmtDate(e.date)}</span>}
                            </span>
                            <span className="shrink-0 font-medium text-red-600">
                              ${e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

          {qualifyingItems.length === 0 ? (
            <p className="text-sm text-gray-400">No qualifying items</p>
          ) : (
            <div className="space-y-1">
              {qualifyingItems.map((e) => (
                <div key={e.id} className="flex justify-between text-xs text-gray-600">
                  <span className="truncate mr-2">{e.item}</span>
                  <span className={`shrink-0 ${e.karensOwes > 0 ? "text-green-600" : "text-orange-600"}`}>
                    {e.karensOwes > 0 ? "+" : ""}
                    {e.karensOwes.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-1">
                <span>Net</span>
                <span className={qualifyingNet > 0 ? "text-green-700" : "text-orange-700"}>
                  {qualifyingNet > 0
                    ? `Karen pays MXN $${qualifyingNet.toFixed(2)}`
                    : `N&J pay MXN $${Math.abs(qualifyingNet).toFixed(2)}`}
                </span>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
            <div className="flex rounded-xl bg-gray-100 p-1">
              {(["Cash payment", "Bank transfer"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSettlMethod(m)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    settlMethod === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
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

      {/* Monthly breakdown */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Monthly Breakdown</h2>
      {monthlyBreakdowns.length === 0 ? (
        <p className="text-gray-500 text-sm mb-6">No expenses yet</p>
      ) : (
        <div className="overflow-x-auto mb-6 -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-3 font-medium text-gray-500">Month</th>
                <th className="py-2 pr-3 font-medium text-gray-500 text-right">Paid by Karen</th>
                <th className="py-2 pr-3 font-medium text-gray-500 text-right">Paid by N&J</th>
                <th className="py-2 font-medium text-gray-500 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdowns.map((m) => {
                const isExpanded = expandedMonth === m.key;
                return (
                  <>
                    <tr
                      key={m.key}
                      onClick={() => setExpandedMonth(isExpanded ? null : m.key)}
                      className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2.5 pr-3 text-gray-900 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Chevron open={isExpanded} className="text-gray-400" />
                          {m.label}
                          {m.settled && <span className="ml-1 text-green-500">✓</span>}
                        </span>
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
                          ? `Karen owes $${m.monthlyNet.toFixed(2)}`
                          : `N&J owe $${Math.abs(m.monthlyNet).toFixed(2)}`}
                      </td>
                    </tr>

                    {isExpanded &&
                      (m.sharedExpenses.length === 0 ? (
                        <tr key={`${m.key}-empty`} className="bg-gray-50">
                          <td colSpan={4} className="py-2 pl-6 text-xs text-gray-400 italic">
                            No shared expenses this month
                          </td>
                        </tr>
                      ) : (
                        m.sharedExpenses.map((e) => (
                          <tr key={`${m.key}-${e.id}`} className="bg-gray-50 border-b border-gray-100">
                            <td className="py-1.5 pr-3 pl-5 text-xs text-gray-500">
                              {e.item}
                              {e.date && (
                                <span className="text-gray-400"> · {fmtDate(e.date)}</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-xs text-gray-600">
                              {e.paidBy === "Karen" ? `$${e.amount.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-xs text-gray-600">
                              {e.paidBy === "Nash & Jordi" ? `$${e.amount.toFixed(2)}` : "—"}
                            </td>
                            <td
                              className={`py-1.5 text-right text-xs font-medium ${
                                e.karensOwes > 0
                                  ? "text-green-600"
                                  : e.karensOwes < 0
                                  ? "text-orange-600"
                                  : "text-gray-400"
                              }`}
                            >
                              {e.karensOwes === 0
                                ? "—"
                                : e.karensOwes > 0
                                ? `+${e.karensOwes.toFixed(2)}`
                                : e.karensOwes.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Category breakdown */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">By Category (Unsettled)</h2>
      {categoryBreakdowns.length === 0 ? (
        <p className="text-gray-500 text-sm">No unsettled debts</p>
      ) : (
        <div className="space-y-2">
          {categoryBreakdowns.map((c) => (
            <div key={c.category}>
              <button
                onClick={() =>
                  setExpandedCategory(expandedCategory === c.category ? null : c.category)
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
                  <Chevron open={expandedCategory === c.category} className="text-gray-400" />
                </div>
              </button>
              {expandedCategory === c.category && (
                <div className="mt-1 bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                  {c.items.map((e) => (
                    <div key={e.id} className="flex justify-between items-center px-3 py-2 text-xs">
                      <span className="text-gray-600 truncate mr-2">
                        {e.item}
                        {e.date && (
                          <span className="text-gray-400"> · {fmtDate(e.date)}</span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 font-medium ${
                          e.karensOwes > 0 ? "text-green-600" : "text-orange-600"
                        }`}
                      >
                        {e.karensOwes > 0 ? "+" : ""}
                        {e.karensOwes.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
