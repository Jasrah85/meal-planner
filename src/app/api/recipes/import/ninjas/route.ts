export const runtime = "nodejs";

import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type NinjasPayload = {
  title: string;
  raw?: {
    ingredients?: string | null;
    instructions?: string | null;
    servings?: string | null;
  };
};

function splitIngredients(s: string | null | undefined) {
  return (s ?? "")
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((name) => ({ name, qty: null as number | null, unit: null as string | null }));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { item?: NinjasPayload };
  const item = body?.item;
  if (!item?.title) return NextResponse.json({ error: "item.title required" }, { status: 400 });

  const extTag = `ext:ninjas:${item.title.toLowerCase()}`;
  const existing = await prisma.recipe.findFirst({
    where: { tags: { some: { value: extTag } } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, existed: true });

  const created = await prisma.recipe.create({
    data: {
      title: item.title,
      sourceType: "API:NINJAS",
      steps: item.raw?.instructions ?? null,
      servings: null,
      tags: { create: [{ value: extTag }] },
      ingredients: { create: splitIngredients(item.raw?.ingredients) },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
