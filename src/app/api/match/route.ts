import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// simple name normalization
function norm(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatches(ingName: string, itemNames: string[]) {
  const n = norm(ingName);
  if (!n) return false;
  for (const cand of itemNames) {
    const m = norm(cand);
    if (!m) continue;
    // exact or substring either way
    if (m === n || m.includes(n) || n.includes(m)) return true;
  }
  return false;
}

/**
 * GET /api/match?pantryId=1&recipeId=123
 *   -> returns match result for a single recipe
 *
 * GET /api/match?pantryId=1&limit=20&minCoverage=0.2
 *   -> ranks all recipes by coverage (matched / ingredients)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pantryId = Number(searchParams.get("pantryId") || "");
  const recipeId = searchParams.get("recipeId") ? Number(searchParams.get("recipeId")) : null;
  const limit = Number(searchParams.get("limit") || "20");
  const minCoverage = Number(searchParams.get("minCoverage") || "0");

  if (!Number.isFinite(pantryId) || pantryId <= 0) {
    return NextResponse.json({ error: "pantryId required" }, { status: 400 });
  }

  // Load pantry items + barcode labels
  const items = await prisma.item.findMany({
    where: { pantryId },
    include: { barcode: true },
  });

  const itemNameBank = items.flatMap((it) => {
    const names = [it.name];
    if (it.barcode?.label) names.push(it.barcode.label);
    return names;
  });

  // helper to score a single recipe object
  const scoreRecipe = (recipe: {
    id: number;
    title: string;
    ingredients: { name: string }[];
  }) => {
    const ingNames = recipe.ingredients.map((i) => i.name);
    const matched: string[] = [];
    const missing: string[] = [];

    for (const ing of ingNames) {
      if (nameMatches(ing, itemNameBank)) matched.push(ing);
      else missing.push(ing);
    }

    const total = ingNames.length || 1;
    const coverage = matched.length / total;

    return {
      recipeId: recipe.id,
      title: recipe.title,
      coverage,
      matched,
      missing,
      counts: { matched: matched.length, missing: missing.length, total },
    };
  };

  if (recipeId) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, title: true, ingredients: { select: { name: true } } },
    });
    if (!recipe) return NextResponse.json({ error: "recipe not found" }, { status: 404 });
    return NextResponse.json({ pantryId, result: scoreRecipe(recipe) });
  }

  // rank all recipes
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      ingredients: { select: { name: true } },
    },
  });

  const results = recipes.map(scoreRecipe).filter((r) => r.coverage >= minCoverage);
  results.sort((a, b) => b.coverage - a.coverage || a.counts.total - b.counts.total);

  return NextResponse.json({
    pantryId,
    count: results.length,
    results: limit ? results.slice(0, Math.max(1, limit)) : results,
  });
}
