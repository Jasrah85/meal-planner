// app/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/db";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import RecipeTeaserGrid from "@/components/RecipeTeaserGrid";

type PantryLite = { id: number; name: string };

async function getInitialTeasers(limit = 12) {
  // Same two-step on the server for first paint (SSR)
  const rows: Array<{ id: number }> = await prisma.$queryRaw`
    SELECT r.id
    FROM "Recipe" r
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  const ids = rows.map(r => r.id);
  if (ids.length === 0) return [];

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

  const byId = new Map(recipes.map(r => [r.id, r]));
  return ids.map(id => byId.get(id)).filter(Boolean) as typeof recipes;
}

export default async function Home() {
  // Ensure demo user exists (unchanged)
  const demo = await prisma.user.upsert({
    where: { email: "demo@pantry.local" },
    update: {},
    create: { email: "demo@pantry.local", name: "Demo User" },
  });

  // Pantries (unchanged)
  const pantries: PantryLite[] = await prisma.pantry.findMany({
    where: { userId: demo.id },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  // NEW: initial random teasers (SSR)
  const initialTeasers = await getInitialTeasers(12);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Pantry Planner</h1>
          <div className="flex gap-2">{/* future quick actions */}</div>
        </div>
      </section>

      {/* Pantries (unchanged) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Your Pantries</h2>
          <Link href="/settings" className="underline text-sm">Manage pantries</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pantries.map((p) => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">ID: {p.id}</div>
              </div>
              <div className="flex gap-2">
                <Link className="underline text-sm" href={`/p/${p.id}`}>Overview</Link>
                <Link className="underline text-sm" href={`/p/${p.id}/items`}>Items</Link>
                <Link className="underline text-sm" href={`/p/${p.id}/saved`}>Saved</Link>
                <Link className="underline text-sm" href={`/p/${p.id}/scan`}>Scan</Link>
              </div>
            </Card>
          ))}
          {pantries.length === 0 && (
            <Card className="p-4">
              <div className="text-sm">
                No pantries yet. Go to <Link className="underline" href="/settings">Settings</Link> to add one.
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Recipes (updated) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Recipes</h2>
          <div className="flex items-center gap-3">
            <Link href="/recipes" className="underline text-sm">All recipes</Link>
            <Link href="/recipes/new" className="underline text-sm">New recipe</Link>
          </div>
        </div>

        <RecipeTeaserGrid initial={initialTeasers} />
      </section>
    </div>
  );
}
