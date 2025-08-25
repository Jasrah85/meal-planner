export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

type SpoonSearchItem = {
  id: number;
  title: string;
  image?: string;
  sourceUrl?: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "12") || 12));
  const offset = (page - 1) * pageSize;

  const key = process.env.SPOONACULAR_API_KEY ?? "";
  const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
  url.searchParams.set("query", q);
  url.searchParams.set("number", String(pageSize));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("addRecipeInformation", "true");
  url.searchParams.set("apiKey", key);

  const resp = await fetch(url.toString(), { cache: "no-store" });
  if (!resp.ok) {
    const msg = await resp.text();
    return NextResponse.json({ error: `spoonacular ${resp.status}`, detail: msg.slice(0, 240) }, { status: 502 });
  }

  const json = (await resp.json()) as { results: SpoonSearchItem[]; totalResults?: number };
  const items = (json.results ?? []).map((r) => ({
    externalId: String(r.id),
    title: r.title,
    image: r.image ?? null,
    sourceUrl: r.sourceUrl ?? null,
    provider: "API:SPOON" as const,
  }));

  return NextResponse.json({
    provider: "API:SPOON",
    page,
    pageSize,
    total: json.totalResults ?? null,
    items,
  });
}
