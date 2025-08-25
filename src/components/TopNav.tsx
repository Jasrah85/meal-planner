"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SidebarDrawer } from "./SidebarDrawer";
import { CommandPalette } from "./command-palette";

export function TopNav() {
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && isK) {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <div className="mx-auto flex max-w-5xl items-center gap-3 p-3">
          <button
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-gray-100"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            ☰
          </button>

          <Link href="/" className="font-medium">Pantry Planner</Link>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-gray-100"
              aria-label="Open command palette"
              title="Open command palette (⌘K / Ctrl‑K)"
            >
              ⌘K
            </button>
            <Link href="/settings" className="text-sm underline">Settings</Link>
          </div>
        </div>
      </header>

      {/* Mobile slide-over */}
      <SidebarDrawer open={open} onClose={() => setOpen(false)} />

      {/* Command palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}
