"use client";

import { useState, useEffect, useCallback } from "react";
import { Expense, Category } from "@/lib/types";
import { CATEGORY_RULES } from "@/lib/categoryRules";
import { getMissingRecurringForMonth, MissingRecurring } from "@/lib/recurringCheck";
import { generateItemName } from "@/lib/generateItemName";
import { getApprovedDeductions, getPendingDeductions, calculateAdjustedRent, effectiveDeductionAmount } from "@/lib/rentDeductions";
import Spinner from "./Spinner";
import Link from "next/link";

interface RecurringBannerProps {
  onAdded: () => void;
}

export default function RecurringBanner({ onAdded }: RecurringBannerProps) {
  const [missing, setMissing] = useState<MissingRecurring[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [baseRent, setBaseRent] = useState(3000);
  const [dismissed, setDismissed] = useState(false);
  const [addingInternet, setAddingInternet] = useState(false);
  const [addingRent, setAddingRent] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // An existing Pending rent entry for this month (if any)
  const [pendingRent, setPendingRent] = useState<Expense | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("recurringBannerDismissed")) {
      setDismissed(true);
      return;
    }

    Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ])
      .then(([data, config]: [Expense[], { baseRent: number }]) => {
        if (!Array.isArray(data)) {
          setLoaded(true);
          return;
        }
        setExpenses(data);
        setBaseRent(config.baseRent);
        const now = new Date();
        const m = getMissingRecurringForMonth(data, now.getFullYear(), now.getMonth());
        setMissing(m);

        // Detect an existing Pending rent for this month (so we can apply deductions to it)
        const pending =
          data.find((e) => {
            if (e.type !== "Recurring Bill" || e.category !== "Rent") return false;
            if (e.status !== "Pending") return false;
            const d = new Date(e.date + "T00:00:00");
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth()
            );
          }) ?? null;
        setPendingRent(pending);

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

  const handleAddInternet = async () => {
    setAddingInternet(true);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const rule = CATEGORY_RULES["Internet"];
    const amount = getLastAmount("Internet");
    const item = generateItemName("Internet", "Recurring Bill", dateStr);

    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item,
        amount,
        date: dateStr,
        category: "Internet",
        paidBy: rule.paidBy || "Nash & Jordi",
        split: rule.split || "Shared (all 3)",
        type: "Recurring Bill",
        status: "Pending",
        toDiscuss: false,
        notes: "",
      }),
    });

    setAddingInternet(false);
    setMissing((prev) => prev.filter((m) => m.category !== "Internet"));
    onAdded();
  };

  // Create a new rent entry with deductions applied
  const handleAddRent = async () => {
    setAddingRent(true);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const approved = getApprovedDeductions(expenses);

    await fetch("/api/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateStr,
        deductions: approved.map((d) => ({
          id: d.id,
          karenOwes: effectiveDeductionAmount(d),
          item: d.item,
        })),
      }),
    });

    setAddingRent(false);
    setMissing((prev) => prev.filter((m) => m.category !== "Rent"));
    onAdded();
  };

  // Apply deductions to an existing Pending rent entry and mark it as Paid
  const handlePayRent = async () => {
    if (!pendingRent) return;
    setAddingRent(true);

    const approved = getApprovedDeductions(expenses);

    await fetch("/api/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentId: pendingRent.id,
        date: pendingRent.date,
        deductions: approved.map((d) => ({
          id: d.id,
          karenOwes: effectiveDeductionAmount(d),
          item: d.item,
        })),
      }),
    });

    setAddingRent(false);
    setPendingRent(null);
    onAdded();
  };

  const handleDismiss = () => {
    sessionStorage.setItem("recurringBannerDismissed", "1");
    setDismissed(true);
  };

  const approved = getApprovedDeductions(expenses);
  const pending = getPendingDeductions(expenses);
  const adjustedRent = calculateAdjustedRent(baseRent, approved);

  const missingInternet = missing.some((m) => m.category === "Internet");
  const missingRent = missing.some((m) => m.category === "Rent");

  // Show banner if there are missing bills OR if there's a pending rent we can update
  const showBanner =
    !dismissed &&
    loaded &&
    (missingInternet || missingRent || pendingRent !== null);

  if (!showBanner) return null;

  const lastInternetAmount = getLastAmount("Internet");

  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-3">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-amber-800">Missing recurring — {monthName}</p>
        <button
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-600 ml-2 text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {/* Internet */}
      {missingInternet && (
        <div className="flex items-center justify-between bg-white rounded-lg p-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Internet</p>
            <p className="text-xs text-gray-500">
              MXN ${lastInternetAmount.toLocaleString()}
            </p>
          </div>
          <button
            onClick={handleAddInternet}
            disabled={addingInternet}
            className="px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
          >
            {addingInternet ? <><Spinner className="h-3 w-3" /> Adding</> : "Add"}
          </button>
        </div>
      )}

      {/* Rent — missing (create new entry) */}
      {missingRent && (
        <div className="bg-white rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium text-gray-900">Rent</p>
          <div className="text-xs space-y-1 text-gray-600">
            <div className="flex justify-between">
              <span>Base rent</span>
              <span>MXN ${baseRent.toLocaleString()}</span>
            </div>
            {approved.map((d) => (
              <div key={d.id} className="flex justify-between text-green-700">
                <span className="truncate mr-2">- {d.item}</span>
                <span className="shrink-0">-${effectiveDeductionAmount(d).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-1">
              <span>Total</span>
              <span>MXN ${adjustedRent.toLocaleString()}</span>
            </div>
          </div>
          {pending.length > 0 && (
            <p className="text-xs text-amber-600">
              + {pending.length} item{pending.length !== 1 ? "s" : ""} pending Karen&apos;s approval{" "}
              <Link href="/review" className="underline font-medium">Review →</Link>
            </p>
          )}
          <button
            onClick={handleAddRent}
            disabled={addingRent}
            className="w-full py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {addingRent ? <><Spinner className="h-4 w-4" /> Adding...</> : "Add Rent"}
          </button>
        </div>
      )}

      {/* Rent — exists but Pending (apply deductions + mark paid) */}
      {!missingRent && pendingRent && (
        <div className="bg-white rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Rent</p>
            <span className="text-xs text-amber-600 font-medium">Unpaid</span>
          </div>
          <div className="text-xs space-y-1 text-gray-600">
            <div className="flex justify-between">
              <span>Base rent</span>
              <span>MXN ${baseRent.toLocaleString()}</span>
            </div>
            {approved.map((d) => (
              <div key={d.id} className="flex justify-between text-green-700">
                <span className="truncate mr-2">- {d.item}</span>
                <span className="shrink-0">-${effectiveDeductionAmount(d).toFixed(2)}</span>
              </div>
            ))}
            {approved.length === 0 && (
              <p className="text-gray-400 italic">No approved deductions</p>
            )}
            <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-1">
              <span>Total</span>
              <span>MXN ${adjustedRent.toLocaleString()}</span>
            </div>
          </div>
          {pending.length > 0 && (
            <p className="text-xs text-amber-600">
              + {pending.length} item{pending.length !== 1 ? "s" : ""} pending Karen&apos;s approval{" "}
              <Link href="/review" className="underline font-medium">Review →</Link>
            </p>
          )}
          <button
            onClick={handlePayRent}
            disabled={addingRent}
            className="w-full py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {addingRent ? <><Spinner className="h-4 w-4" /> Updating...</> : "Apply deductions & mark paid"}
          </button>
        </div>
      )}
    </div>
  );
}
