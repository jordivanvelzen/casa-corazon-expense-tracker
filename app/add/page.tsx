"use client";

import { useState, useCallback } from "react";
import { useUser } from "@/lib/useUser";
import ExpenseForm from "@/components/ExpenseForm";
import RecurringBanner from "@/components/RecurringBanner";
import Toast from "@/components/Toast";

export default function AddPage() {
  const { user } = useUser();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleSuccess = useCallback(() => {
    setToast({ message: "Added \u2713", type: "success" });
  }, []);

  const handleRecurringAdded = useCallback(() => {
    setToast({ message: "Recurring expenses added \u2713", type: "success" });
    setFormKey((k) => k + 1);
  }, []);

  if (!user) return null;

  return (
    <div className="px-4 pt-4 pb-24">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {user === "Nash & Jordi" && (
        <RecurringBanner onAdded={handleRecurringAdded} />
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-4">Add Expense</h1>
      <ExpenseForm key={formKey} currentUser={user} onSuccess={handleSuccess} />
    </div>
  );
}
