// app/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/db";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import RecipeTeaserGrid from "@/components/RecipeTeaserGrid";

type PantryLite = { id: number; name: string };

type RecipeTeaser = {
  id: number;
  title: string;
  servings: number | null;
  sourceType: string | null;
  _count?: { ingredients: number };
};

async function getInitialTeasers(limit = 12): Promise<RecipeTeaser[]> {
  // 1) Pick random IDs from your local Recipe table (Postgres)
  const rows: Array<{ id: number }> = await prisma.$queryRaw`
    SELECT r.id
    FROM "Recipe" r
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  // 2) Fetch fields via Prisma and preserve the random order
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      servings: true,
      sourceType: true,
      _count: { select: { ingredients: true } },
    },
  });

  const byId = new Map(recipes.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as RecipeTeaser[];
}

export default async function Home() {
  // Ensure demo user exists  ✅ remove "as any"
  const demo = await prisma.user.upsert({
    where: { email: "demo@pantry.local" },
    update: {},
    create: { email: "demo@pantry.local", name: "Demo User" },
  });

  // Pantries for demo user
  const pantries: PantryLite[] = await prisma.pantry.findMany({
    where: { userId: demo.id },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  // Initial teaser batch for SSR
  const initialTeasers = await getInitialTeasers(12);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Pantry Planner</h1>
            <p className="text-sm text-gray-500">
              Quick picks from your saved recipes. Shuffle or load more anytime.
            </p>
          </div>
          <div className="flex gap-2">{/* future quick actions */}</div>
        </div>
      </section>

      {/* Pantries */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Your Pantries</h2>
          <Link href="/settings" className="underline text-sm">
            Manage pantries
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pantries.map((p) => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">ID: {p.id}</div>
              </div>
              <div className="flex gap-2">
                <Link className="underline text-sm" href={`/p/${p.id}`}>
                  Overview
                </Link>
                <Link className="underline text-sm" href={`/p/${p.id}/items`}>
                  Items
                </Link>
                <Link className="underline text-sm" href={`/p/${p.id}/saved`}>
                  Saved
                </Link>
                <Link className="underline text-sm" href={`/p/${p.id}/scan`}>
                  Scan
                </Link>
              </div>
            </Card>
          ))}

          {pantries.length === 0 && (
            <Card className="p-4">
              <div className="text-sm">
                No pantries yet. Go to{" "}
                <Link className="underline" href="/settings">
                  Settings
                </Link>{" "}
                to add one.
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Recipes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Recipes</h2>
          <div className="flex items-center gap-3">
            <Link href="/recipes" className="underline text-sm">
              All recipes
            </Link>
            <Link href="/recipes/new" className="underline text-sm">
              New recipe
            </Link>
          </div>
        </div>

        {/* Client grid with Shuffle / Load more (uses /api/recipes/teasers) */}
        <RecipeTeaserGrid initial={initialTeasers} />
      </section>
    </div>
  );
}
