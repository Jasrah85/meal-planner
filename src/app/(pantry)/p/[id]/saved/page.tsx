"use client";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { use } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Input } from "@/components/ui/input";

/* ------------------------------- Types -------------------------------- */

type RecipeLite = {
  id: number;
  title: string;
  tags: string[];      // normalize to strings for filtering UI
  _match?: number;     // computed coverage for this pantry (0..1)
};

type MatchResult = {
  result?: {
    coverage: number;  // 0..1
    counts: { matched: number; missing: number; total: number };
    missing: string[];
  };
};

type SortKey = "az" | "za" | "match";

/* --------------------------- Type guards ------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" ? v : (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) ? Number(v) : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
function coerceRecipeLite(v: unknown): RecipeLite | null {
  if (!isRecord(v)) return null;
  const id = asNumber(v.id);
  const title = asString(v.title) ?? "Untitled";
  const tagsField = (v as { tags?: unknown }).tags;
  const tags = isStringArray(tagsField) ? tagsField : [];
  if (id === null) return null;
  return { id, title, tags };
}

/* ------------------------------ Fetchers ------------------------------ */

async function fetchSavedRecipes(): Promise<RecipeLite[]> {
  const candidates = ["/api/recipes?saved=true", "/api/recipes"];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data: unknown = await res.json();
      const list: unknown =
        Array.isArray(data) ? data :
        (isRecord(data) && Array.isArray((data as { recipes?: unknown }).recipes))
          ? (data as { recipes: unknown[] }).recipes
          : [];

      const normalized: RecipeLite[] = (list as unknown[]).map(coerceRecipeLite).filter((x): x is RecipeLite => x !== null);
      return normalized;
    } catch {
      // try next candidate
    }
  }
  return [];
}

async function fetchMatch(pantryId: number, recipeId: number): Promise<number> {
  try {
    const res = await fetch(`/api/match?pantryId=${pantryId}&recipeId=${recipeId}`, { cache: "no-store" });
    if (!res.ok) return 0;
    const json: MatchResult = await res.json();
    return typeof json.result?.coverage === "number" ? json.result.coverage : 0;
  } catch {
    return 0;
  }
}

/** limit concurrency so we don’t spam the API */
async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (x: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let next = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ------------------------------- Page --------------------------------- */

export default function SavedRecipesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pantryId = Number(id);

  // raw list (without matches)
  const { data: baseRecipes, isLoading, error } = useQuery({
    queryKey: ["savedRecipes"],
    queryFn: fetchSavedRecipes,
  });

  // UI state
  const [q, setQ] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("match");
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matched, setMatched] = useState<Record<number, number>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  // compute coverage for this pantry
  useEffect(() => {
    if (!baseRecipes || !Number.isFinite(pantryId)) return;
    (async () => {
      setLoadingMatches(true);
      const ids = baseRecipes.map((r) => r.id);
      const covs = await withConcurrency(ids, 6, (rid) => fetchMatch(pantryId, rid));
      const accum: Record<number, number> = {};
      ids.forEach((rid, i) => { accum[rid] = covs[i] ?? 0; });
      setMatched(accum);
      setLoadingMatches(false);
    })();
  }, [baseRecipes, pantryId]);

  // derived list (filter/search/sort)
  const filtered = useMemo(() => {
    const list = (baseRecipes ?? []).map((r) => ({ ...r, _match: matched[r.id] ?? 0 }));
    const needle = q.trim().toLowerCase();

    const byTitle = needle
      ? list.filter((r) => r.title.toLowerCase().includes(needle))
      : list;

    const byTags = tags.length
      ? byTitle.filter((r) => {
          const rt = (r.tags ?? []).map((t) => t.toLowerCase());
          return tags.every((t) => rt.includes(t.toLowerCase()));
        })
      : byTitle;

    const sorterMap: Record<SortKey, (a: RecipeLite, b: RecipeLite) => number> = {
      az: (a, b) => a.title.localeCompare(b.title),
      za: (a, b) => b.title.localeCompare(a.title),
      match: (a, b) => (b._match ?? 0) - (a._match ?? 0) || a.title.localeCompare(b.title),
    };

    return [...byTags].sort(sorterMap[sort]);
  }, [baseRecipes, matched, q, tags, sort]);

  function uniqLower(xs: string[]): string[] {
    const s = new Set<string>();
    const out: string[] = [];
    for (const x of xs) {
      const k = x.toLowerCase();
      if (!s.has(k)) { s.add(k); out.push(x); }
    }
    return out;
  }

  function addTag() {
    const val = tagDraft.trim();
    if (!val) return;
    setTags((t) => uniqLower([...t, val]));
    setTagDraft("");
    inputRef.current?.focus();
  }

  function removeTag(i: number) {
    setTags((t) => t.filter((_, idx) => idx !== i));
  }

  function onSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as SortKey;
    setSort(v);
  }

  if (isLoading) return <div>Loading saved recipes…</div>;
  if (error) return <div className="text-red-600">Failed to load recipes.</div>;

  const total = baseRecipes?.length ?? 0;
  const showing = filtered.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Saved Recipes</h1>
        <div className="text-xs text-gray-500">Pantry ID: {pantryId}</div>
      </div>

      {/* Controls */}
      <div className="rounded-lg border p-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-start">
          <div className="space-y-1">
            <label className="text-xs font-medium">Search title</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. soup" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Sort</label>
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={sort}
              onChange={onSortChange}
            >
              <option value="match">Match (high → low)</option>
              <option value="az">Name (A → Z)</option>
              <option value="za">Name (Z → A)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Tags (filter)</label>
            <div className="rounded-md border p-2">
              <div className="flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs">
                    {t}
                    <button
                      onClick={() => removeTag(i)}
                      className="rounded-full px-1 text-gray-500 hover:bg-gray-200"
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  placeholder="Add tag + Enter"
                  className="min-w-[12ch] flex-1 outline-none text-sm"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
                    if (e.key === "Backspace" && tagDraft === "" && tags.length) removeTag(tags.length - 1);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Showing {showing} of {total} saved {total === 1 ? "recipe" : "recipes"}.
          {loadingMatches ? " Calculating match…" : ""}
        </div>
      </div>

      {/* Results */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r) => {
          const pct = Math.round(100 * (r._match ?? 0));
          return (
            <li key={r.id} className="rounded-lg border p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium line-clamp-2">{r.title}</div>
                <div className="text-xs rounded-md border px-2 py-0.5">{pct}%</div>
              </div>
              {r.tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {r.tags.slice(0, 6).map((t, i) => (
                    <span key={`${r.id}-t-${i}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">
                      {t}
                    </span>
                  ))}
                  {r.tags.length > 6 && (
                    <span className="text-[11px] text-gray-500">+{r.tags.length - 6} more</span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-400">No tags</div>
              )}
              <div className="mt-1 flex gap-2">
                <Link className="text-sm underline" href={`/recipes/${r.id}`}>Open</Link>
                <Link className="text-sm underline" href={`/p/${pantryId}/items`}>Pantry</Link>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-lg border p-4 text-sm text-gray-500">
            Nothing matches your filters. Try clearing the tag filters or search.
          </li>
        )}
      </ul>
    </div>
  );
}
