import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type DataMode = "demo" | "connected";
const Ctx = createContext<{ mode: DataMode; setMode: (m: DataMode) => void }>({
  mode: "demo",
  setMode: () => {},
});
const KEY = "manthan-data-mode"; // UI preference only — never credentials.

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>("demo");
  useEffect(() => {
    const v = window.localStorage.getItem(KEY);
    if (v === "demo" || v === "connected") setModeState(v);
  }, []);
  const setMode = (m: DataMode) => {
    setModeState(m);
    window.localStorage.setItem(KEY, m);
  };
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
