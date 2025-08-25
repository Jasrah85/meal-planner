// src/app/shopping/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/db";
import Link from "next/link";
import { Suspense } from "react";

/** ===== Types shared between server & client ===== */
type PantryLite = { id: number; name: string };
type RecipeLite = { id: number; title: string; tags?: string[] | null };

async function getInitialData(): Promise<{
  pantries: PantryLite[];
  recipes: RecipeLite[];
}> {
  // Keep parity with your demo user pattern on the root page.
  const demo = await prisma.user.upsert({
    where: { email: "demo@pantry.local" },
    update: {},
    create: { email: "demo@pantry.local", name: "Demo User" },
  });

  const pantries = await prisma.pantry.findMany({
    where: { userId: demo.id },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  // Keep this light; tags may be string[] depending on your schema.
  const recipes = await prisma.recipe.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, tags: true }, // if tags are a relation in your schema, swap to a safe field
  });

  return {
    pantries,
    recipes: recipes.map((r) => ({
      id: r.id,
      title: r.title,
      // best effort: coerce tags to string[] | null if present
      tags:
        Array.isArray((r as unknown as { tags?: unknown }).tags) &&
        ((r as unknown as { tags?: unknown[] }).tags ?? []).every(
          (t) => typeof t === "string"
        )
          ? ((r as unknown as { tags?: string[] }).tags ?? [])
          : null,
    })),
  };
}

export default async function ShoppingPage() {
  const data = await getInitialData();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shopping List</h1>
        <nav className="text-sm flex items-center gap-3">
          <Link className="underline" href="/">
            Dashboard
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">Shopping</span>
        </nav>
      </header>

      <Suspense fallback={<div>Loading…</div>}>
        <ClientShopping
          pantries={data.pantries}
          recipes={data.recipes}
        />
      </Suspense>
    </div>
  );
}

/** ================== Client Component ================== */
"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** API result types */
type MatchCounts = { matched: number; missing: number; total: number };
type MatchResult = {
  coverage: number; // 0..1
  matched: string[];
  missing: string[];
  counts: MatchCounts;
};
type MatchEnvelope = { result: MatchResult };

type ClientProps = {
  pantries: PantryLite[];
  recipes: RecipeLite[];
};

type MissingRow = {
  name: string;
  count: number; // how many selected recipes need it
  recipes: number[]; // recipe IDs that need it
};

export function ClientShopping({ pantries, recipes }: ClientProps) {
  // ---- selection state ----
  const [pantryId, setPantryId] = useState<number>(
    pantries[0]?.id ?? 0
  );
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>(
    []
  );
  const [tagFilter, setTagFilter] = useState<string>(""); // simple contains filter
  const [search, setSearch] = useState<string>("");

  // ---- results state ----
  const [isBuilding, setIsBuilding] = useState(false);
  const [missing, setMissing] = useState<MissingRow[]>([]);
  const [lastCoverage, setLastCoverage] = useState<
    Array<{ recipeId: number; coverage: number }>
  >([]);

  // ---- derived recipe list with filters ----
  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tagQ = tagFilter.trim().toLowerCase();

    return recipes.filter((r) => {
      const titleOk = q ? r.title.toLowerCase().includes(q) : true;

      let tagOk = true;
      if (tagQ) {
        const tags = r.tags ?? [];
        tagOk = tags.some((t) => t.toLowerCase().includes(tagQ));
      }
      return titleOk && tagOk;
    });
  }, [recipes, search, tagFilter]);

  // ---- helpers ----
  function toggleRecipe(id: number) {
    setSelectedRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  }

  function setAllVisible(selectAll: boolean) {
    const ids = filteredRecipes.map((r) => r.id);
    setSelectedRecipeIds(selectAll ? ids : []);
  }

  async function buildList() {
    if (!pantryId || selectedRecipeIds.length === 0) {
      alert("Pick a pantry and at least one recipe.");
      return;
    }
    setIsBuilding(true);
    try {
      // call /api/match for each selected recipe
      const results: Array<{ recipeId: number; result: MatchResult }> =
        [];
      for (const rid of selectedRecipeIds) {
        const res = await fetch(
          `/api/match?pantryId=${encodeURIComponent(
            pantryId
          )}&recipeId=${encodeURIComponent(rid)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`Match failed for recipe ${rid}`);
        }
        const json = (await res.json()) as MatchEnvelope;
        results.push({ recipeId: rid, result: json.result });
      }

      // aggregate missing
      const map = new Map<string, MissingRow>();
      results.forEach(({ recipeId: rid, result }) => {
        result.missing.forEach((name) => {
          const key = name.trim().toLowerCase();
          const existing = map.get(key);
          if (existing) {
            existing.count += 1;
            existing.recipes.push(rid);
          } else {
            map.set(key, { name, count: 1, recipes: [rid] });
          }
        });
      });

      // sort alphabetically by default
      const rows = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      // store coverage per recipe for display
      const coveragePairs = results.map(({ recipeId: rid, result }) => ({
        recipeId: rid,
        coverage: result.coverage,
      }));

      setMissing(rows);
      setLastCoverage(coveragePairs);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsBuilding(false);
    }
  }

  function copyToClipboard() {
    if (missing.length === 0) return;
    const text = missing.map((m) => `• ${m.name}`).join("\n");
    navigator.clipboard
      .writeText(text)
      .then(() => alert("Copied to clipboard"))
      .catch(() => alert("Copy failed"));
  }

  // ---- UI ----
  return (
    <div className="space-y-6">
      {/* Controls */}
      <section className="rounded-lg border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Pantry</label>
            <select
              className="rounded-md border p-2 text-sm"
              value={pantryId || ""}
              onChange={(e) => setPantryId(Number(e.target.value))}
            >
              {pantries.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (ID {p.id})
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500">
              <Link className="underline" href={`/p/${pantryId || pantries[0]?.id || 0}`}>
                Open pantry
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Search recipes</label>
            <Input
              placeholder="Search by title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Filter by tag</label>
            <Input
              placeholder="e.g. chicken"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAllVisible(true)}
            disabled={filteredRecipes.length === 0}
          >
            Select all shown
          </Button>
          <Button
            variant="outline"
            onClick={() => setAllVisible(false)}
            disabled={selectedRecipeIds.length === 0}
          >
            Clear selection
          </Button>
          <Button onClick={buildList} disabled={isBuilding || !pantryId || selectedRecipeIds.length === 0}>
            {isBuilding ? "Building…" : "Build shopping list"}
          </Button>
          <Button
            variant="outline"
            onClick={copyToClipboard}
            disabled={missing.length === 0}
          >
            Copy list
          </Button>
        </div>
      </section>

      {/* Recipe chooser */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Pick recipes</h2>
          <div className="text-sm text-gray-600">
            Selected: <b>{selectedRecipeIds.length}</b>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((r) => {
            const checked = selectedRecipeIds.includes(r.id);
            const tags = r.tags ?? [];
            return (
              <li
                key={r.id}
                className={`rounded-lg border p-3 flex flex-col gap-2 ${
                  checked ? "ring-2 ring-gray-300" : ""
                }`}
              >
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggleRecipe(r.id)}
                  />
                  <span className="flex-1">
                    <div className="font-medium line-clamp-2">{r.title}</div>
                    {tags.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tags.slice(0, 5).map((t, i) => (
                          <span
                            key={`${r.id}-tag-${i}`}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]"
                          >
                            {t}
                          </span>
                        ))}
                        {tags.length > 5 && (
                          <span className="text-[11px] text-gray-500">
                            +{tags.length - 5} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No tags</div>
                    )}
                  </span>
                </label>

                <div className="flex items-center justify-between text-xs">
                  <Link className="underline" href={`/recipes/${r.id}`}>
                    Open
                  </Link>
                  {/* show last known coverage if present */}
                  {lastCoverage.find((c) => c.recipeId === r.id) ? (
                    <span className="text-gray-600">
                      Coverage:{" "}
                      <b>
                        {Math.round(
                          (lastCoverage.find((c) => c.recipeId === r.id)
                            ?.coverage ?? 0) * 100
                        )}
                        %
                      </b>
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </li>
            );
          })}
          {filteredRecipes.length === 0 && (
            <li className="rounded-lg border p-3 text-sm text-gray-500">
              No recipes match your filters.
            </li>
          )}
        </ul>
      </section>

      {/* Shopping list results */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Missing ingredients</h2>
        {missing.length === 0 ? (
          <div className="rounded-lg border p-4 text-sm text-gray-500">
            Build a list to see missing ingredients across your selected recipes.
          </div>
        ) : (
          <ul className="rounded-lg border divide-y">
            {missing.map((m) => (
              <li key={m.name} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4"
                    aria-label={`Mark ${m.name} complete`}
                  />
                  <span className="font-medium">{m.name}</span>
                </div>
                <div className="text-xs text-gray-600">
                  Needed in {m.count} recipe{m.count > 1 ? "s" : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
