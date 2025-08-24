"use client";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type RecipeListRow = {
  id: number;
  title: string;
  servings: number | null;
  sourceType: string | null;
  sourceUrl: string | null;
  tags: string[];
  _count?: { ingredients: number };
};

async function fetchRecipes(q: string) {
  const url = q ? `/api/recipes?query=${encodeURIComponent(q)}` : "/api/recipes";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load recipes");
  const json = await res.json() as { recipes: RecipeListRow[] };
  return json.recipes;
}

export default function RecipesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["recipes", q],
    queryFn: () => fetchRecipes(q),
  });

  const [newTitle, setNewTitle] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), sourceType: "USER" }),
      });
      if (!res.ok) throw new Error("Failed to create recipe");
      return res.json();
    },
    onSuccess: () => {
      setNewTitle("");
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  // Simple TheMealDB import UI
  const [importQ, setImportQ] = useState("");
  const [importing, setImporting] = useState(false);
  const importFromMealDB = async () => {
    if (!importQ.trim()) return;
    setImporting(true);
    try {
      const url = `/api/recipes/import/themealdb?q=${encodeURIComponent(importQ.trim())}&limit=5&import=true`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Import failed");
      await res.json();
      await refetch();
      setImportQ("");
      alert("Imported recipes from TheMealDB.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Recipes</h1>

      {/* Search */}
      <div className="flex gap-2 max-w-xl">
        <Input placeholder="Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => refetch()}>Search</Button>
        <Link href="/recipes/new" className="underline ml-auto">New Recipe</Link>
      </div>

      {/* Quick create */}
      <div className="flex gap-2 max-w-xl">
        <Input placeholder="Quick add title…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <Button onClick={() => create.mutate()} disabled={!newTitle.trim() || create.isPending}>
          {create.isPending ? "Creating…" : "Create"}
        </Button>
      </div>

      {/* Import from TheMealDB */}
      <div className="rounded-md border p-3 max-w-xl">
        <div className="font-medium mb-2">Import from TheMealDB</div>
        <div className="flex gap-2">
          <Input placeholder="Try: chicken, pasta…" value={importQ} onChange={(e) => setImportQ(e.target.value)} />
          <Button onClick={importFromMealDB} disabled={importing || !importQ.trim()}>
            {importing ? "Importing…" : "Import 5"}
          </Button>
        </div>
        <div className="text-xs text-gray-500 mt-1">Imports are saved immediately to your DB.</div>
      </div>

      {/* List */}
      {isLoading ? (
        <div>Loading…</div>
      ) : (
        <ul className="divide-y rounded-md border">
          {data?.map((r) => (
            <li key={r.id} className="p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">
                  <Link href={`/recipes/${r.id}`} className="underline">{r.title}</Link>
                </div>
                <div className="text-xs text-gray-500">
                  {r._count?.ingredients ?? 0} ingredients
                  {r.tags?.length ? ` • ${r.tags.join(", ")}` : ""}
                  {r.sourceType ? ` • ${r.sourceType}` : ""}
                </div>
              </div>
              {r.sourceUrl && (
                <a className="text-xs underline" href={r.sourceUrl} target="_blank" rel="noreferrer">Source</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
