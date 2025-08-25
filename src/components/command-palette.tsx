"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CmdItem = { label: string; href: string; group?: string };
type ApiRecipe = { id: number | string; title: string };

// Narrowing helpers (no `any`)
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function coerceRecipe(v: unknown): ApiRecipe | null {
  if (!isObject(v)) return null;
  const id = v.id;
  const title = v.title;
  if ((typeof id === "number" || typeof id === "string") && typeof title === "string") {
    return { id, title };
  }
  return null;
}

async function fetchQuickRecipes(): Promise<Array<{ id: number; title: string }>> {
  try {
    const res = await fetch("/api/recipes?limit=25", { cache: "no-store" });
    if (!res.ok) return [];
    const data: unknown = await res.json();

    // Accept either an array or { recipes: [...] }
    const maybeList: unknown =
      Array.isArray(data) ? data : (isObject(data) ? data.recipes : []);
    const list = Array.isArray(maybeList) ? maybeList : [];

    // Safely coerce and filter
    const coerced = list
      .map(coerceRecipe)
      .filter((r): r is ApiRecipe => r !== null)
      .map((r) => ({ id: Number(r.id), title: r.title }));

    return coerced;
  } catch {
    return [];
  }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [recipes, setRecipes] = useState<Array<{ id: number; title: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      inputRef.current?.focus();
      if (!recipes.length) {
        fetchQuickRecipes().then(setRecipes);
      }
    }
  }, [open]); // intentionally not depending on `recipes`

  const base: CmdItem[] = useMemo(
    () => [
      { label: "Dashboard", href: "/", group: "Navigation" },
      { label: "All Recipes", href: "/recipes", group: "Navigation" },
      { label: "New Recipe", href: "/recipes/new", group: "Navigation" },
      { label: "Shopping List", href: "/shopping", group: "Navigation" },
      { label: "Scan Item", href: "/scan", group: "Navigation" },
      { label: "Settings", href: "/settings", group: "Navigation" },
      { label: "Pantries", href: "/p", group: "Navigation" },
      ...recipes.map((r) => ({
        label: `Recipe: ${r.title}`,
        href: `/recipes/${r.id}`,
        group: "Recipes",
      })),
    ],
    [recipes]
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return base;
    const needle = q.toLowerCase();
    return base.filter((i) => i.label.toLowerCase().includes(needle));
  }, [q, base]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
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
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No matches.</div>
          ) : (
            <div className="divide-y">
              {Object.entries(
                filtered.reduce<Record<string, CmdItem[]>>((acc, item) => {
                  const g = item.group ?? "Other";
                  (acc[g] ||= []).push(item);
                  return acc;
                }, {})
              ).map(([group, items]) => (
                <div key={group}>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {group}
                  </div>
                  <ul>
                    {items.map((i) => (
                      <li key={`${group}-${i.href}`}>
                        <button
                          onClick={() => go(i.href)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span>{i.label}</span>
                          <span className="text-xs text-gray-400">{i.href}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500">
          <div>Navigate with mouse or type to filter</div>
          <div>Press Esc to close</div>
        </div>
      </div>
    </div>
  );
}
