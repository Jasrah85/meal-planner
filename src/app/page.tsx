import prisma from "@/lib/db";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type PantryLite = { id: number; name: string };
type RecipeListRow = {
  id: number;
  title: string;
  servings: number | null;
  sourceType: string | null;
  _count?: { ingredients: number };
};

export default async function Home() {
  // Ensure demo user exists
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

  // Latest recipes
  const recipes: RecipeListRow[] = await prisma.recipe.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      servings: true,
      sourceType: true,
      _count: { select: { ingredients: true } },
    },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Pantry Planner</h1>
        <p className="text-sm text-gray-600">Manage pantries, scan items, and plan meals from your inventory.</p>
      </section>

      {/* Pantries */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Your Pantries</h2>
          <Link href="/settings" className="underline text-sm">Manage pantries</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pantries.map((p: PantryLite) => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">ID: {p.id}</div>
              </div>
              <div className="flex gap-2">
                <Link className="underline text-sm" href={`/p/${p.id}`}>Overview</Link>
                <Link className="underline text-sm" href={`/p/${p.id}/items`}>Items</Link>
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

      {/* Recipes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Recipes</h2>
          <div className="flex items-center gap-3">
            <Link href="/recipes" className="underline text-sm">All recipes</Link>
            <Link href="/recipes/new" className="underline text-sm">New recipe</Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <Card key={r.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-gray-500">
                  {r._count?.ingredients ?? 0} ingredients{r.sourceType ? ` • ${r.sourceType}` : ""}
                </div>
              </div>
              <Link className="underline text-sm" href={`/recipes/${r.id}`}>Open</Link>
            </Card>
          ))}
          {recipes.length === 0 && (
            <Card className="p-4">
              <div className="text-sm">
                No recipes yet. Try{" "}
                <a
                  className="underline"
                  href={`/api/recipes/import/themealdb?q=chicken&limit=3&import=true`}
                >
                  importing a few
                </a>{" "}
                or <Link className="underline" href="/recipes/new">create one</Link>.
              </div>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
