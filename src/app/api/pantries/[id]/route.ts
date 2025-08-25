import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Avoid 405s from HEAD prefetches
export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}

type PantryUpdateBody = { name?: string };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // 👈 Next 15: params is a Promise
) {
  const { id } = await ctx.params; // 👈 unwrap
  const pantryId = Number(id);

  const pantry = await prisma.pantry.findUnique({
    where: { id: pantryId },
    include: { items: { include: { barcode: true } } },
  });
  if (!pantry) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ pantry });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // 👈 Promise params
) {
  const { id } = await ctx.params; // 👈 unwrap
  const pantryId = Number(id);

  const body = (await req.json()) as PantryUpdateBody;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const pantry = await prisma.pantry.update({ where: { id: pantryId }, data: { name } });
  return NextResponse.json({ pantry });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // 👈 Promise params
) {
  const { id } = await ctx.params; // 👈 unwrap
  const pantryId = Number(id);
  await prisma.pantry.delete({ where: { id: pantryId } });
  return NextResponse.json({ ok: true });
}
