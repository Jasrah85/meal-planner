export const runtime = "nodejs";

import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Provider = "MEALDB" | "API:SPOON" | "API:NINJAS";

type ClientBrowseCard = {
  key: string;
  provider: Provider;
  externalId: string;
  title: string;
  image: string | null;
  meta: string | null;      // e.g., "Category • Area"
  tags: string[];
  sourceUrl: string | null; // if available
  existsRecipeId: number | null;
  ninjasRaw?: { ingredients?: string | null; instructions?: string | null; servings?: string | null } | null;
};

function extTagFor(provider: Provider, externalId: string) {
  switch (provider) {
    case "API:SPOON":
      return `ext:spoon:${externalId}`;
    case "API:NINJAS":
      return `ext:ninjas:${externalId.toLowerCase()}`;
    case "MEALDB":
    default:
      return `ext:mealdb:${externalId}`;
  }
}

async function fetchMealDB(q: string): Promise<{ items: ClientBrowseCard[]; total: number }> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return { items: [], total: 0 };
  const json = await r.json();
  const meals: any[] = json?.meals ?? []; // API is untyped

  const items: ClientBrowseCard[] = meals.map((m) => ({
    key: `MEALDB:${m.idMeal}`,
    provider: "MEALDB",
    externalId: String(m.idMeal),
    title: String(m.strMeal || "").trim(),
    image: (m.strMealThumb && String(m.strMealThumb)) || null,
    meta: [m.strCategory || undefined, m.strArea || undefined].filter(Boolean).join(" • ") || null,
    tags: String(m.strTags || "")
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean),
    sourceUrl: m.strSource ? String(m.strSource) : null,
    existsRecipeId: null,     // filled later from DB
  }));

  return { items, total: items.length };
}

async function fetchSpoon(q: string, page: number, pageSize: number, apiKey: string | undefined)
: Promise<{ items: ClientBrowseCard[]; total: number | null }> {
  if (!apiKey) return { items: [], total: null };
  const offset = Math.max(0, (page - 1) * pageSize);
  const url = `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(q)}&addRecipeInformation=true&number=${pageSize}&offset=${offset}&apiKey=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return { items: [], total: null };
  const json = await r.json() as {
    results?: Array<{ id: number; title: string; image?: string; sourceUrl?: string }>;
    totalResults?: number;
  };

  const items: ClientBrowseCard[] = (json.results ?? []).map((res) => ({
    key: `SPOON:${String(res.id)}`,
    provider: "API:SPOON",
    externalId: String(res.id),
    title: res.title,
    image: res.image ?? null,
    meta: null,
    tags: [],
    sourceUrl: res.sourceUrl ?? null,
    existsRecipeId: null, // filled later
  }));

  return { items, total: typeof json.totalResults === "number" ? json.totalResults : null };
}

async function fetchNinjas(q: string, pageSize: number, apiKey: string | undefined)
: Promise<{ items: ClientBrowseCard[]; total: number | null }> {
  if (!apiKey) return { items: [], total: null };
  // Free tier often returns 1; support a small pageSize request if supported by API
  const url = `https://api.api-ninjas.com/v1/recipe?query=${encodeURIComponent(q)}`;
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "X-Api-Key": apiKey },
  });
  if (!r.ok) return { items: [], total: null };
  const arr = (await r.json()) as Array<{
    title?: string;
    ingredients?: string;
    servings?: string;
    instructions?: string;
  }>;

  // Slice to pageSize to avoid flooding UI
  const trimmed = arr.slice(0, Math.max(1, Math.min(pageSize, 10)));

  const items: ClientBrowseCard[] = trimmed.map((it) => {
    const title = (it.title ?? "").trim();
    const externalId = title.toLowerCase();
    return {
      key: `NINJAS:${externalId}`,
      provider: "API:NINJAS",
      externalId,
      title,
      image: null,
      meta: null,
      tags: [],
      sourceUrl: null,
      existsRecipeId: null,
      ninjasRaw: {
        ingredients: it.ingredients ?? null,
        instructions: it.instructions ?? null,
        servings: it.servings ?? null,
      },
    };
  });

  return { items, total: null };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Math.max(1, Math.min(48, Number(searchParams.get("pageSize") || "12") || 12));

  if (!q) {
    return NextResponse.json({ items: [], total: 0, page, pageSize });
  }

  const SPOON_KEY = process.env.SPOONACULAR_API_KEY;
  const NINJAS_KEY = process.env.API_NINJAS_KEY;

  // Fetch in parallel
  const [meal, spoon, ninjas] = await Promise.all([
    fetchMealDB(q),
    fetchSpoon(q, page, pageSize, SPOON_KEY),
    fetchNinjas(q, pageSize, NINJAS_KEY),
  ]);

  // Combine all items; dedupe by provider+externalId (defensive)
  const combinedMap = new Map<string, ClientBrowseCard>();
  const push = (c: ClientBrowseCard) => {
    const k = `${c.provider}:${c.externalId}`;
    if (!combinedMap.has(k)) combinedMap.set(k, c);
  };
  meal.items.forEach(push);
  spoon.items.forEach(push);
  ninjas.items.forEach(push);

  let combined = Array.from(combinedMap.values());

  // Sort: simple alpha by title
  combined.sort((a, b) => a.title.localeCompare(b.title));

  // Mark which ones already exist locally (via tag scan)
  const tagList = combined.map((c) => extTagFor(c.provider, c.externalId));
  const tagRows = tagList.length
    ? await prisma.recipeTag.findMany({
        where: { value: { in: tagList } },
        select: { value: true, recipeId: true },
      })
    : [];
  const tagToId = new Map(tagRows.map((r) => [r.value, r.recipeId]));
  combined = combined.map((c) => ({
    ...c,
    existsRecipeId: tagToId.get(extTagFor(c.provider, c.externalId)) ?? null,
  }));

  // Pagination over the combined list
  const totalApprox =
    (meal.total ?? 0) +
    (spoon.total ?? spoon.items.length) + // use API total if present
    (ninjas.total ?? ninjas.items.length);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = combined.slice(start, end);

  return NextResponse.json({
    items,
    total: totalApprox || combined.length, // fallback
    page,
    pageSize,
  });
}
