"use client";

import { useState, useEffect } from "react";
import { Expense } from "@/lib/types";
import Spinner from "@/components/Spinner";

interface MonthlyBreakdown {
  key: string;
  label: string;
  karenShare: number;
  njShare: number;
  monthlyNet: number;
  runningTotal: number;
  settled: boolean;
}

interface CategoryBreakdown {
  category: string;
  total: number;
}

export default function BalancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Unsettled expenses (no settlement relation)
  const unsettled = expenses.filter((e) => e.settlement.length === 0 && e.type !== "Settlement");

  // Net balance
  const netBalance = unsettled.reduce((sum, e) => sum + e.karensOwes, 0);
  const roundedBalance = Math.round(netBalance * 100) / 100;

  // Monthly breakdown (all expenses, grouped)
  const monthlyMap = new Map<string, { expenses: Expense[]; key: string }>();
  for (const e of expenses) {
    if (e.type === "Settlement") continue;
    if (!e.date) continue;
    const d = new Date(e.date + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap.has(key)) monthlyMap.set(key, { expenses: [], key });
    monthlyMap.get(key)!.expenses.push(e);
  }

  const sortedMonths = Array.from(monthlyMap.entries()).sort(([a], [b]) => b.localeCompare(a));
  let runningTotal = 0;

  // Build from oldest to newest, then reverse for display
  const monthlyBreakdowns: MonthlyBreakdown[] = [];
  const chronological = [...sortedMonths].reverse();
  for (const [, { expenses: monthExpenses, key }] of chronological) {
    const d = new Date(key + "-01T00:00:00");
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });

    let karenShare = 0;
    let njShare = 0;
    let allSettled = true;

    for (const e of monthExpenses) {
      if (e.karensOwes > 0) karenShare += e.karensOwes;
      else if (e.karensOwes < 0) njShare += Math.abs(e.karensOwes);
      if (e.settlement.length === 0) allSettled = false;
    }

    const monthlyNet = Math.round((karenShare - njShare) * 100) / 100;
    runningTotal = Math.round((runningTotal + monthlyNet) * 100) / 100;

    monthlyBreakdowns.push({
      key,
      label,
      karenShare: Math.round(karenShare * 100) / 100,
      njShare: Math.round(njShare * 100) / 100,
      monthlyNet,
      runningTotal,
      settled: allSettled,
    });
  }

  monthlyBreakdowns.reverse();

  // Category breakdown (unsettled only)
  const categoryMap = new Map<string, number>();
  for (const e of unsettled) {
    if (e.karensOwes === 0) continue;
    const cat = e.category || "Other";
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + e.karensOwes);
  }

  const categoryBreakdowns: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Balance</h1>

      {/* Net balance */}
      <div
        className={`rounded-xl p-5 mb-6 ${
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
                <th className="py-2 pr-3 font-medium text-gray-500 text-right">Karen</th>
                <th className="py-2 pr-3 font-medium text-gray-500 text-right">N&J</th>
                <th className="py-2 pr-3 font-medium text-gray-500 text-right">Net</th>
                <th className="py-2 font-medium text-gray-500 text-right">Running</th>
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdowns.map((m) => (
                <tr key={m.key} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3 text-gray-900 whitespace-nowrap">
                    {m.label}
                    {m.settled && <span className="ml-1 text-green-500">\u2713</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-green-600">
                    ${m.karenShare.toFixed(2)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-orange-600">
                    ${m.njShare.toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right font-medium ${
                      m.monthlyNet > 0 ? "text-green-600" : m.monthlyNet < 0 ? "text-orange-600" : "text-gray-400"
                    }`}
                  >
                    {m.monthlyNet > 0 ? "+" : ""}${m.monthlyNet.toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      m.runningTotal > 0 ? "text-green-700" : m.runningTotal < 0 ? "text-orange-700" : "text-gray-400"
                    }`}
                  >
                    ${m.runningTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
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
            <div
              key={c.category}
              className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-gray-50"
            >
              <span className="text-sm text-gray-700">{c.category}</span>
              <span
                className={`text-sm font-semibold ${
                  c.total > 0 ? "text-green-600" : "text-orange-600"
                }`}
              >
                {c.total > 0
                  ? `Karen owes $${c.total.toFixed(2)}`
                  : `N&J owe $${Math.abs(c.total).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
