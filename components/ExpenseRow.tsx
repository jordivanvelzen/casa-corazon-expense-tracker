"use client";

import { Expense } from "@/lib/types";

interface ExpenseRowProps {
  expense: Expense;
  showKarenOwes?: boolean;
  action?: React.ReactNode;
}

export default function ExpenseRow({
  expense,
  showKarenOwes = false,
  action,
}: ExpenseRowProps) {
  const dateStr = expense.date
    ? new Date(expense.date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{expense.item}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {expense.category && (
              <span className="bg-gray-100 rounded-full px-2 py-0.5">
                {expense.category}
              </span>
            )}
            {dateStr && <span>{dateStr}</span>}
            {expense.paidBy && <span>· {expense.paidBy}</span>}
            {expense.split === "Deduct from rent" && expense.settlement.length === 0 && (
              <span
                className={`rounded-full px-2 py-0.5 ${
                  expense.toDiscuss
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {expense.toDiscuss ? "Rent ?" : "Rent \u2713"}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold text-gray-900">
            ${expense.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          {showKarenOwes && expense.karensOwes !== 0 && (
            <p
              className={`text-xs mt-0.5 ${
                expense.karensOwes > 0 ? "text-green-600" : "text-orange-600"
              }`}
            >
              {expense.karensOwes > 0
                ? `Karen owes $${expense.karensOwes.toFixed(2)}`
                : `N&J owe $${Math.abs(expense.karensOwes).toFixed(2)}`}
            </p>
          )}
        </div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
