"use client";

import { useState, useEffect, useMemo } from "react";
import { Expense } from "@/lib/types";
import ExpenseRow from "@/components/ExpenseRow";
import Spinner from "@/components/Spinner";

export default function HistoryPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const settlements = useMemo(
    () =>
      expenses
        .filter((e) => e.type === "Settlement")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses]
  );

  const unsettled = useMemo(
    () =>
      expenses
        .filter((e) => e.settlement.length === 0 && e.type !== "Settlement")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses]
  );

  const unsettledNet = useMemo(
    () =>
      Math.round(
        unsettled.reduce((sum, e) => sum + e.karensOwes, 0) * 100
      ) / 100,
    [unsettled]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-4">History</h1>

      {/* ── Unsettled card ── */}
      <div className="mb-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => toggle("__unsettled__")}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <span className="font-semibold text-gray-900">Unsettled</span>
            <span className="ml-2 text-xs text-gray-400">
              {unsettled.length} item{unsettled.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-semibold ${
                unsettledNet > 0
                  ? "text-green-600"
                  : unsettledNet < 0
                  ? "text-orange-600"
                  : "text-gray-400"
              }`}
            >
              MXN ${Math.abs(unsettledNet).toFixed(2)}
            </span>
            <span className="text-gray-400 text-sm">
              {expandedId === "__unsettled__" ? "▲" : "▼"}
            </span>
          </div>
        </button>
        {expandedId === "__unsettled__" && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-3">
            {unsettled.length === 0 ? (
              <p className="text-sm text-gray-400">All settled ✓</p>
            ) : (
              unsettled.map((e) => (
                <ExpenseRow key={e.id} expense={e} showKarenOwes />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Settlement cards ── */}
      {settlements.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No settlements yet
        </p>
      ) : (
        <div className="space-y-3">
          {settlements.map((s) => {
            const linked = expenses.filter(
              (e) => e.settlement.includes(s.id) && e.id !== s.id
            );
            const isExpanded = expandedId === s.id;
            const dateStr = s.date
              ? new Date(s.date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "";

            return (
              <div
                key={s.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {s.item}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span>{dateStr}</span>
                      {s.settlementMethod && (
                        <span>· {s.settlementMethod}</span>
                      )}
                      <span>
                        · {linked.length} linked
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="text-sm font-semibold text-gray-700">
                      MXN $
                      {s.amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                    {linked.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        No linked expenses
                      </p>
                    ) : (
                      linked.map((e) => (
                        <ExpenseRow key={e.id} expense={e} showKarenOwes />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
