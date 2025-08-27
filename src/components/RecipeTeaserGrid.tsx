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

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recipes.map((r) => (
          <li key={r.id}>
            <Card className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium line-clamp-2">{r.title}</div>
                <div className="text-xs text-gray-500">
                  {(r._count?.ingredients ?? 0)} ingredients
                  {r.sourceType ? ` • ${r.sourceType}` : ""}
                </div>
              </div>
              <Link className="underline text-sm" href={`/recipes/${r.id}`}>Open</Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
