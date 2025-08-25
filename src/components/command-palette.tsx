"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CmdItem = { label: string; href: string; group?: string };

type ApiRecipe = { id: number | string; title: string };
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function coerceRecipe(v: unknown): ApiRecipe | null {
  if (!isObject(v)) return null;
  const { id, title } = v as { id?: unknown; title?: unknown };
  const idOk = typeof id === "number" || typeof id === "string";
  if (idOk && typeof title === "string") return { id: id as number | string, title };
  return null;
}

async function fetchQuickRecipes(): Promise<Array<{ id: number; title: string }>> {
  try {
    const res = await fetch("/api/recipes?limit=50", { cache: "no-store" });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const maybeList: unknown = Array.isArray(data) ? data : (isObject(data) ? (data as any).recipes : []); // safe narrowing
    const list = Array.isArray(maybeList) ? maybeList : [];
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
    return 1000 + Math.max(0, 200 - idx) + Math.max(0, 100 - Math.abs(t.length - q.length));
  }

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
  const close = props.onClose ?? (() => setInternalOpen(false));
  const openSelf = () => setInternalOpen(true);

  const router = useRouter();
  const [q, setQ] = useState("");
  const [recipes, setRecipes] = useState<Array<{ id: number; title: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Hotkey: ⌘K / Ctrl+K to open, Esc to close when open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openSelf();
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

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

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIndex]);

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function go(href: string) {
    close();
    router.push(href);
  }

  function onListKeyDown(e: React.KeyboardEvent) {
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
  }

  if (!isOpen) return null;

  const grouped = filtered.reduce<Record<string, CmdItem[]>>((acc, item) => {
    const g = item.group ?? "Other";
    (acc[g] ||= []).push(item);
    return acc;
  }, {});

  const flatIndexFor = (group: string, href: string, idxInGroup: number) => {
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
                      const flatIdx = flatIndexFor(group, i.href, localIdx);
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
