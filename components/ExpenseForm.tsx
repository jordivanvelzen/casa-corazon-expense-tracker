"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Category,
  PaidBy,
  Split,
  ExpenseType,
  Status,
} from "@/lib/types";
import { CATEGORY_RULES } from "@/lib/categoryRules";
import { calculateKarenOwes } from "@/lib/calculateKarenOwes";
import { generateItemName } from "@/lib/generateItemName";
import Spinner from "./Spinner";

const ALL_CATEGORIES: Category[] = [
  "Rent",
  "Internet",
  "Electricity",
  "Gas",
  "Water Filter",
  "Kitchen",
  "Garden",
  "Cleaning",
  "House Supplies",
  "Pet",
  "Maintenance",
  "Loan",
  "Other",
];

interface ExpenseFormProps {
  currentUser: PaidBy;
  onSuccess: () => void;
}

export default function ExpenseForm({ currentUser, onSuccess }: ExpenseFormProps) {
  const [type, setType] = useState<ExpenseType>("One-Off");
  const [category, setCategory] = useState<Category | null>(null);
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState<PaidBy>(currentUser);
  const [split, setSplit] = useState<Split>("Shared (all 3)");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [itemName, setItemName] = useState("");
  const [itemEdited, setItemEdited] = useState(false);
  const [status, setStatus] = useState<Status>("Paid");
  const [toDiscuss, setToDiscuss] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const updateItemName = useCallback(
    (cat: Category | null, t: ExpenseType, d: string) => {
      if (!itemEdited) {
        setItemName(generateItemName(cat, t, d));
      }
    },
    [itemEdited]
  );

  useEffect(() => {
    updateItemName(category, type, date);
  }, [category, type, date, updateItemName]);

  const handleCategorySelect = (cat: Category) => {
    setCategory(cat);
    const rule = CATEGORY_RULES[cat];
    if (rule.split) setSplit(rule.split);
    if (rule.paidBy) setPaidBy(rule.paidBy);
    else setPaidBy(currentUser);
    setTimeout(() => amountRef.current?.focus(), 100);
  };

  const karenOwes = calculateKarenOwes(
    parseFloat(amount) || 0,
    split,
    paidBy
  );

  const debtPreview = (() => {
    const amt = parseFloat(amount) || 0;
    if (amt === 0 || !split || !paidBy) return null;
    if (karenOwes > 0)
      return { text: `Karen owes MXN $${karenOwes.toFixed(2)}`, color: "text-green-600" };
    if (karenOwes < 0)
      return {
        text: `N&J owe Karen MXN $${Math.abs(karenOwes).toFixed(2)}`,
        color: "text-orange-600",
      };
    return { text: "No debt", color: "text-gray-400" };
  })();

  const handleSubmit = async () => {
    if (!category || !amount) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: itemName,
          amount: parseFloat(amount),
          date,
          category,
          paidBy,
          split,
          type,
          status,
          toDiscuss,
          notes,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      // Reset form but keep type and category
      setAmount("");
      setItemEdited(false);
      setStatus("Paid");
      setToDiscuss(false);
      setNotes("");
      onSuccess();
    } catch {
      alert("Failed to add expense. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Type */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Type</label>
        <div className="flex rounded-xl bg-gray-100 p-1">
          {(["Recurring Bill", "One-Off"] as ExpenseType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                type === t
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Category</label>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                category === cat
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">
          Amount (MXN)
        </label>
        <input
          ref={amountRef}
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full h-14 px-4 text-2xl font-semibold rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
        />
      </div>

      {/* Paid By */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Paid By</label>
        <div className="flex rounded-xl bg-gray-100 p-1">
          {(["Nash & Jordi", "Karen"] as PaidBy[]).map((p) => (
            <button
              key={p}
              onClick={() => setPaidBy(p)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                paidBy === p
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Split */}
      {category !== "Rent" && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Split</label>
          <div className="flex rounded-xl bg-gray-100 p-1">
            {(["Shared (all 3)", "N&J only", "Karen only", "Deduct from rent"] as Split[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSplit(s);
                  if (s === "Deduct from rent") setToDiscuss(true);
                }}
                className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-all ${
                  split === s
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                {s === "Deduct from rent" ? "Rent ded." : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Debt preview */}
      {debtPreview && (
        <div className={`text-sm font-medium ${debtPreview.color}`}>
          {debtPreview.text}
        </div>
      )}

      {/* Date */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-sm"
        />
      </div>

      {/* Item Name */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-500">Item Name</label>
          {!itemEdited && (
            <button
              onClick={() => setItemEdited(true)}
              className="text-xs text-orange-500 font-medium"
            >
              Edit name
            </button>
          )}
        </div>
        <input
          type="text"
          value={itemName}
          onChange={(e) => {
            setItemName(e.target.value);
            setItemEdited(true);
          }}
          readOnly={!itemEdited}
          className={`w-full h-12 px-4 rounded-xl border border-gray-200 outline-none text-sm ${
            !itemEdited ? "bg-gray-50 text-gray-400" : "focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          }`}
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Status</label>
        <div className="flex rounded-xl bg-gray-100 p-1">
          {(["Paid", "Pending"] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                status === s
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* To discuss / Needs approval */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={toDiscuss}
          onChange={(e) => setToDiscuss(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        <span className="text-sm text-gray-700">
          {split === "Deduct from rent"
            ? "Needs Karen\u2019s approval"
            : "Flag for discussion"}
        </span>
      </label>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional comment"
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-sm resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !category || !amount}
        className="w-full h-14 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Spinner className="text-white" /> Adding...
          </>
        ) : (
          "Add expense"
        )}
      </button>
    </div>
  );
}
