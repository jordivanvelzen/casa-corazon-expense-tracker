"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-[90vw] ${
        type === "success"
          ? "bg-green-500 text-white"
          : "bg-red-500 text-white"
      }`}
    >
      {message}
    </div>
  );
}
