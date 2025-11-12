import { useEffect, useState } from "react";

export function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : (typeof initialValue === "function" ? initialValue() : initialValue);
  });

  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);

  return [state, setState];
}
