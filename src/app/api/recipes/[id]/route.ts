export const runtime = "nodejs";

import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}

type UpIngredient = { name: string; qty?: number; unit?: string; barcodeCode?: string };
type UpdateRecipePayload = {
  title?: string; sourceType?: string | null; sourceUrl?: string | null;
  servings?: number | null; notes?: string | null; steps?: string | null;
  tags?: string[]; ingredients?: UpIngredient[]; syncBarcodeLabelsFromNames?: boolean;
};

type RecipeScalars = {
  title?: string; sourceType?: string | null; sourceUrl?: string | null;
  servings?: number | null; notes?: string | null; steps?: string | null;
};

export async function GET(_: NextRequest, ctx: { params: { id: string } }) {
  const id = Number(ctx.params.id);
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      tags: true,
      ingredients: { include: { barcode: true, itemMatch: true }, orderBy: { id: "asc" } },
    },
  });
  if (!recipe) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ recipe: { ...recipe, tags: recipe.tags.map(t => t.value) } });
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  const id = Number(ctx.params.id);
  const body = (await req.json()) as UpdateRecipePayload;

  const scalar: RecipeScalars = {};
  if (typeof body.title === "string") scalar.title = body.title.trim();
  if ("sourceType" in body) scalar.sourceType = body.sourceType ?? null;
  if ("sourceUrl" in body) scalar.sourceUrl = body.sourceUrl ?? null;
  if ("servings"  in body) scalar.servings  = body.servings  ?? null;
  if ("notes"     in body) scalar.notes     = body.notes     ?? null;
  if ("steps"     in body) scalar.steps     = body.steps     ?? null;

  const replaceTags = Array.isArray(body.tags);
  const replaceIngs = Array.isArray(body.ingredients);

  const barcodeMap: Record<string, number> = {};
  if (replaceIngs) {
    for (const ing of body.ingredients!) {
      const code = ing.barcodeCode?.trim();
      if (code && !barcodeMap[code]) {
        const bc = await prisma.barcode.upsert({
          where: { code }, update: {}, create: { code }, select: { id: true },
        });
        barcodeMap[code] = bc.id;
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.recipe.update({ where: { id }, data: scalar });

    if (replaceTags) {
      await tx.recipeTag.deleteMany({ where: { recipeId: id } });
      const tags = body.tags!.map(v => v.trim()).filter(Boolean);
      if (tags.length) await tx.recipeTag.createMany({ data: tags.map(value => ({ recipeId: id, value })) });
    }

    if (replaceIngs) {
      await tx.ingredient.deleteMany({ where: { recipeId: id } });
      const clean = body.ingredients!.filter(i => !!i?.name?.trim()).map(i => ({
        recipeId: id,
        name: i.name.trim(),
        qty: typeof i.qty === "number" ? i.qty : null,
        unit: i.unit ?? null,
        barcodeId: i.barcodeCode ? barcodeMap[i.barcodeCode] ?? null : null,
      }));
      if (clean.length) await tx.ingredient.createMany({ data: clean });

      if (body.syncBarcodeLabelsFromNames) {
        for (const c of clean) if (c.barcodeId)
          await tx.barcode.update({ where: { id: c.barcodeId }, data: { label: c.name } });
      }
    }
  });

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { tags: true, ingredients: { include: { barcode: true, itemMatch: true }, orderBy: { id: "asc" } } },
  });
  return NextResponse.json({ recipe: recipe ? { ...recipe, tags: recipe.tags.map(t => t.value) } : null });
}

export async function DELETE(_: NextRequest, ctx: { params: { id: string } }) {
  const id = Number(ctx.params.id);
  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
