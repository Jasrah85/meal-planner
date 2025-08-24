export const runtime = "nodejs";

import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}

type NewIngredient = { name: string; qty?: number; unit?: string; barcodeCode?: string };
type NewRecipePayload = {
  title: string; sourceType?: string; sourceUrl?: string;
  servings?: number; notes?: string; steps?: string;
  tags?: string[]; ingredients?: NewIngredient[];
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("query")?.trim();
  const tag = searchParams.get("tag")?.trim();

  const where: Prisma.RecipeWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { tags: { some: { value: { contains: q } } } },
      { ingredients: { some: { name: { contains: q } } } },
    ];
  }
  if (tag) {
    where.tags = { some: { value: { equals: tag } } };
  }

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      servings: true,
      sourceType: true,
      sourceUrl: true,
      tags: { select: { value: true } },
      _count: { select: { ingredients: true } },
    },
  });

  return NextResponse.json({
    recipes: recipes.map((r) => ({ ...r, tags: r.tags.map((t) => t.value) })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as NewRecipePayload;
  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const tags = (body.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const ingredients = (body.ingredients ?? []).filter((i) => !!i?.name?.trim());

  const barcodeMap: Record<string, number> = {};
  for (const ing of ingredients) {
    const code = ing.barcodeCode?.trim();
    if (code && !barcodeMap[code]) {
      const bc = await prisma.barcode.upsert({
        where: { code },
        update: {},
        create: { code },
        select: { id: true },
      });
      barcodeMap[code] = bc.id;
    }
  }

  const recipe = await prisma.recipe.create({
    data: {
      title,
      sourceType: body.sourceType ?? null,
      sourceUrl: body.sourceUrl ?? null,
      servings: typeof body.servings === "number" ? body.servings : null,
      notes: body.notes ?? null,
      steps: body.steps ?? null,
      tags: { create: tags.map((value) => ({ value })) },
      ingredients: {
        create: ingredients.map((ing) => ({
          name: ing.name.trim(),
          qty: typeof ing.qty === "number" ? ing.qty : null,
          unit: ing.unit ?? null,
          barcodeId: ing.barcodeCode ? barcodeMap[ing.barcodeCode] ?? null : null,
        })),
      },
    },
    include: { tags: true },
  });

  return NextResponse.json(
    { recipe: { ...recipe, tags: recipe.tags.map((t) => t.value) } },
    { status: 201 }
  );
}
