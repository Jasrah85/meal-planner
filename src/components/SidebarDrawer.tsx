"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";

export function SidebarDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    document.documentElement.dataset.sidebarOpen = String(open);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      delete document.documentElement.dataset.sidebarOpen;
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] translate-x-[-100%] bg-white shadow-xl transition-transform ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="h-full overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Menu</div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-gray-100"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <Sidebar />
        </div>
      </aside>
    </>,
    document.body
  );
}
