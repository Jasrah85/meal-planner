export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

type NinjasResult = {
  title: string;
  ingredients: string;           // pipe-separated
  servings?: string | null;
  instructions?: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(30, Math.max(1, Number(searchParams.get("pageSize") ?? "10") || 10));
  const offset = (page - 1) * pageSize;

  const base = new URL("https://api.api-ninjas.com/v1/recipe");
  base.searchParams.set("query", q);
  base.searchParams.set("limit", String(pageSize)); // may be premium-only
  if (offset) base.searchParams.set("offset", String(offset)); // may be premium-only

  const key = process.env.API_NINJAS_KEY ?? "";
  const resp = await fetch(base.toString(), { headers: { "X-Api-Key": key }, cache: "no-store" });

  // If plan doesn’t allow limit/offset, fall back to single-result fetch
  let items = (await resp.json()) as NinjasResult[] | { error?: string };
  if (!Array.isArray(items)) items = [];
  if (items.length <= 1 && (page > 1 || pageSize > 1)) {
    const fallback = new URL("https://api.api-ninjas.com/v1/recipe");
    fallback.searchParams.set("query", q);
    const r2 = await fetch(fallback.toString(), { headers: { "X-Api-Key": key }, cache: "no-store" });
    items = (await r2.json()) as NinjasResult[];
  }

  const normalized = items.map((r) => ({
    externalId: r.title, // Ninjas doesn’t return ids; we use title as a stable-ish key
    title: r.title,
    image: null as string | null,
    sourceUrl: null as string | null,
    provider: "API:NINJAS" as const,
    preview: (r.instructions ?? "").slice(0, 180),
    raw: { ingredients: r.ingredients, instructions: r.instructions, servings: r.servings ?? null },
  }));

  return NextResponse.json({
    provider: "API:NINJAS",
    page,
    pageSize,
    items: normalized,
  });
}
