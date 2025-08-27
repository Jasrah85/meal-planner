// components/RecipeGrid.tsx
"use client";

import { useMemo, useState, useTransition } from "react";

type Recipe = {
  id: number;
  title: string;
  image?: string | null;
  source?: string | null;
  ingredientCount?: number | null;
};

export default function RecipeGrid({ initialRecipes }: { initialRecipes: Recipe[] }) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [isPending, startTransition] = useTransition();
  const excludeParam = useMemo(() => recipes.map((r) => r.id).join(","), [recipes]);

  async function loadMore(limit = 9) {
    startTransition(async () => {
      const res = await fetch(`/api/recipes?limit=${limit}&exclude=${excludeParam}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      // De-dupe defensively in case backend misses one
      const incoming: Recipe[] = data.recipes || [];
      const existingIds = new Set(recipes.map((r) => r.id));
      const merged = [...recipes, ...incoming.filter((r) => !existingIds.has(r.id))];
      setRecipes(merged);
    });
  }

  async function shuffle(limit = recipes.length || 12) {
    startTransition(async () => {
      const res = await fetch(`/api/recipes?limit=${limit}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setRecipes(data.recipes || []);
    });
  }

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <button
          onClick={() => shuffle()}
          disabled={isPending}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? "Shuffling…" : "Shuffle"}
        </button>

        <button
          onClick={() => loadMore(9)}
          disabled={isPending}
          className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm hover:bg-black disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load more"}
        </button>
      </div>

      <ul
        className="
          grid gap-4
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4
        "
      >
        {recipes.map((r) => (
          <li key={r.id} className="group rounded-2xl border bg-white/70 backdrop-blur p-4 shadow-sm hover:shadow-md transition">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100 mb-3">
              {r.image ? (
                // If you're already using next/image, swap this <img> for <Image>
                <img
                  src={r.image}
                  alt={r.title}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : null}
            </div>

            <h3 className="text-base font-semibold leading-tight line-clamp-2">{r.title}</h3>
            <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
              {r.ingredientCount != null && <span>{r.ingredientCount} ingredients</span>}
              {r.source && <span className="inline-block h-1 w-1 rounded-full bg-gray-300" />}
              {r.source && <span>API:{r.source.toUpperCase()}</span>}
            </div>

            <div className="mt-3">
              <a
                href={`/recipes/${r.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline"
              >
                Open
                <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70">
                  <path d="M7 17L17 7M17 7H8M17 7v9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
