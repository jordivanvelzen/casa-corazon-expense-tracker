"use client";

import { useState, useEffect } from "react";
import { PaidBy } from "./types";

export function useUser() {
  const [user, setUser] = useState<PaidBy | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("casaCorazonUser") as PaidBy | null;
    setUser(stored);
    setLoaded(true);
  }, []);

  const saveUser = (u: PaidBy) => {
    localStorage.setItem("casaCorazonUser", u);
    setUser(u);
  };

  const clearUser = () => {
    localStorage.removeItem("casaCorazonUser");
    setUser(null);
  };

  return { user, loaded, saveUser, clearUser };
}
