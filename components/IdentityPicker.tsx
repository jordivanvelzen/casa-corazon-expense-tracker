"use client";

import { PaidBy } from "@/lib/types";

interface IdentityPickerProps {
  onSelect: (user: PaidBy) => void;
}

export default function IdentityPicker({ onSelect }: IdentityPickerProps) {
  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🏠</div>
        <h1 className="text-2xl font-bold text-gray-900">Casa Corazón</h1>
        <p className="text-gray-500 mt-2">Who are you?</p>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => onSelect("Nash & Jordi")}
          className="w-full py-4 px-6 bg-orange-500 text-white rounded-xl text-lg font-semibold hover:bg-orange-600 active:scale-[0.98] transition-all"
        >
          Nash & Jordi
        </button>
        <button
          onClick={() => onSelect("Karen")}
          className="w-full py-4 px-6 bg-orange-500 text-white rounded-xl text-lg font-semibold hover:bg-orange-600 active:scale-[0.98] transition-all"
        >
          Karen
        </button>
      </div>
    </div>
  );
}
