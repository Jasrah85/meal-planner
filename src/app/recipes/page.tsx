"use client";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* ----------------------------- Library types ----------------------------- */
type RecipeListRow = {
  id: number;
  title: string;
  servings: number | null;
  sourceType: string | null;
  sourceUrl: string | null;
  tags: string[];
  _count?: { ingredients: number };
};

/* ----------------------------- Browse types ------------------------------ */
type Provider = "MEALDB" | "API:SPOON" | "API:NINJAS";

/** ThemealDB browse card (server returns this) */
type MealDBBrowseCard = {
  idMeal: string;
  title: string;
  thumb: string | null;
  area: string | null;
  category: string | null;
  tags: string[];
  /** Server already resolves this for TheMealDB */
  existsRecipeId: number | null;
};

type SpoonBrowseItem = {
  externalId: string; // numeric id as string
  title: string;
  image: string | null;
  sourceUrl: string | null;
  provider: "API:SPOON";
};

type NinjasBrowseItem = {
  externalId: string; // we use title-lowercased as id
  title: string;
  image: string | null;
  sourceUrl: string | null;
  provider: "API:NINJAS";
  preview?: string;
  raw?: {
    ingredients?: string | null;
    instructions?: string | null;
    servings?: string | null;
  };
};

type ClientBrowseCard = {
  key: string;
  provider: Provider;
  externalId: string;
  title: string;
  image: string | null;
  meta: string | null; // e.g., "Category • Area"
  tags: string[];
  sourceUrl: string | null;
  existsRecipeId: number | null; // if already imported
  // ninjas-only (for import body)
  ninjasRaw?: NinjasBrowseItem["raw"];
};

/* -------------------------------- Helpers -------------------------------- */
function extTagFor(provider: Provider, externalId: string) {
  if (provider === "API:SPOON") return `ext:spoon:${externalId}`;
  if (provider === "API:NINJAS") return `ext:ninjas:${externalId.toLowerCase()}`;
  return `ext:mealdb:${externalId}`; // not used here (MealDB server already includes exists id)
}

async function fetchByTagId(tag: string): Promise<number | null> {
  // If the endpoint doesn't exist server-side, this will 404 and we'll return null
  const res = await fetch(`/api/recipes/by-tag?tag=${encodeURIComponent(tag)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { ok: boolean; id?: number };
  return json.ok && typeof json.id === "number" ? json.id : null;
}

/* ------------------------------ Data fetching ---------------------------- */
async function fetchRecipes(q: string, tag: string) {
  const params = new URLSearchParams();
  if (q) params.set("query", q);
  if (tag) params.set("tag", tag);
  const url = `/api/recipes${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load recipes");
  const json = (await res.json()) as { recipes: RecipeListRow[] };
  return json.recipes;
}

async function fetchBrowse(
  provider: Provider,
  query: string,
  page: number,
  pageSize: number
): Promise<{ items: ClientBrowseCard[]; total: number | null }> {
  if (!query.trim()) return { items: [], total: null };

  if (provider === "MEALDB") {
    const res = await fetch(
      `/api/recipes/browse/themealdb?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Browse (MealDB) failed");
    const data = (await res.json()) as { results: MealDBBrowseCard[]; total: number };
    const items: ClientBrowseCard[] = data.results.map((r) => ({
      key: `MEALDB:${r.idMeal}`,
      provider: "MEALDB",
      externalId: r.idMeal,
      title: r.title,
      image: r.thumb,
      meta: [r.category || undefined, r.area || undefined].filter(Boolean).join(" • ") || null,
      tags: r.tags,
      sourceUrl: null,
      existsRecipeId: r.existsRecipeId ?? null,
    }));
    return { items, total: data.total ?? items.length };
  }

  if (provider === "API:SPOON") {
    const res = await fetch(
      `/api/recipes/browse/spoonacular?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Browse (Spoonacular) failed");
    const data = (await res.json()) as { items: SpoonBrowseItem[]; total?: number | null };
    // resolve existsRecipeId per item via tag lookup
    const items = await Promise.all(
      (data.items || []).map(async (r) => {
        const tag = extTagFor("API:SPOON", r.externalId);
        const exists = await fetchByTagId(tag);
        const card: ClientBrowseCard = {
          key: `SPOON:${r.externalId}`,
          provider: "API:SPOON",
          externalId: r.externalId,
          title: r.title,
          image: r.image,
          meta: null,
          tags: [],
          sourceUrl: r.sourceUrl,
          existsRecipeId: exists,
        };
        return card;
      })
    );
    return { items, total: data.total ?? null };
  }

  // API:NINJAS
  const res = await fetch(
    `/api/recipes/browse/ninjas?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Browse (API Ninjas) failed");
  const nin = (await res.json()) as { provider: "API:NINJAS"; page: number; pageSize: number; items: NinjasBrowseItem[] };
  const items = await Promise.all(
    (nin.items || []).map(async (r) => {
      const tag = extTagFor("API:NINJAS", r.externalId);
      const exists = await fetchByTagId(tag);
      const card: ClientBrowseCard = {
        key: `NINJAS:${r.externalId}`,
        provider: "API:NINJAS",
        externalId: r.externalId,
        title: r.title,
        image: r.image,
        meta: null,
        tags: [],
        sourceUrl: r.sourceUrl,
        existsRecipeId: exists,
        ninjasRaw: r.raw,
      };
      return card;
    })
  );
  return { items, total: null };
}

/* ---------------------------------- Page --------------------------------- */
export default function RecipesPage() {
  const qc = useQueryClient();

  /* ---------- Library search + filter ---------- */
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const { data: library, isLoading: libLoading, refetch: refetchLibrary } = useQuery({
    queryKey: ["recipes", q, tag],
    queryFn: () => fetchRecipes(q, tag),
  });

  /* ---------- Quick create ---------- */
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

  /* ---------- Library remove ---------- */
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });

  /* ---------- Browse panel ---------- */
  const [provider, setProvider] = useState<Provider>("MEALDB");
  const [browseQ, setBrowseQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const browseKey = useMemo(() => ["browse", provider, browseQ, page, pageSize] as const, [provider, browseQ, page]);
  const browse = useQuery({
    queryKey: browseKey,
    queryFn: () => fetchBrowse(provider, browseQ, page, pageSize),
    enabled: !!browseQ.trim(),
  });

  /* ---------- Import (per provider) ---------- */
  const importOne = useMutation({
    mutationFn: async (card: ClientBrowseCard) => {
      if (card.provider === "MEALDB") {
        const r = await fetch(`/api/recipes/import/themealdb`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idMeal: card.externalId }),
        });
        if (!r.ok) throw new Error("Import failed");
        return r.json();
      }
      if (card.provider === "API:SPOON") {
        const r = await fetch(`/api/recipes/import/spoonacular`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: Number(card.externalId) }),
        });
        if (!r.ok) throw new Error("Import failed");
        return r.json();
      }
      // API:NINJAS
      const r = await fetch(`/api/recipes/import/ninjas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          item: {
            title: card.title,
            raw: card.ninjasRaw ?? null,
          },
        }),
      });
      if (!r.ok) throw new Error("Import failed");
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: browseKey });
      await qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  /* ---------- Remove imported (toggle) ---------- */
  const removeImported = useMutation({
    mutationFn: async (card: ClientBrowseCard) => {
      // MEALDB: you already have a dedicated DELETE route
      if (card.provider === "MEALDB") {
        const r = await fetch(
          `/api/recipes/import/themealdb?idMeal=${encodeURIComponent(card.externalId)}`,
          { method: "DELETE" }
        );
        if (!r.ok) throw new Error("Remove failed");
        return r.json();
      }
      // Spoon/Ninjas: resolve recipe id via tag, then DELETE /api/recipes/:id
      const tag = extTagFor(card.provider, card.externalId);
      const recipeId = await fetchByTagId(tag);
      if (!recipeId) throw new Error("Recipe not found locally");
      const r = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Remove failed");
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: browseKey });
      await qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const total = browse.data?.total ?? null;
  const pageCount = total ? Math.max(1, Math.ceil(total / pageSize)) : null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Recipes</h1>

      {/* Library search/filter + quick create */}
      <div className="space-y-4">
        <div className="flex gap-2 max-w-2xl">
          <Input placeholder="Search library…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input placeholder="Filter by tag (e.g. diabetic)" value={tag} onChange={(e) => setTag(e.target.value)} />
          <Button onClick={() => refetchLibrary()}>Search</Button>
          <Link href="/recipes/new" className="underline ml-auto">
            New Recipe
          </Link>
        </div>

        <div className="flex gap-2 max-w-2xl">
          <Input placeholder="Quick add title…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Button onClick={() => create.mutate()} disabled={!newTitle.trim() || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>

        {/* Library list with remove */}
        {libLoading ? (
          <div>Loading…</div>
        ) : (
          <ul className="divide-y rounded-md border">
            {library?.map((r) => (
              <li key={r.id} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    <Link href={`/recipes/${r.id}`} className="underline">
                      {r.title}
                    </Link>
                  </div>
                  <div className="text-xs text-gray-500">
                    {r._count?.ingredients ?? 0} ingredients
                    {r.tags?.length ? ` • ${r.tags.join(", ")}` : ""}
                    {r.sourceType ? ` • ${r.sourceType}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.sourceUrl && (
                    <a className="text-xs underline" href={r.sourceUrl} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  )}
                  <Button variant="ghost" className="text-red-600" onClick={() => remove.mutate(r.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Browse panel */}
      <div className="border-t pt-6 space-y-3">
        <div className="font-medium">Browse external recipes</div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as Provider);
              setPage(1);
            }}
          >
            <option value="MEALDB">TheMealDB</option>
            <option value="API:SPOON">Spoonacular</option>
            <option value="API:NINJAS">API Ninjas</option>
          </select>

          <Input
            placeholder="Search (e.g., chicken, pasta)…"
            value={browseQ}
            onChange={(e) => {
              setBrowseQ(e.target.value);
              setPage(1);
            }}
            className="min-w-52"
          />
          <Button onClick={() => browse.refetch()} disabled={!browseQ.trim() || browse.isFetching}>
            {browse.isFetching ? "Searching…" : "Search"}
          </Button>
        </div>

        {browse.isLoading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {browse.data?.items?.map((card) => (
                <div key={card.key} className="border rounded-md p-2 space-y-2">
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image} alt={card.title} className="w-full h-32 object-cover rounded" />
                  ) : null}
                  <div className="text-sm font-medium line-clamp-2">{card.title}</div>
                  {card.meta ? <div className="text-xs text-gray-500">{card.meta}</div> : null}
                  {card.sourceUrl ? (
                    <a className="text-xs underline" href={card.sourceUrl} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {card.tags.map((t) => (
                      <span key={t} className="text-[11px] bg-gray-100 px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-1">
                    {card.existsRecipeId ? (
                      <Button
                        variant="ghost"
                        className="text-red-600"
                        size="sm"
                        onClick={() => removeImported.mutate(card)}
                        disabled={removeImported.isPending}
                      >
                        {removeImported.isPending ? "Removing…" : "Remove"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => importOne.mutate(card)}
                        disabled={importOne.isPending}
                      >
                        {importOne.isPending ? "Importing…" : "Import"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination (shows exact pages if API returns total) */}
            {(pageCount ?? 2) > 1 && (
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Prev
                </Button>
                <span className="text-sm">
                  Page {page}
                  {pageCount ? ` / ${pageCount}` : ""}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}

            {provider === "API:NINJAS" && (
              <div className="text-xs text-gray-500">
                Note: On API Ninjas free tier, pagination may return few results per search.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
