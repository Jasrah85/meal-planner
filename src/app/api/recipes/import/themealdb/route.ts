import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// naive parser: try to split a measurement like "1 1/2 cup" -> qty 1.5, unit "cup"
function parseMeasure(measure?: string): { qty: number | null; unit: string | null } {
  if (!measure) return { qty: null, unit: null };
  const m = measure.trim();
  // match mixed fractions "1 1/2", simple "1/2", or decimal "0.5"
  const frac = /^(\d+)\s+(\d+)\/(\d+)\b/i.exec(m);
  const simpleFrac = /^(\d+)\/(\d+)\b/i.exec(m);
  const decimal = /^(\d+(?:\.\d+)?)\b/i.exec(m);

  if (frac) {
    const qty = parseInt(frac[1]) + parseInt(frac[2]) / parseInt(frac[3]);
    return { qty, unit: m.slice(frac[0].length).trim() || null };
  }
  if (simpleFrac) {
    const qty = parseInt(simpleFrac[1]) / parseInt(simpleFrac[2]);
    return { qty, unit: m.slice(simpleFrac[0].length).trim() || null };
  }
  if (decimal) {
    const qty = parseFloat(decimal[1]);
    return { qty, unit: m.slice(decimal[0].length).trim() || null };
  }
  return { qty: null, unit: m }; // fallback: keep entire measure as unit
}

type MealDBMeal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strTags: string | null;             // comma-separated
  strSource: string | null;
  // strMeasure1..20 / strIngredient1..20
  [k: `strIngredient${number}`]: string | null | undefined;
  [k: `strMeasure${number}`]: string | null | undefined;
};

function pickIngredients(m: MealDBMeal) {
  const ings: { name: string; qty: number | null; unit: string | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || "").trim();
    const measure = (m[`strMeasure${i}`] || "").trim();
    if (!name) continue;
    const { qty, unit } = parseMeasure(measure || undefined);
    ings.push({ name, qty, unit });
  }
  return ings;
}

/**
 * GET /api/recipes/import/themealdb?q=chicken&limit=5&import=true
 *   q: search string (uses TheMealDB search)
 *   limit: optional cap
 *   import: if "true" persist to DB; otherwise just preview JSON
 *
 * GET /api/recipes/import/themealdb?id=52771&import=true
 *   id: import a single recipe by idMeal
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const id = searchParams.get("id")?.trim();
  const limit = Number(searchParams.get("limit") || "0") || undefined;
  const doImport = searchParams.get("import") === "true";

  let url: string;
  if (id) {
    url = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`;
  } else if (q) {
    url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
  } else {
    return NextResponse.json({ error: "Provide ?q=search or ?id=mealId" }, { status: 400 });
  }

  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) return NextResponse.json({ error: `fetch failed ${resp.status}` }, { status: 502 });
  const json = await resp.json();
  const meals: MealDBMeal[] = json?.meals ?? [];

  const trimmed = typeof limit === "number" ? meals.slice(0, limit) : meals;

  // Build normalized recipe shapes
  const normalized = trimmed.map((m) => {
    const tags = (m.strTags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    return {
      externalId: m.idMeal,
      title: m.strMeal,
      sourceType: "API:MEALDB",
      sourceUrl: m.strSource || null,
      servings: null as number | null,
      notes: null as string | null,
      steps: m.strInstructions || null,
      tags,
      ingredients: pickIngredients(m),
    };
  });

  if (!doImport) {
    return NextResponse.json({ preview: normalized, count: normalized.length });
  }

  // Persist to DB (basic de-dupe: title + sourceUrl)
  const createdIds: number[] = [];
  for (const r of normalized) {
    const existing = await prisma.recipe.findFirst({
      where: {
        title: r.title,
        OR: [{ sourceUrl: r.sourceUrl }, { sourceUrl: null }],
      },
      select: { id: true },
    });

    if (existing) {
      // replace tags/ingredients on existing
      await prisma.recipe.update({
        where: { id: existing.id },
        data: {
          sourceType: r.sourceType,
          steps: r.steps,
          tags: {
            deleteMany: {},
            create: r.tags.map((value) => ({ value })),
          },
          ingredients: {
            deleteMany: {},
            create: r.ingredients.map((ing) => ({
              name: ing.name,
              qty: ing.qty,
              unit: ing.unit,
            })),
          },
        },
      });
      createdIds.push(existing.id);
    } else {
      const rec = await prisma.recipe.create({
        data: {
          title: r.title,
          sourceType: r.sourceType,
          sourceUrl: r.sourceUrl,
          servings: r.servings,
          notes: r.notes,
          steps: r.steps,
          tags: { create: r.tags.map((value) => ({ value })) },
          ingredients: {
            create: r.ingredients.map((ing) => ({
              name: ing.name,
              qty: ing.qty,
              unit: ing.unit,
            })),
          },
        },
        select: { id: true },
      });
      createdIds.push(rec.id);
    }
  }

  return NextResponse.json({ ok: true, imported: createdIds.length, ids: createdIds });
}
