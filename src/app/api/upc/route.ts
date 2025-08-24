// src/app/api/upc/route.ts
export const runtime = "nodejs";

import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}

type OFFResponse = { product?: { product_name?: string } };

export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({}));
  const upc = String(code ?? "").trim();
  if (!upc) return NextResponse.json({ error: "code required" }, { status: 400 });

  // 1) Known already?
  const existing = await prisma.barcode.findUnique({ where: { code: upc } });
  if (existing) return NextResponse.json({ barcode: existing });

  // 2) Try Open Food Facts (best-effort)
  let label: string | null = null;
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(upc)}.json`;
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(url, { cache: "no-store", signal: ac.signal });
    clearTimeout(to);

    if (r.ok) {
      const data = (await r.json()) as OFFResponse;
      label = data.product?.product_name?.trim() ?? null;
    }
  } catch {
    // Network error/timeout: fall back to null label
  }

  // 3) Cache (even if null) so user rename sticks for next time
  const barcode = await prisma.barcode.upsert({
    where: { code: upc },
    update: { label },
    create: { code: upc, label },
  });

  return NextResponse.json({ barcode });
}
