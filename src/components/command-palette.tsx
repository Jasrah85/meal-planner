"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CmdItem = { label: string; href: string; group?: string };

type ApiRecipe = { id: number | string; title: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function coerceRecipe(v: unknown): ApiRecipe | null {
  if (!isObject(v)) return null;
  const id = (v as Record<string, unknown>).id;
  const title = (v as Record<string, unknown>).title;
  const idOk = typeof id === "number" || typeof id === "string";
  if (idOk && typeof title === "string") {
    return { id: id as number | string, title };
  }
  return null;
}

type RecipesArray = Array<unknown>;
type RecipesEnvelope = { recipes?: unknown };

async function fetchQuickRecipes(): Promise<Array<{ id: number; title: string }>> {
  try {
    const res = await fetch("/api/recipes?limit=50", { cache: "no-store" });
    if (!res.ok) return [];
    const data: unknown = await res.json();

    // Safely derive the list: either top-level array or { recipes: [...] }
    let rawList: unknown = [];
    if (Array.isArray(data)) {
      rawList = data as RecipesArray;
    } else if (isObject(data)) {
      const maybe = (data as RecipesEnvelope).recipes;
      if (Array.isArray(maybe)) rawList = maybe as RecipesArray;
    }

    const list = Array.isArray(rawList) ? rawList : [];
    return list
      .map(coerceRecipe)
      .filter((r): r is ApiRecipe => r !== null)
      .map((r) => ({ id: Number(r.id), title: r.title }));
  } catch {
    return [];
  }
}

/* ------------------------- Fuzzy scoring (no deps) ------------------------ */
function fuzzyScore(query: string, target: string): number {
  if (!query) return 1; // empty query shows all
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  const idx = t.indexOf(q);
  if (idx !== -1) {
    // Earlier match + closer length is better
    return 1000 + Math.max(0, 200 - idx) + Math.max(0, 100 - Math.abs(t.length - q.length));
  }

  // Subsequence match
  let qi = 0, ti = 0, runs = 0, lastMatch = -2;
  while (qi < q.length && ti < t.length) {
    if (t[ti] === q[qi]) {
      if (ti === lastMatch + 1) runs += 1;
      lastMatch = ti;
      qi++;
    }
    ti++;
  }
  if (qi < q.length) return 0;
  return 500 + runs * 10 + Math.max(0, 50 - (t.length - q.length));
}
/* ------------------------------------------------------------------------- */

export function CommandPalette(props: { open?: boolean; onClose?: () => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = props.open ?? internalOpen;

  // Memoize close to avoid changing deps every render
  const close = useCallback(() => {
    if (props.onClose) props.onClose();
    else setInternalOpen(false);
  }, [props.onClose]);

  const openSelf = useCallback(() => setInternalOpen(true), []);

  const router = useRouter();
  const [q, setQ] = useState("");
  const [recipes, setRecipes] = useState<Array<{ id: number; title: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Hotkey: ⌘K / Ctrl+K to open; Esc to close when open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openSelf();
      } else if (key === "escape" && isOpen) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, openSelf, close]);

  // Focus & load recipes on open
  useEffect(() => {
    if (isOpen) {
      setQ("");
      setActiveIndex(0);
      inputRef.current?.focus();
      if (recipes.length === 0) {
        fetchQuickRecipes().then(setRecipes);
      }
    }
  }, [isOpen, recipes.length]);

  const base: CmdItem[] = useMemo(
    () => [
      { label: "Dashboard", href: "/", group: "Navigation" },
      { label: "Pantries", href: "/p", group: "Navigation" },
      { label: "All Recipes", href: "/recipes", group: "Navigation" },
      { label: "New Recipe", href: "/recipes/new", group: "Navigation" },
      { label: "Shopping List", href: "/shopping", group: "Navigation" },
      { label: "Scan Item", href: "/scan", group: "Navigation" },
      { label: "Settings", href: "/settings", group: "Navigation" },
      ...recipes.map((r) => ({
        label: `Recipe: ${r.title}`,
        href: `/recipes/${r.id}`,
        group: "Recipes",
      })),
    ],
    [recipes]
  );

  const filtered = useMemo(() => {
    const query = q.trim();
    if (!query) return base;
    return base
      .map((it) => ({ it, score: fuzzyScore(query, it.label) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.it.label.length - b.it.label.length || a.it.label.localeCompare(b.it.label))
      .map((x) => x.it);
  }, [q, base]);

  // Keep activeIndex within range as the list changes
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIndex]);

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = useCallback((href: string) => {
    close();
    router.push(href);
  }, [close, router]);

  const onListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const cur = filtered[activeIndex];
      if (cur) go(cur.href);
    }
  }, [filtered, activeIndex, go, close]);

  if (!isOpen) return null;

  // Group items
  const grouped = filtered.reduce<Record<string, CmdItem[]>>((acc, item) => {
    const g = item.group ?? "Other";
    (acc[g] ||= []).push(item);
    return acc;
  }, {});

  // Compute flat index across groups for active highlighting
  const flatIndexFor = (group: string, idxInGroup: number) => {
    let idx = 0;
    for (const [g, items] of Object.entries(grouped)) {
      if (g === group) {
        idx += idxInGroup;
        break;
      }
      idx += items.length;
    }
    return idx;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8" onKeyDown={onListKeyDown}>
      <div className="absolute inset-0 bg-black/30" onClick={close} aria-hidden />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border bg-white shadow-2xl">
        <div className="border-b p-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages and recipes…"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            aria-label="Search"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {Object.entries(grouped).length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No matches.</div>
          ) : (
            <div className="divide-y">
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {group}
                  </div>
                  <ul>
                    {items.map((i, localIdx) => {
                      const flatIdx = flatIndexFor(group, localIdx);
                      const isActive = flatIdx === activeIndex;
                      return (
                        <li key={`${group}-${i.href}`}>
                          <button
                            ref={(el) => { itemRefs.current[flatIdx] = el; }}
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                            onClick={() => go(i.href)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                              isActive ? "bg-gray-100" : "hover:bg-gray-50"
                            }`}
                            aria-current={isActive ? "true" : undefined}
                          >
                            <span>{i.label}</span>
                            <span className="text-xs text-gray-400">{i.href}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500">
          <div>↑/↓ to navigate • Enter to open</div>
          <div>Esc to close • ⌘K / Ctrl+K to open</div>
        </div>
      </div>
    </div>
  );
}
