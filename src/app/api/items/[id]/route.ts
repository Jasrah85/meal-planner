import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const item = await prisma.item.findUnique({ where: { id }, include: { barcode: true, pantry: true } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = await req.json();

  const data: Record<string, any> = {};
  if (typeof body?.name === "string") data.name = body.name.trim();

  // ✅ allow zero
  if (body?.quantity !== undefined) {
    const q = Math.max(0, Math.floor(Number(body.quantity)));
    if (!Number.isNaN(q)) data.quantity = q;
  }

  const updated = await prisma.item.update({
    where: { id },
    data,
    include: { barcode: true, pantry: true },
  });

  // Sync barcode label on rename unless disabled
  const shouldSync = body?.syncBarcodeLabel ?? (typeof data.name === "string");
  if (shouldSync && updated.barcodeId && typeof data.name === "string" && data.name) {
    await prisma.barcode.update({
      where: { id: updated.barcodeId },
      data: { label: data.name },
    });
  }

  const refreshed = await prisma.item.findUnique({
    where: { id },
    include: { barcode: true, pantry: true },
  });

  return NextResponse.json({ item: refreshed ?? updated });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
