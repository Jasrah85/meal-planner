// src/app/api/recipes/browse/route.ts
export const runtime = "nodejs";

import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/* ----------------------------- Types ----------------------------- */
type Provider = "MEALDB" | "API:SPOON" | "API:NINJAS";

type ClientBrowseCard = {
  key: string;
  provider: Provider;
  externalId: string;
  title: string;
  image: string | null;
  meta: string | null;             // e.g., "Category • Area"
  tags: string[];
  sourceUrl: string | null;        // if available
  existsRecipeId: number | null;
  ninjasRaw?:
    | { ingredients?: string | null; instructions?: string | null; servings?: string | null }
    | null;
};

type MealDBMeal = {
  idMeal: string;
  strMeal: string | null;
  strMealThumb: string | null;
  strCategory: string | null;
  strArea: string | null;
  strTags: string | null;
  strSource: string | null;
};

/* --------------------------- Helpers ---------------------------- */
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

async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store", ...init });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/* ----------------------- External fetchers ---------------------- */
async function fetchMealDB(q: string): Promise<{ items: ClientBrowseCard[]; total: number }> {
  const json = await safeFetchJson<{ meals?: MealDBMeal[] | null }>(
    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`
  );
  const meals: MealDBMeal[] = Array.isArray(json?.meals) ? json!.meals! : [];

  const items: ClientBrowseCard[] = meals.map((m) => {
    const title = (m.strMeal ?? "").trim();
    const image = m.strMealThumb ? String(m.strMealThumb) : null;
    const meta =
      [m.strCategory ?? undefined, m.strArea ?? undefined].filter(Boolean).join(" • ") || null;
    const tagStr = (m.strTags ?? "").trim();
    const tags = tagStr ? tagStr.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const sourceUrl = m.strSource ? String(m.strSource) : null;

    return {
      key: `MEALDB:${m.idMeal}`,
      provider: "MEALDB",
      externalId: m.idMeal,
      title,
      image,
      meta,
      tags,
      sourceUrl,
      existsRecipeId: null,
    };
  });

  return { items, total: items.length };
}

async function fetchSpoon(
  q: string,
  page: number,
  pageSize: number,
  apiKey: string | undefined
): Promise<{ items: ClientBrowseCard[]; total: number | null }> {
  if (!apiKey) return { items: [], total: null };

  const offset = Math.max(0, (page - 1) * pageSize);
  const url = `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(
    q
  )}&addRecipeInformation=true&number=${pageSize}&offset=${offset}&apiKey=${encodeURIComponent(
    apiKey
  )}`;

  const json = await safeFetchJson<{
    results?: Array<{ id: number; title: string; image?: string; sourceUrl?: string }>;
    totalResults?: number;
  }>(url);
  if (!json) return { items: [], total: null };

  const items: ClientBrowseCard[] = (json.results ?? []).map((res) => ({
    key: `SPOON:${String(res.id)}`,
    provider: "API:SPOON",
    externalId: String(res.id),
    title: res.title,
    image: res.image ?? null,
    meta: null,
    tags: [],
    sourceUrl: res.sourceUrl ?? null,
    existsRecipeId: null,
  }));

  return {
    items,
    total: typeof json.totalResults === "number" ? json.totalResults : null,
  };
}

async function fetchNinjas(
  q: string,
  pageSize: number,
  apiKey: string | undefined
): Promise<{ items: ClientBrowseCard[]; total: number | null }> {
  if (!apiKey) return { items: [], total: null };

  const url = `https://api.api-ninjas.com/v1/recipe?query=${encodeURIComponent(q)}`;
  const json = await safeFetchJson<
    Array<{ title?: string; ingredients?: string; servings?: string; instructions?: string }>
  >(url, { headers: { "X-Api-Key": apiKey } });
  if (!json) return { items: [], total: null };

  const trimmed = json.slice(0, Math.max(1, Math.min(pageSize, 10)));

  const items: ClientBrowseCard[] = trimmed.map((it) => {
    const title = (it.title ?? "").trim();
    const externalId = title.toLowerCase(); // synthetic ID for Ninjas
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

  return { items, total: null }; // total unknown on free tier
}

/* ----------------------------- Route ---------------------------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
    const pageSize = Math.max(1, Math.min(48, Number(searchParams.get("pageSize") || "12") || 12));

    if (!q) {
      return NextResponse.json({ items: [], total: 0, page, pageSize });
    }

    const SPOON_KEY = process.env.SPOONACULAR_API_KEY;
    const NINJAS_KEY = process.env.API_NINJAS_KEY;

    // Fetch in parallel, each provider failure degrades to empty
    const [meal, spoon, ninjas] = await Promise.all([
      fetchMealDB(q),
      fetchSpoon(q, page, pageSize, SPOON_KEY),
      fetchNinjas(q, pageSize, NINJAS_KEY),
    ]);

    // Combine + dedupe
    const combinedMap = new Map<string, ClientBrowseCard>();
    const push = (c: ClientBrowseCard) => {
      const k = `${c.provider}:${c.externalId}`;
      if (!combinedMap.has(k)) combinedMap.set(k, c);
    };
    meal.items.forEach(push);
    spoon.items.forEach(push);
    ninjas.items.forEach(push);

    let combined = Array.from(combinedMap.values());

    // Mark items that already exist in local DB using ext:* tags
    const tagList = combined.map((c) => extTagFor(c.provider, c.externalId));
    if (tagList.length) {
      const tagRows = await prisma.recipeTag.findMany({
        where: { value: { in: tagList } },
        select: { value: true, recipeId: true },
      });
      const tagToId = new Map<string, number>(tagRows.map((r) => [r.value, r.recipeId]));
      combined = combined.map((c) => ({
        ...c,
        existsRecipeId: tagToId.get(extTagFor(c.provider, c.externalId)) ?? null,
      }));
    }

    // Sort & paginate
    combined.sort((a, b) => a.title.localeCompare(b.title));

    const totalApprox =
      (meal.total ?? 0) +
      (spoon.total ?? spoon.items.length) +
      (ninjas.total ?? ninjas.items.length);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return NextResponse.json({
      items: combined.slice(start, end),
      total: totalApprox || combined.length,
      page,
      pageSize,
    });
  } catch {
    // Never 500; just return empty result
    return NextResponse.json(
      { items: [], total: 0, page: 1, pageSize: 12, error: "browse_failed" },
      { status: 200 }
    );
  }
}
