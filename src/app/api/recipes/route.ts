import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}

type NewIngredient = {
  name: string;
  qty?: number;
  unit?: string;
  barcodeCode?: string; // optional: if provided, we'll upsert Barcode and link it
};

type NewRecipePayload = {
  title: string;
  sourceType?: string;
  sourceUrl?: string;
  servings?: number;
  notes?: string;
  steps?: string;
  tags?: string[];
  ingredients?: NewIngredient[];
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("query")?.trim();
  const tag = searchParams.get("tag")?.trim();

  const where: any = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { tags: { some: { value: { contains: q, mode: "insensitive" } } } },
      { ingredients: { some: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (tag) {
    where.tags = { some: { value: { equals: tag, mode: "insensitive" } } };
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
    recipes: recipes.map((r) => ({
      ...r,
      tags: r.tags.map((t) => t.value),
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as NewRecipePayload;
  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const tags = (body.tags ?? []).filter(Boolean).map((v) => v.trim()).filter(Boolean);
  const ingredients = (body.ingredients ?? []).filter((ing) => !!ing?.name?.trim());

  // Prepare barcode upserts (if any) so we can link ids
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
      tags: {
        create: tags.map((value) => ({ value })),
      },
      ingredients: {
        create: ingredients.map((ing) => ({
          name: ing.name.trim(),
          qty: typeof ing.qty === "number" ? ing.qty : null,
          unit: ing.unit ?? null,
          barcodeId: ing.barcodeCode ? barcodeMap[ing.barcodeCode] ?? null : null,
        })),
      },
    },
    include: {
      tags: true,
      ingredients: { include: { barcode: true } },
    },
  });

  return NextResponse.json({
    recipe: {
      ...recipe,
      tags: recipe.tags.map((t) => t.value),
    },
  }, { status: 201 });
}
