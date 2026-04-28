"use client";

import { useEffect, useMemo, useState } from "react";

export function useDebounce<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  const delay = useMemo(() => Math.max(0, delayMs), [delayMs]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

