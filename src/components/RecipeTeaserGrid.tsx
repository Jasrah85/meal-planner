"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type RecipeTeaser = {
  id: number;
  title: string;
  servings: number | null;
  sourceType: string | null;
  _count?: { ingredients: number };
};

export default function RecipeTeaserGrid({ initial }: { initial: RecipeTeaser[] }) {
  const [recipes, setRecipes] = useState<RecipeTeaser[]>(initial);
  const [isPending, startTransition] = useTransition();
  const excludeQuery = useMemo(() => recipes.map(r => r.id).join(","), [recipes]);

  async function loadMore(limit = 9) {
    startTransition(async () => {
      const res = await fetch(`/api/recipes/teasers?limit=${limit}&exclude=${excludeQuery}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const incoming: RecipeTeaser[] = data.recipes ?? [];
      const existing = new Set(recipes.map(r => r.id));
      setRecipes([...recipes, ...incoming.filter(r => !existing.has(r.id))]);
    });
  }

  async function shuffle(limit = recipes.length || 12) {
    startTransition(async () => {
      const res = await fetch(`/api/recipes/teasers?limit=${limit}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setRecipes(data.recipes ?? []);
    });
  }

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <button
          onClick={() => shuffle()}
          disabled={isPending}
          className="btn"
        >
          {isPending ? "Shuffling…" : "Shuffle"}
        </button>
        <button
          onClick={() => loadMore(9)}
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? "Loading…" : "Load more"}
        </button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recipes.map((r) => (
            <li key={r.id} className="group">
            <div className="card card-hover p-4">
                <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100">
                {/* If you use next/image, slot it here with fill */}
                {/* <Image … className="object-cover transition-transform duration-200 group-hover:scale-[1.02]" /> */}
                </div>

                <h3 className="text-base font-semibold leading-tight line-clamp-2">{r.title}</h3>
                <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                {(r._count?.ingredients ?? 0)} ingredients
                {r.sourceType && <span className="inline-block h-1 w-1 rounded-full bg-gray-300" />}
                {r.sourceType && <span>API:{r.sourceType}</span>}
                </div>

                <div className="mt-3">
                <Link href={`/recipes/${r.id}`} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                    Open
                    <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70">
                    <path d="M7 17L17 7M17 7H8M17 7v9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                    </svg>
                </Link>
                </div>
            </div>
            </li>
        ))}
      </ul>
    </div>
  );
}
