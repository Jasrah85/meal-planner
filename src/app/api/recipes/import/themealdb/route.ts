import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}

/** Minimal MealDB typings */
type MealDBMeal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strTags: string | null; // comma-separated
  strSource: string | null;
  [k: `strIngredient${number}`]: string | null | undefined;
  [k: `strMeasure${number}`]: string | null | undefined;
};

// parse a measurement like "1 1/2 cup" → qty 1.5, unit "cup"
function parseMeasure(measure?: string): { qty: number | null; unit: string | null } {
  if (!measure) return { qty: null, unit: null };
  const m = measure.trim();
  const frac = /^(\d+)\s+(\d+)\/(\d+)\b/i.exec(m);
  const simpleFrac = /^(\d+)\/(\d+)\b/i.exec(m);
  const decimal = /^(\d+(?:\.\d+)?)\b/i.exec(m);

  if (frac) return { qty: parseInt(frac[1]) + parseInt(frac[2]) / parseInt(frac[3]), unit: m.slice(frac[0].length).trim() || null };
  if (simpleFrac) return { qty: parseInt(simpleFrac[1]) / parseInt(simpleFrac[2]), unit: m.slice(simpleFrac[0].length).trim() || null };
  if (decimal) return { qty: parseFloat(decimal[1]), unit: m.slice(decimal[0].length).trim() || null };
  return { qty: null, unit: m }; // fallback: keep entire measure as unit
}

function pickIngredients(meal: MealDBMeal) {
  const ings: { name: string; qty: number | null; unit: string | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (!name) continue;
    const { qty, unit } = parseMeasure(measure || undefined);
    ings.push({ name, qty, unit });
  }
  return ings;
}

/**
 * POST /api/recipes/import/themealdb
 * body: { idMeal: string }
 * - Imports a single recipe by id (no auto-import on GET anymore)
 * - If already imported, returns the existing one
 */
export async function POST(req: NextRequest) {
  const { idMeal } = (await req.json().catch(() => ({}))) as { idMeal?: string };
  if (!idMeal) return NextResponse.json({ error: "idMeal required" }, { status: 400 });

  const extTag = `ext:mealdb:${idMeal}`;

  // already imported?
  const existingTag = await prisma.recipeTag.findFirst({ where: { value: extTag } });
  if (existingTag) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: existingTag.recipeId },
      include: { tags: true, ingredients: { include: { barcode: true, itemMatch: true }, orderBy: { id: "asc" } } },
    });
    return NextResponse.json({ recipe: recipe ? { ...recipe, tags: recipe.tags.map(t => t.value) } : null });
  }

  // lookup details
  const r = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(idMeal)}`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: `lookup failed ${r.status}` }, { status: 502 });
  const data = (await r.json()) as { meals?: MealDBMeal[] };
  const meal = data?.meals?.[0];
  if (!meal) return NextResponse.json({ error: "not found" }, { status: 404 });

  const title = String(meal.strMeal ?? "").trim() || "Untitled";
  const sourceUrl = meal.strSource || null;
  const category = meal.strCategory?.trim() || null;
  const area = meal.strArea?.trim() || null;
  const tags = (meal.strTags ? meal.strTags.split(",").map(s => s.trim()).filter(Boolean) : []) as string[];
  const ings = pickIngredients(meal);

  const created = await prisma.recipe.create({
    data: {
      title,
      sourceType: "API:MEALDB",
      sourceUrl,
      tags: {
        createMany: {
          data: [
            { value: extTag },
            ...(category ? [{ value: `category:${category}` }] : []),
            ...(area ? [{ value: `area:${area}` }] : []),
            ...tags.map(v => ({ value: v })),
          ],
        },
      },
      ingredients: { createMany: { data: ings.map(i => ({ name: i.name, qty: i.qty, unit: i.unit })) } },
    },
    include: { tags: true, ingredients: true },
  });

  return NextResponse.json({ recipe: { ...created, tags: created.tags.map(t => t.value) } });
}

/**
 * DELETE /api/recipes/import/themealdb?idMeal=xxxxx
 * - Removes the imported recipe that corresponds to this external id
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idMeal = searchParams.get("idMeal");
  if (!idMeal) return NextResponse.json({ error: "idMeal required" }, { status: 400 });

  const extTag = `ext:mealdb:${idMeal}`;
  const tag = await prisma.recipeTag.findFirst({ where: { value: extTag } });
  if (!tag) return NextResponse.json({ ok: true, deleted: 0 });

  await prisma.recipe.delete({ where: { id: tag.recipeId } });
  return NextResponse.json({ ok: true, deleted: 1 });
}

/**
 * (Optional preview) GET ?id=xxxxx
 * - Returns a normalized preview without saving
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Provide ?id=mealId" }, { status: 400 });

  const r = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: `lookup failed ${r.status}` }, { status: 502 });
  const data = (await r.json()) as { meals?: MealDBMeal[] };
  const meal = data?.meals?.[0];
  if (!meal) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    preview: {
      idMeal: meal.idMeal,
      title: meal.strMeal,
      sourceType: "API:MEALDB",
      sourceUrl: meal.strSource || null,
      tags: (meal.strTags ? meal.strTags.split(",").map(s => s.trim()).filter(Boolean) : []),
      ingredients: pickIngredients(meal),
    },
  });
}
