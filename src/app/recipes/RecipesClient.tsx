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
  pantryId?: number | null;
  pantryName?: string | null;
};

/* ----------------------------- Browse types ------------------------------ */
type Provider = "MEALDB" | "API:SPOON" | "API:NINJAS";

type NinjasRaw =
  | {
      ingredients?: string | null;
      instructions?: string | null;
      servings?: string | null;
    }
  | null;

type ClientBrowseCard = {
  key: string;
  provider: Provider;
  externalId: string;
  title: string;
  image: string | null;
  meta: string | null;
  tags: string[];
  sourceUrl: string | null;
  existsRecipeId: number | null;
  ninjasRaw?: NinjasRaw;
};

type CombinedBrowseResponse = {
  items: ClientBrowseCard[];
  total: number;
  page: number;
  pageSize: number;
};

/* ----------------------------- Helpers ----------------------------------- */
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

async function fetchCombinedBrowse(
  q: string,
  page: number,
  pageSize: number
): Promise<CombinedBrowseResponse> {
  const base = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

  // BEFORE:
  // let r = await fetch(urlRandom, { cache: "no-store" });

  const urlRandom = `/api/recipes/browse?${q.trim() ? `q=${encodeURIComponent(q)}&` : "random=1&"}${base}`;
  const r = await fetch(urlRandom, { cache: "no-store" }); // <-- const
  if (!r.ok) throw new Error("Browse failed");

  let data = (await r.json()) as CombinedBrowseResponse;

  // Fallback to a popular query if random returns empty
  if (!q.trim() && (!data.items || data.items.length === 0)) {
    const fallbacks = ["chicken", "pasta", "beef", "salad", "soup"];
    const pick = fallbacks[(page - 1) % fallbacks.length];
    const urlFallback = `/api/recipes/browse?q=${encodeURIComponent(pick)}&${base}`;
    const r2 = await fetch(urlFallback, { cache: "no-store" });
    if (r2.ok) data = (await r2.json()) as CombinedBrowseResponse;
  }

  return data;
}


async function fetchByTagId(tag: string): Promise<number | null> {
  const res = await fetch(`/api/recipes/by-tag?tag=${encodeURIComponent(tag)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { ok: boolean; id?: number };
  return json.ok && typeof json.id === "number" ? json.id : null;
}

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

/* ---------------------------------- Page --------------------------------- */
export default function RecipesClient({ initialLibrary }: { initialLibrary: RecipeListRow[] }) {
  const qc = useQueryClient();

  /* ---------- Library search + filter + sort ---------- */
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<"title_asc" | "newest" | "ingredients_desc">("title_asc");

  const {
    data: library = initialLibrary,
    isLoading: libLoading,
    refetch: refetchLibrary,
  } = useQuery<RecipeListRow[]>({
    queryKey: ["recipes", q, tag],
    queryFn: () => fetchRecipes(q, tag),
    // show SSR’d recipes immediately
    initialData: initialLibrary,
    // keep the previous data while typing/changing filters
    placeholderData: (prev) => prev,
  });

  const sortedLibrary = useMemo(() => {
    const copy = [...(library ?? [])];
    switch (sort) {
      case "newest":
        copy.sort((a, b) => b.id - a.id);
        break;
      case "ingredients_desc":
        copy.sort((a, b) => (b._count?.ingredients ?? 0) - (a._count?.ingredients ?? 0));
        break;
      default:
        copy.sort((a, b) => a.title.localeCompare(b.title));
    }
    return copy;
  }, [library, sort]);

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

  /* ---------- Unified browse (merged providers) ---------- */
  const [searchText, setSearchText] = useState("");
  const [browseQ, setBrowseQ] = useState(""); // empty => try random, then fallback
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const browse = useQuery<CombinedBrowseResponse>({
    queryKey: ["browse-all", browseQ, page, pageSize],
    queryFn: () => fetchCombinedBrowse(browseQ, page, pageSize),
    enabled: true,
    placeholderData: (prev) => prev,
  });

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
      const r = await fetch(`/api/recipes/import/ninjas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item: { title: card.title, raw: card.ninjasRaw ?? null } }),
      });
      if (!r.ok) throw new Error("Import failed");
      return r.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["browse-all"] });
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
      const tagValue = extTagFor(card.provider, card.externalId);
      const recipeId = await fetchByTagId(tagValue);
      if (!recipeId) throw new Error("Recipe not found locally");
      const del = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      if (!del.ok) throw new Error("Remove failed");
      return del.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["browse-all"] });
      await qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const total = browse.data?.total ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Recipes</h1>

      {/* Library search/filter + quick create */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 max-w-3xl">
          <Input
            placeholder="Search saved recipes (title or ingredient)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Input
            placeholder="Filter by tag (e.g. diabetic)"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <select
            className="border rounded-md px-2 py-1 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort saved recipes"
          >
            <option value="title_asc">Sort: Title A–Z</option>
            <option value="newest">Sort: Newest</option>
            <option value="ingredients_desc">Sort: Most ingredients</option>
          </select>
          <Button onClick={() => refetchLibrary()}>Apply</Button>

          <Link href="/recipes/new" className="underline ml-auto text-sm">
            New Recipe
          </Link>
        </div>

        <div className="flex gap-2 max-w-3xl">
          <Input
            placeholder="Quick add title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button
            onClick={() => create.mutate()}
            disabled={!newTitle.trim() || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>

        {/* Library list */}
        {libLoading ? (
          <div>Loading…</div>
        ) : (
          <ul className="divide-y rounded-md border">
            {sortedLibrary.map((r) => (
              <li key={r.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    <Link href={`/recipes/${r.id}`} className="underline">
                      {r.title}
                    </Link>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-1">
                    <span>{r._count?.ingredients ?? 0} ingredients</span>
                    {r.tags?.length ? <span>• {r.tags.join(", ")}</span> : null}
                    {r.sourceType ? <span>• {r.sourceType}</span> : null}
                    {r.pantryName ? <span>• Pantry: {r.pantryName}</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
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
            {!sortedLibrary.length && (
              <li className="p-3 text-sm text-gray-500">No recipes yet.</li>
            )}
          </ul>
        )}
      </div>

      {/* Unified browse */}
      <div className="border-t pt-6 space-y-3">
        <div className="font-medium">Browse external recipes (combined)</div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search the web feed (e.g., chicken, pasta)…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button
            onClick={() => {
              setBrowseQ(searchText.trim());
              setPage(1);
            }}
            disabled={browse.isFetching}
          >
            {browse.isFetching ? "Searching…" : "Search all"}
          </Button>
          {!browseQ && (
            <span className="text-xs text-gray-500">
              Showing a mixed/popular feed. Use search to filter.
            </span>
          )}
        </div>

        {browse.isLoading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {browse.data?.items?.map((card: ClientBrowseCard) => (
                <div key={card.key} className="border rounded-md p-2 space-y-2">
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image} alt={card.title} className="w-full h-32 object-cover rounded" />
                  ) : null}
                  <div className="text-xs text-gray-500">{card.provider}</div>
                  <div className="text-sm font-medium line-clamp-2">{card.title}</div>
                  {card.meta ? <div className="text-xs text-gray-500">{card.meta}</div> : null}
                  {card.sourceUrl ? (
                    <a className="text-xs underline" href={card.sourceUrl} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {card.tags.map((t: string) => (
                      <span key={t} className="text-[11px] bg-gray-100 px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {card.existsRecipeId ? (
                      <>
                        <Link className="text-xs underline" href={`/recipes/${card.existsRecipeId}`}>
                          Open
                        </Link>
                        <Button
                          variant="ghost"
                          className="text-red-600"
                          size="sm"
                          onClick={() => removeImported.mutate(card)}
                          disabled={removeImported.isPending}
                        >
                          {removeImported.isPending ? "Removing…" : "Remove"}
                        </Button>
                      </>
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

            {(total > pageSize || page > 1) && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </Button>
                <span className="text-sm">
                  Page {page}
                  {total ? ` / ${Math.max(1, Math.ceil(total / pageSize))}` : ""}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
