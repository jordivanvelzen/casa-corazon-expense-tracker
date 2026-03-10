"use client";

import { useUser } from "@/lib/useUser";
import BottomNav from "./BottomNav";
import IdentityPicker from "./IdentityPicker";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loaded, saveUser, clearUser } = useUser();

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <IdentityPicker onSelect={saveUser} />;
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-12 max-w-lg mx-auto">
          <span className="text-sm font-semibold text-gray-900">Casa Corazón</span>
          <button
            onClick={clearUser}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Switch user ({user})
          </button>
        </div>
      </header>
      <main className="max-w-lg mx-auto min-h-screen">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
