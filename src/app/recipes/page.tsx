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

type MealDBBrowseCard = {
  idMeal: string;
  title: string;
  thumb: string | null;
  area: string | null;
  category: string | null;
  tags: string[];
  existsRecipeId: number | null; // server pre-resolves for MealDB
};

type SpoonBrowseItem = {
  externalId: string; // numeric id as string
  title: string;
  image: string | null;
  sourceUrl: string | null;
  provider: "API:SPOON";
};

type NinjasBrowseItem = {
  externalId: string; // title-lowercased (used as key)
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
  existsRecipeId: number | null;
  ninjasRaw?: NinjasBrowseItem["raw"]; // only for API:NINJAS imports
};

/* -------------------------------- Helpers -------------------------------- */
function extTagFor(provider: Provider, externalId: string) {
  switch (provider) {
    case "API:SPOON":
      return `ext:spoon:${externalId}`;
    case "API:NINJAS":
      return `ext:ninjas:${externalId.toLowerCase()}`;
    case "MEALDB":
    default:
      return `ext:mealdb:${externalId}`;
  }
}

async function fetchByTagId(tag: string): Promise<number | null> {
  // Requires you to have /api/recipes/by-tag in place
  const res = await fetch(`/api/recipes/by-tag?tag=${encodeURIComponent(tag)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { ok: boolean; id?: number };
  return json.ok && typeof json.id === "number" ? json.id : null;
}

/* ------------------------------ Library fetch ---------------------------- */
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

/* ------------------------------ Browse fetchers -------------------------- */
async function fetchMealDB(q: string, page: number, pageSize: number) {
  if (!q.trim()) return { items: [] as ClientBrowseCard[], total: 0 };
  const res = await fetch(
    `/api/recipes/browse/themealdb?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Browse (TheMealDB) failed");
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

async function fetchSpoon(q: string, page: number, pageSize: number) {
  if (!q.trim()) return { items: [] as ClientBrowseCard[], total: null as number | null };
  const res = await fetch(
    `/api/recipes/browse/spoonacular?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Browse (Spoonacular) failed");
  const data = (await res.json()) as { items: SpoonBrowseItem[]; total?: number | null };

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

async function fetchNinjas(q: string, page: number, pageSize: number) {
  if (!q.trim()) return { items: [] as ClientBrowseCard[], total: null as number | null };
  const res = await fetch(
    `/api/recipes/browse/ninjas?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Browse (API Ninjas) failed");
  const nin = (await res.json()) as {
    provider: "API:NINJAS";
    page: number;
    pageSize: number;
    items: NinjasBrowseItem[];
  };

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

  // API Ninjas often returns 1 item on free tier; we leave total as null
  return { items, total: null as number | null };
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

  /* ---------- Unified browse (3 providers, one search) ---------- */
  const [browseQ, setBrowseQ] = useState("");
  const [pageMeal, setPageMeal] = useState(1);
  const [pageSpoon, setPageSpoon] = useState(1);
  const [pageNinjas, setPageNinjas] = useState(1);
  const pageSizeMeal = 12;
  const pageSizeSpoon = 12;
  const pageSizeNinjas = 10;

  // Memoized keys so invalidateQueries works predictably
  const keyMeal = useMemo(() => ["browse", "mealdb", browseQ, pageMeal, pageSizeMeal] as const, [browseQ, pageMeal]);
  const keySpoon = useMemo(() => ["browse", "spoon", browseQ, pageSpoon, pageSizeSpoon] as const, [browseQ, pageSpoon]);
  const keyNinjas = useMemo(
    () => ["browse", "ninjas", browseQ, pageNinjas, pageSizeNinjas] as const,
    [browseQ, pageNinjas]
  );

  const meal = useQuery({
    queryKey: keyMeal,
    queryFn: () => fetchMealDB(browseQ, pageMeal, pageSizeMeal),
    enabled: !!browseQ.trim(),
  });
  const spoon = useQuery({
    queryKey: keySpoon,
    queryFn: () => fetchSpoon(browseQ, pageSpoon, pageSizeSpoon),
    enabled: !!browseQ.trim(),
  });
  const ninjas = useQuery({
    queryKey: keyNinjas,
    queryFn: () => fetchNinjas(browseQ, pageNinjas, pageSizeNinjas),
    enabled: !!browseQ.trim(),
  });

  /* ---------- Import / Remove (for browse cards) ---------- */
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
          item: { title: card.title, raw: card.ninjasRaw ?? null },
        }),
      });
      if (!r.ok) throw new Error("Import failed");
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keyMeal });
      await qc.invalidateQueries({ queryKey: keySpoon });
      await qc.invalidateQueries({ queryKey: keyNinjas });
      await qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const removeImported = useMutation({
    mutationFn: async (card: ClientBrowseCard) => {
      if (card.provider === "MEALDB") {
        const r = await fetch(
          `/api/recipes/import/themealdb?idMeal=${encodeURIComponent(card.externalId)}`,
          { method: "DELETE" }
        );
        if (!r.ok) throw new Error("Remove failed");
        return r.json();
      }
      // Spoon / Ninjas: resolve recipe id via ext tag, then delete
      const tag = extTagFor(card.provider, card.externalId);
      const recipeId = await fetchByTagId(tag);
      if (!recipeId) throw new Error("Recipe not found locally");
      const r = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Remove failed");
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keyMeal });
      await qc.invalidateQueries({ queryKey: keySpoon });
      await qc.invalidateQueries({ queryKey: keyNinjas });
      await qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  // Derived page counts (only MealDB/Spoon provide totals)
  const mealTotal = meal.data?.total ?? 0;
  const mealPages = Math.max(1, Math.ceil(mealTotal / pageSizeMeal));
  const spoonTotal = spoon.data?.total ?? 0;
  const spoonPages = spoonTotal ? Math.max(1, Math.ceil(spoonTotal / pageSizeSpoon)) : null;

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

      {/* Unified Browse: one search, three sections */}
      <div className="border-t pt-6 space-y-6">
        <div className="font-medium">Browse external recipes (TheMealDB • Spoonacular • API Ninjas)</div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search (e.g., chicken, pasta)…"
            value={browseQ}
            onChange={(e) => {
              setBrowseQ(e.target.value);
              setPageMeal(1);
              setPageSpoon(1);
              setPageNinjas(1);
            }}
            className="min-w-52"
          />
          <Button
            onClick={() => {
              meal.refetch();
              spoon.refetch();
              ninjas.refetch();
            }}
            disabled={!browseQ.trim() || meal.isFetching || spoon.isFetching || ninjas.isFetching}
          >
            {meal.isFetching || spoon.isFetching || ninjas.isFetching ? "Searching…" : "Search all"}
          </Button>
        </div>

        {/* TheMealDB Section */}
        <section className="space-y-3">
          <div className="text-sm font-medium">TheMealDB</div>
          {meal.isLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {meal.data?.items?.map((card) => (
                  <div key={card.key} className="border rounded-md p-2 space-y-2">
                    {card.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt={card.title} className="w-full h-32 object-cover rounded" />
                    ) : null}
                    <div className="text-sm font-medium line-clamp-2">{card.title}</div>
                    {card.meta ? <div className="text-xs text-gray-500">{card.meta}</div> : null}
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

              {mealTotal > pageSizeMeal && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageMeal((p) => Math.max(1, p - 1))}
                    disabled={pageMeal === 1}
                  >
                    Prev
                  </Button>
                  <span className="text-sm">
                    Page {pageMeal} / {mealPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPageMeal((p) => Math.min(mealPages, p + 1))}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Spoonacular Section */}
        <section className="space-y-3">
          <div className="text-sm font-medium">Spoonacular</div>
          {spoon.isLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {spoon.data?.items?.map((card) => (
                  <div key={card.key} className="border rounded-md p-2 space-y-2">
                    {card.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt={card.title} className="w-full h-32 object-cover rounded" />
                    ) : null}
                    <div className="text-sm font-medium line-clamp-2">{card.title}</div>
                    {card.sourceUrl ? (
                      <a className="text-xs underline" href={card.sourceUrl} target="_blank" rel="noreferrer">
                        Source
                      </a>
                    ) : null}
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

              {spoonPages && spoonPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageSpoon((p) => Math.max(1, p - 1))}
                    disabled={pageSpoon === 1}
                  >
                    Prev
                  </Button>
                  <span className="text-sm">
                    Page {pageSpoon} / {spoonPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPageSpoon((p) => Math.min(spoonPages, p + 1))}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* API Ninjas Section */}
        <section className="space-y-3">
          <div className="text-sm font-medium">API Ninjas</div>
          {ninjas.isLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {ninjas.data?.items?.map((card) => (
                  <div key={card.key} className="border rounded-md p-2 space-y-2">
                    {card.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt={card.title} className="w-full h-32 object-cover rounded" />
                    ) : null}
                    <div className="text-sm font-medium line-clamp-2">{card.title}</div>
                    <div className="text-xs text-gray-500">{card.meta}</div>
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

              {/* Most free plans return 1 result; we still render pager for future upgrades */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNinjas((p) => Math.max(1, p - 1))}
                  disabled={pageNinjas === 1}
                >
                  Prev
                </Button>
                <span className="text-sm">Page {pageNinjas}</span>
                <Button variant="outline" size="sm" onClick={() => setPageNinjas((p) => p + 1)}>
                  Next
                </Button>
              </div>

              <div className="text-xs text-gray-500">
                On API Ninjas free tier, pagination often returns a single result per query.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
