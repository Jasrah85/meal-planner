import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ItemUpdateBody = {
  name?: string;
  quantity?: number;
  syncBarcodeLabel?: boolean;
};
type ItemUpdate = { name?: string; quantity?: number };

// Optional: avoid 405s from HEAD prefetches
export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;                // 👈 unwrap params
  const itemId = Number(id);

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { barcode: true, pantry: true },
  });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;                // 👈 unwrap params
  const itemId = Number(id);
  const body = (await req.json()) as ItemUpdateBody;

  const data: ItemUpdate = {};
  if (typeof body?.name === "string") data.name = body.name.trim();

  // allow zero, coerce to non-negative int
  if (body?.quantity !== undefined) {
    const n = Number(body.quantity);
    if (Number.isFinite(n)) data.quantity = Math.max(0, Math.floor(n));
  }

  const updated = await prisma.item.update({
    where: { id: itemId },
    data,
    include: { barcode: true, pantry: true },
  });

  // Sync barcode label on rename unless explicitly disabled
  const shouldSync = body?.syncBarcodeLabel ?? typeof data.name === "string";
  if (shouldSync && updated.barcodeId && typeof data.name === "string" && data.name) {
    await prisma.barcode.update({
      where: { id: updated.barcodeId },
      data: { label: data.name },
    });
  }

  const refreshed = await prisma.item.findUnique({
    where: { id: itemId },
    include: { barcode: true, pantry: true },
  });

  return NextResponse.json({ item: refreshed ?? updated });
}

export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;                // 👈 unwrap params
  const itemId = Number(id);
  await prisma.item.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
