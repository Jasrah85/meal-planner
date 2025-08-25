export const runtime = "nodejs";

import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type BrowseCard = {
  idMeal: string;
  title: string;
  thumb: string | null;
  area: string | null;
  category: string | null;
  tags: string[];
  existsRecipeId: number | null;
};

function paginate<T>(arr: T[], page: number, pageSize: number) {
  const total = arr.length;
  const start = (page - 1) * pageSize;
  return { total, items: arr.slice(start, start + pageSize) };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(24, Math.max(1, Number(searchParams.get("pageSize") || 12)));

  const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: `search failed ${r.status}` }, { status: 502 });
  const data = await r.json().catch(() => ({}));
  const meals: any[] = data?.meals || [];

  // map MealDB ids to our ext tags to see which are imported
  const extValues = meals.map(m => `ext:mealdb:${m.idMeal}`);
  const existing = await prisma.recipeTag.findMany({
    where: { value: { in: extValues } },
    select: { value: true, recipeId: true },
  });
  const tagToId = new Map(existing.map(t => [t.value, t.recipeId]));

  const normalized: BrowseCard[] = meals.map(m => ({
    idMeal: String(m.idMeal),
    title: String(m.strMeal ?? "").trim(),
    thumb: m.strMealThumb || null,
    area: m.strArea || null,
    category: m.strCategory || null,
    tags: (m.strTags ? String(m.strTags).split(",").map((s: string) => s.trim()).filter(Boolean) : []),
    existsRecipeId: tagToId.get(`ext:mealdb:${m.idMeal}`) ?? null,
  }));

  const { total, items } = paginate(normalized, page, pageSize);
  return NextResponse.json({ total, page, pageSize, results: items });
}
