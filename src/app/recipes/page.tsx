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

type BrowseCard = {
  idMeal: string;
  title: string;
  thumb: string | null;
  area: string | null;
  category: string | null;
  tags: string[];
  existsRecipeId: number | null;
};

async function fetchRecipes(q: string, tag: string) {
  const params = new URLSearchParams();
  if (q) params.set("query", q);
  if (tag) params.set("tag", tag);
  const url = `/api/recipes${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load recipes");
  const json = (await res.json()) as { recipes: RecipeListRow[] };
  return json.recipes;
}

export default function RecipesPage() {
  const qc = useQueryClient();

  // Library search
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");

  const { data: library, isLoading, refetch } = useQuery({
    queryKey: ["recipes", q, tag],
    queryFn: () => fetchRecipes(q, tag),
  });

  // Quick create (user recipes)
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

  // Remove from library (DELETE /api/recipes/:id)
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });

  // Browse (TheMealDB)
  const [browseQ, setBrowseQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [browsing, setBrowsing] = useState(false);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [results, setResults] = useState<BrowseCard[]>([]);

  async function loadBrowse(p = 1) {
    setBrowsing(true);
    try {
      const r = await fetch(`/api/recipes/browse/themealdb?q=${encodeURIComponent(browseQ)}&page=${p}&pageSize=${pageSize}`);
      const data = await r.json();
      setResults(data.results || []);
      setBrowseTotal(data.total || 0);
      setPage(p);
    } finally {
      setBrowsing(false);
    }
  }

  async function importOne(idMeal: string) {
    const r = await fetch(`/api/recipes/import/themealdb`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idMeal }),
    });
    if (r.ok) {
      await loadBrowse(page);
      await refetch();
    }
  }

  async function removeOne(idMeal: string) {
    if (!confirm("Remove this imported recipe?")) return;
    const r = await fetch(`/api/recipes/import/themealdb?idMeal=${encodeURIComponent(idMeal)}`, { method: "DELETE" });
    if (r.ok) {
      await loadBrowse(page);
      await refetch();
    }
  }

  const pageCount = Math.max(1, Math.ceil(browseTotal / pageSize));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Recipes</h1>

      {/* Library search/filter + quick create */}
      <div className="space-y-4">
        <div className="flex gap-2 max-w-2xl">
          <Input placeholder="Search library…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input placeholder="Filter by tag (e.g. diabetic)" value={tag} onChange={(e) => setTag(e.target.value)} />
          <Button onClick={() => refetch()}>Search</Button>
          <Link href="/recipes/new" className="underline ml-auto">New Recipe</Link>
        </div>

        <div className="flex gap-2 max-w-2xl">
          <Input placeholder="Quick add title…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Button onClick={() => create.mutate()} disabled={!newTitle.trim() || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>

        {/* Library list with remove */}
        {isLoading ? (
          <div>Loading…</div>
        ) : (
          <ul className="divide-y rounded-md border">
            {library?.map((r) => (
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
                <div className="flex items-center gap-3">
                  {r.sourceUrl && (
                    <a className="text-xs underline" href={r.sourceUrl} target="_blank" rel="noreferrer">Source</a>
                  )}
                  <Button variant="ghost" className="text-red-600" onClick={() => remove.mutate(r.id)}>Remove</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Browse TheMealDB with pagination + import/remove toggle */}
      <div className="border-t pt-6">
        <div className="font-medium mb-2">Browse (TheMealDB)</div>
        <div className="flex gap-2 max-w-2xl">
          <Input placeholder="Try: chicken, pasta…" value={browseQ} onChange={(e) => setBrowseQ(e.target.value)} />
          <Button onClick={() => loadBrowse(1)} disabled={browsing}>{browsing ? "Searching…" : "Search"}</Button>
        </div>

        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {results.map((r) => (
            <li key={r.idMeal} className="border rounded p-3">
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-gray-500">{r.category || "—"} • {r.area || "—"}</div>
              {r.thumb ? <img src={r.thumb} alt="" className="mt-2 w-full rounded" /> : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {r.tags.map((t) => <span key={t} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{t}</span>)}
              </div>
              <div className="mt-3">
                {r.existsRecipeId
                  ? <Button variant="ghost" className="text-red-600" onClick={() => removeOne(r.idMeal)}>Remove</Button>
                  : <Button variant="outline" onClick={() => importOne(r.idMeal)}>Import</Button>}
              </div>
            </li>
          ))}
        </ul>

        {browseTotal > pageSize && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" onClick={() => loadBrowse(Math.max(1, page - 1))} disabled={page <= 1}>Prev</Button>
            <div className="text-sm">Page {page} / {pageCount}</div>
            <Button variant="outline" onClick={() => loadBrowse(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
