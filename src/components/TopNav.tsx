"use client";

import Link from "next/link";
import { useState } from "react";

export function TopNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
      <div className="mx-auto flex max-w-5xl items-center gap-3 p-3">
        {/* Mobile: toggle sidebar */}
        <button
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-gray-100"
          aria-label="Toggle menu"
          onClick={() => {
            setOpen((o) => !o);
            // Quick/naive approach: use a global data attribute for layout to pick up
            document.documentElement.dataset.sidebarOpen = String(!open);
          }}
        >
          ☰
        </button>

        <Link href="/" className="font-medium">Pantry Planner</Link>

        <div className="ml-auto flex items-center gap-2">
          {/* Placeholder for future search/profile */}
          <Link href="/settings" className="text-sm underline">Settings</Link>
        </div>
      </div>
    </header>
  );
}
