"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Command, Settings, X } from "lucide-react";
import { SidebarDrawer } from "./SidebarDrawer";
import { CommandPalette } from "./command-palette";

/**
 * TopNav
 * - Sticky, translucent, and dark-mode aware
 * - Accessible: skip link, aria-current, keyboard hints
 * - Active link underline + subtle hover states
 * - Mobile drawer toggler
 *
 * Drop-in replacement for your current TopNav.
 */
export function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // ⌘K / Ctrl+K opens Command Palette
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
      {/* Skip to content for a11y */}
      <a
        href="#page-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-emerald-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:border-zinc-800/60 dark:bg-zinc-900/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:px-4">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-controls="mobile-drawer"
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-300/70 bg-white/60 text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Brand */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-semibold text-zinc-800 transition hover:text-emerald-700 dark:text-zinc-100 dark:hover:text-emerald-400"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" />
            Pantry Planner
          </Link>

          {/* Primary nav (desktop) */}
          <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 lg:flex">
            <TopNavLink href="/" current={pathname === "/"}>Dashboard</TopNavLink>
            <TopNavLink href="/p" current={pathname.startsWith("/p")}>Pantries</TopNavLink>
            <TopNavLink href="/recipes" current={pathname.startsWith("/recipes")}>
              Recipes
            </TopNavLink>
          </nav>

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden select-none items-center gap-2 rounded-xl border border-zinc-300/70 bg-white/60 px-2.5 py-1.5 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:inline-flex"
              aria-label="Open command palette"
              title="Open command palette (⌘K / Ctrl‑K)"
            >
              <Command className="h-4 w-4" />
              <span className="hidden md:inline">Search</span>
              <kbd className="rounded-md border border-zinc-300/70 px-1.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">⌘K</kbd>
            </button>

            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300/70 bg-white/60 px-2.5 py-1.5 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        </div>

        {/* Optional: section tabs under the bar (only show on certain routes if you want) */}
        {/*
        {pathname.startsWith("/recipes") && (
          <div className="mx-auto w-full max-w-6xl px-3 sm:px-4">
            <div className="-mb-px flex gap-1 overflow-x-auto py-1 text-sm">
              <TabLink href="/recipes" current={pathname === "/recipes"}>All</TabLink>
              <TabLink href="/recipes/favorites" current={pathname.startsWith("/recipes/favorites")}>
                Favorites
              </TabLink>
              <TabLink href="/recipes/new" current={pathname.startsWith("/recipes/new")}>New</TabLink>
            </div>
          </div>
        )}
        */}
      </header>

      {/* Mobile slide-over */}
      <SidebarDrawer open={open} onClose={() => setOpen(false)} />

      {/* Command palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}

/**
 * Link with active underline and focus ring
 */
function TopNavLink({ href, current, children }: { href: string; current?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={[
        "group relative rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-zinc-200 dark:hover:text-emerald-400",
        current ? "text-emerald-700 dark:text-emerald-400" : "",
      ].join(" ")}
    >
      <span>{children}</span>
      {/* underline */}
      <span
        className={[
          "pointer-events-none absolute inset-x-2 -bottom-[6px] h-[2px] rounded-full",
          current ? "bg-emerald-500" : "bg-transparent group-hover:bg-emerald-300/80 dark:group-hover:bg-emerald-600/70",
        ].join(" ")}
      />
    </Link>
  );
}

/**
 * Secondary tab-like links (optional). Use when you enable the recipe tabs section.
 */
function TabLink({ href, current, children }: { href: string; current?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={[
        "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition",
        current
          ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 ring-1 ring-inset ring-transparent dark:text-zinc-300 dark:hover:bg-zinc-800/60",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
