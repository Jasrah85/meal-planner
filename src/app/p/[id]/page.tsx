export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import EditDeletePantry from "./pantry-actions";

/** Tag model object shape (when tags are stored in a table) */
type TagObj = { id: number; recipeId: number; value: string };

/** DB row from the select (tags may be string[] or TagObj[] depending on your schema) */
type RecentRecipeRow = {
  id: number;
  title: string;
  tags: unknown; // we’ll refine with type guards
};

/** Normalized recipe type for rendering */
type RecipeWithTags = {
  id: number;
  title: string;
  tags: Array<string | TagObj>;
};

/* ---------------------- runtime type guards (no any) --------------------- */

function isTagObj(x: unknown): x is TagObj {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    "recipeId" in x &&
    "value" in x &&
    typeof (x as { id: unknown }).id === "number" &&
    typeof (x as { recipeId: unknown }).recipeId === "number" &&
    typeof (x as { value: unknown }).value === "string"
  );
}

function isTagObjArray(xs: unknown): xs is TagObj[] {
  return Array.isArray(xs) && xs.every(isTagObj);
}

function isStringArray(xs: unknown): xs is string[] {
  return Array.isArray(xs) && xs.every((t) => typeof t === "string");
}

/* ----------------------------------------------------------------------- */

export default async function PantryOverview({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pantryId = Number(id);

  const pantry = await prisma.pantry.findUnique({
    where: { id: pantryId },
    select: { id: true, name: true },
  });

  if (!pantry) return notFound();

  // Light stats + recent recipes (tags may be Tag[] relation or string[])
  const itemCount: number = await prisma.item
    .count({ where: { pantryId } })
    .catch(() => 0);

  const recentRecipesRaw: RecentRecipeRow[] = await prisma.recipe
    .findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      // If your schema stores tags as a relation, this returns TagObj[];
      // If tags are string[], 'tags: true' returns string[].
      select: {
        id: true,
        title: true,
        tags: true,
      },
    })
    .then((rows) =>
      rows.map(
        (r): RecentRecipeRow => ({
          id: r.id,
          title: r.title,
          tags: (r as { tags: unknown }).tags,
        })
      )
    )
    .catch((): RecentRecipeRow[] => []);

  // Normalize tags to Array<string | TagObj>
  const recentRecipes: RecipeWithTags[] = recentRecipesRaw.map((r) => {
    let tags: Array<string | TagObj> = [];
    if (isStringArray(r.tags)) {
      tags = r.tags;
    } else if (isTagObjArray(r.tags)) {
      tags = r.tags;
    }
    return { id: r.id, title: r.title, tags };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{pantry.name}</h1>
          <div className="text-xs text-gray-500">Pantry ID: {pantry.id}</div>
        </div>
        <EditDeletePantry pantryId={pantry.id} pantryName={pantry.name} />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Items</div>
          <div className="text-2xl font-semibold">{itemCount}</div>
          <Link className="mt-2 inline-block underline text-sm" href={`/p/${pantry.id}/items`}>
            View items
          </Link>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600">Saved Recipes</div>
          <div className="text-2xl font-semibold">Browse</div>
          <Link className="mt-2 inline-block underline text-sm" href={`/p/${pantry.id}/saved`}>
            Open saved for this pantry
          </Link>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600">Quick Actions</div>
          <div className="mt-2 flex gap-2">
            <Link className="underline text-sm" href={`/p/${pantry.id}/scan`}>Scan</Link>
            <Link className="underline text-sm" href={`/recipes`}>All Recipes</Link>
          </div>
        </Card>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recently Updated Recipes</h2>
          <Link className="underline text-sm" href={`/p/${pantry.id}/saved`}>Filter & sort saved</Link>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentRecipes.map((r) => (
            <li key={r.id} className="rounded-lg border p-4 flex flex-col gap-2">
              <div className="font-medium line-clamp-2">{r.title}</div>

              {r.tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {r.tags.slice(0, 5).map((t, i) => {
                    const label = typeof t === "string" ? t : t.value;
                    return (
                      <span
                        key={`${r.id}-tag-${i}`}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]"
                      >
                        {label}
                      </span>
                    );
                  })}
                  {r.tags.length > 5 && (
                    <span className="text-[11px] text-gray-500">+{r.tags.length - 5} more</span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-400">No tags</div>
              )}

              <div className="mt-1 flex gap-2">
                <Link className="underline text-sm" href={`/recipes/${r.id}`}>Open</Link>
              </div>
            </li>
          ))}

          {!recentRecipes.length && (
            <li className="rounded-lg border p-4 text-sm text-gray-500">
              No recipes yet — import or create one.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
