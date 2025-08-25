export const runtime = "nodejs";

import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type SpoonInfo = {
  id: number;
  title: string;
  sourceUrl?: string | null;
  servings?: number | null;
  extendedIngredients?: Array<{ name?: string | null }>;
  analyzedInstructions?: Array<{ steps?: Array<{ step?: string | null }> }>;
  instructions?: string | null;
};

export async function POST(req: NextRequest) {
  const { id } = (await req.json()) as { id?: number | string };
  const rid = Number(id);
  if (!Number.isFinite(rid)) return NextResponse.json({ error: "id required (number)" }, { status: 400 });

  const key = process.env.SPOONACULAR_API_KEY ?? "";
  const url = new URL(`https://api.spoonacular.com/recipes/${rid}/information`);
  url.searchParams.set("includeNutrition", "false");
  url.searchParams.set("apiKey", key);

  const resp = await fetch(url.toString(), { cache: "no-store" });
  if (!resp.ok) return NextResponse.json({ error: `spoonacular ${resp.status}` }, { status: 502 });
  const info = (await resp.json()) as SpoonInfo;

  const extTag = `ext:spoon:${info.id}`;
  const existing = await prisma.recipe.findFirst({
    where: { tags: { some: { value: extTag } } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, existed: true });

  const steps =
    info.analyzedInstructions?.[0]?.steps
      ?.map((s) => s.step)
      .filter((s): s is string => Boolean(s && s.trim()))
      .join("\n") || info.instructions || null;

  const ingredients =
    (info.extendedIngredients ?? []).map((ing) => ({
      name: (ing.name ?? "ingredient").trim(),
      qty: null as number | null,
      unit: null as string | null,
    })) ?? [];

  const created = await prisma.recipe.create({
    data: {
      title: info.title,
      sourceType: "API:SPOON",
      sourceUrl: info.sourceUrl ?? null,
      servings: info.servings ?? null,
      steps,
      tags: { create: [{ value: extTag }] },
      ingredients: { create: ingredients },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
