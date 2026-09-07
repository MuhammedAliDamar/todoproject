"use client";

import { createContext, useContext, useState } from "react";

/** Mobilde kenar çubuğu drawer'ının açık/kapalı durumu (Navbar hamburger ↔ Sidebar drawer). */
const MobileNavContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MobileNavContext.Provider value={{ open, setOpen }}>{children}</MobileNavContext.Provider>;
}

export const useMobileNav = () => useContext(MobileNavContext);
