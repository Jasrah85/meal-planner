"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type LabelMap = Record<string, string>;

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);

  const [labels, setLabels] = useState<LabelMap>({
    p: "Pantries",
    recipes: "Recipes",
    items: "Items",
    new: "New",
    shopping: "Shopping",
    scan: "Scan",
    settings: "Settings",
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const next: LabelMap = { ...labels };

      // Helper to title‑case simple words when we don't have a mapping
      const titleCase = (s: string) =>
        s
          .replace(/-/g, " ")
          .replace(/\b\w/g, (m) => m.toUpperCase());

      // Look for numeric IDs and resolve to names/titles based on the previous segment
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        const prev = parts[i - 1];
        const id = Number(seg);
        if (!Number.isFinite(id)) {
          // If the segment is not a number and we don't already have a mapping, add a nice default
          if (!next[seg]) next[seg] = titleCase(seg);
          continue;
        }

        if (prev === "recipes") {
          const data = await fetchJSON<{ recipe?: { title?: string } }>(`/api/recipes/${id}`);
          if (data?.recipe?.title) next[seg] = data.recipe.title;
        } else if (prev === "p") {
          const data = await fetchJSON<{ pantry?: { name?: string } }>(`/api/pantry/${id}`);
          if (data?.pantry?.name) next[seg] = data.pantry.name;
        } else {
          // Fallback: show the numeric segment as‑is
          next[seg] = String(id);
        }
      }

      if (!cancelled) setLabels(next);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // recompute when the path changes

  if (parts.length === 0) return null;

  return (
    <div className="mb-4 text-sm text-gray-600">
      <nav aria-label="Breadcrumbs" className="flex flex-wrap items-center gap-2">
        <Link href="/" className="text-gray-600 hover:underline">Home</Link>
        {parts.map((seg, i) => {
          const href = "/" + parts.slice(0, i + 1).join("/");
          const label = labels[seg] ?? seg;
          const last = i === parts.length - 1;
          return (
            <span key={href} className="flex items-center gap-2">
              <span className="text-gray-400">/</span>
              {last ? (
                <span className="text-gray-900">{label}</span>
              ) : (
                <Link href={href} className="text-gray-600 hover:underline">
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
