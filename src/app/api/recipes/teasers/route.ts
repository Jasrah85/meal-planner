// app/api/recipes/teasers/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 24);

  const excludeParam = searchParams.get("exclude");
  const excludeIds = (excludeParam ? excludeParam.split(",") : [])
    .map((x) => Number(x))
    .filter(Boolean);

  // Optional WHERE clause
  const where =
    excludeIds.length > 0
      ? Prisma.sql`WHERE r.id NOT IN (${Prisma.join(excludeIds)})`
      : Prisma.empty;

  // 1) Get random IDs
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT r.id
    FROM "Recipe" r
    ${where}
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ recipes: [] });
  }

  // 2) Pull fields with Prisma
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      servings: true,
      sourceType: true,
      _count: { select: { ingredients: true } },
    },
  });

  // Keep the original random order
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json({ recipes: ordered });
}
