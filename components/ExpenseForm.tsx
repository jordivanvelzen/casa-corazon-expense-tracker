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
import { compressImage } from "@/lib/compressImage";
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // UI-only: progressive disclosure
  const [editSplit, setEditSplit] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    category === "Loan" ? null : split,
    paidBy,
    category
  );

  const debtPreview = (() => {
    const amt = parseFloat(amount) || 0;
    if (amt === 0 || !paidBy) return null;
    if (category !== "Loan" && !split) return null;
    if (karenOwes > 0)
      return { text: `Karen owes MXN $${karenOwes.toFixed(2)}`, color: "text-green-600" };
    if (karenOwes < 0)
      return {
        text: `N&J owe Karen MXN $${Math.abs(karenOwes).toFixed(2)}`,
        color: "text-orange-600",
      };
    return { text: "No debt", color: "text-gray-400" };
  })();

  // Human-readable summary of who paid + how it splits
  const payerLabel = paidBy === "Karen" ? "Karen paid" : "Nash & Jordi paid";
  const splitPhrase = (() => {
    if (category === "Loan") return "full amount owed by the other party";
    if (category === "Rent") return "N&J only";
    switch (split) {
      case "Shared (all 3)":
        return "split 3 ways";
      case "N&J only":
        return "N&J only";
      case "Karen only":
        return "Karen only";
      case "Deduct from rent":
        return "deduct from rent";
      default:
        return "";
    }
  })();

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImageFile(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } catch {
      alert("Could not process image. Try a different photo.");
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!category || !amount) return;
    setSubmitting(true);

    try {
      // Upload image first if one is selected
      let imageUrl: string | null = null;
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.details || uploadData.error || "Image upload failed");
        imageUrl = uploadData.url;
      }

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: itemName,
          amount: parseFloat(amount),
          date,
          category,
          paidBy,
          split: category === "Loan" ? null : split,
          type,
          status,
          toDiscuss,
          notes,
          ...(imageUrl ? { imageUrl } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || "Failed");
      }

      // Reset form but keep type and category
      setAmount("");
      setItemEdited(false);
      setStatus("Paid");
      setToDiscuss(false);
      setNotes("");
      setEditSplit(false);
      setShowMore(false);
      handleRemoveImage();
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
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

      {/* Amount — the hero field */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">
          Amount (MXN)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-gray-300 pointer-events-none">
            $
          </span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full h-16 pl-9 pr-4 text-3xl font-semibold rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
          />
        </div>
      </div>

      {/* Split summary — collapsed by default, tap to edit */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setEditSplit((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {payerLabel} <span className="text-gray-400">·</span>{" "}
              <span className="font-normal text-gray-500">{splitPhrase}</span>
            </div>
            {debtPreview && (
              <div className={`text-sm font-semibold mt-0.5 ${debtPreview.color}`}>
                {debtPreview.text}
              </div>
            )}
          </div>
          <Chevron open={editSplit} />
        </button>

        {editSplit && (
          <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100">
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
            {category !== "Rent" && category !== "Loan" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Split</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Shared (all 3)", "N&J only", "Karen only", "Deduct from rent"] as Split[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSplit(s);
                        if (s === "Deduct from rent") setToDiscuss(true);
                      }}
                      className={`py-2.5 text-sm font-medium rounded-lg border transition-all ${
                        split === s
                          ? "bg-orange-50 border-orange-300 text-orange-700"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loan info */}
            {category === "Loan" && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
                Full amount owed by the other party
              </div>
            )}
          </div>
        )}
      </div>

      {/* More options */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium text-gray-700">More options</span>
          <Chevron open={showMore} />
        </button>

        {showMore && (
          <div className="px-4 pb-4 pt-1 space-y-5 border-t border-gray-100">
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
                  ? "Needs Karen’s approval"
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

            {/* Photo (optional) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Photo <span className="font-normal text-gray-400">(optional)</span>
              </label>

              {/* Hidden file input — accept any image, let OS pick camera/gallery */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />

              {imagePreview ? (
                /* Preview + remove */
                <div className="relative w-full rounded-xl overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="w-full object-cover max-h-48"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm leading-none"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                /* Pick photo button */
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors"
                >
                  <span className="text-xl">📷</span>
                  Add a photo / receipt
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Submit — sticky above the bottom nav */}
      <div
        className="sticky z-30 pt-3 pb-1 bg-gray-50"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          onClick={handleSubmit}
          disabled={submitting || !category || !amount}
          className="w-full h-14 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
        >
          {submitting ? (
            <>
              <Spinner className="text-white" />
              {imageFile ? "Uploading…" : "Adding…"}
            </>
          ) : (
            "Add expense"
          )}
        </button>
      </div>
    </div>
  );
}
