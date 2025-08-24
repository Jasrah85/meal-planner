// src/app/api/upc/route.ts
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  const upc = String(code ?? "").trim();
  if (!upc) return NextResponse.json({ error: "code required" }, { status: 400 });

  // 1) already known?
  const existing = await prisma.barcode.findUnique({ where: { code: upc } });
  if (existing) return NextResponse.json({ barcode: existing });

  // 2) try Open Food Facts (server-side fetch avoids CORS)
  let label: string | null = null;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(upc)}.json`, {
      // Small timeout to keep the UI snappy
      cache: "no-store",
      // @ts-ignore (supported on Vercel Node)
      next: { revalidate: 0 },
    });
    if (r.ok) {
      const data = await r.json();
      label = data?.product?.product_name?.trim() || null;
    }
  } catch { /* ignore */ }

  // 3) cache result (even if null → lets you rename once and remember forever)
  const barcode = await prisma.barcode.upsert({
    where: { code: upc },
    update: { label },
    create: { code: upc, label },
  });

  return NextResponse.json({ barcode });
}
