"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type LabelMap = Record<string, string>;

async function fetchRecipeTitle(id: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/recipes/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.recipe?.title ?? null;
  } catch {
    return null;
  }
}

async function fetchPantryName(id: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/pantry/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.pantry?.name ?? null;
  } catch {
    return null;
  }
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);
  const [labels, setLabels] = useState<LabelMap>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: LabelMap = {};

      // Static segment name fixes
      map["p"] = "Pantries";
      map["recipes"] = "Recipes";
      map["items"] = "Items";
      map["scan"] = "Scan";
      map["new"] = "New";
      map["shopping"] = "Shopping";
      map["settings"] = "Settings";

      // Look for numeric IDs paired with known collections
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        const prev = parts[i - 1];
        const id = Number(seg);
        if (!Number.isFinite(id)) continue;

        if (prev === "recipes") {
          const title = await fetchRecipeTitle(id);
          if (title) map[seg] = title;
        } else if (prev === "p") {
          const name = await fetchPantryName(id);
          if (name) map[seg] = name;
        }
      }

      if (!cancelled) setLabels(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [parts]);

  if (parts.length === 0) return null;

  return (
    <div className="mb-4 text-sm text-gray-600">
      <nav aria-label="Breadcrumbs" className="flex items-center gap-2 flex-wrap">
        <Link href="/" className="text-gray-600 hover:underline">Home</Link>
        {parts.map((seg, i) => {
          const href = "/" + parts.slice(0, i + 1).join("/");
          const label =
            labels[seg] ??
            seg
              .replace(/-/g, " ")
              .replace(/\b\w/g, (m) => m.toUpperCase());
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
