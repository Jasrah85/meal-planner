import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pantryId = Number(searchParams.get("pantryId") || "0");
  const items = await prisma.item.findMany({
    where: pantryId ? { pantryId } : undefined,
    include: { barcode: true },
    orderBy: { id: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const pantryId = Number(body?.pantryId);
  const name = String(body?.name || "").trim();
  const quantity = Math.max(1, Number(body?.quantity || 1));
  const barcode = body?.barcode as { code?: string; label?: string } | undefined;

  if (!pantryId || !name) return NextResponse.json({ error: "pantryId and name required" }, { status: 400 });

  let barcodeId: number | undefined;
  if (barcode?.code) {
    const bc = await prisma.barcode.upsert({
      where: { code: barcode.code },
      update: { label: barcode.label ?? undefined },
      create: { code: barcode.code, label: barcode.label ?? null },
    });
    barcodeId = bc.id;
  }

  const item = await prisma.item.create({
    data: { pantryId, name, quantity, barcodeId },
    include: { barcode: true },
  });

  return NextResponse.json({ item }, { status: 201 });
}
