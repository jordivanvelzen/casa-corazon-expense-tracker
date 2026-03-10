"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/add", label: "Add", icon: "+" },
  { href: "/unpaid", label: "Unpaid", icon: "\u23F3" },
  { href: "/balance", label: "Balance", icon: "\u2696\uFE0F" },
  { href: "/history", label: "History", icon: "\uD83D\uDCCB" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                active
                  ? "text-orange-500 font-semibold"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
