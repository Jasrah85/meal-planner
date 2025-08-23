import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const item = await prisma.item.findUnique({ where: { id }, include: { barcode: true, pantry: true } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = await req.json();
  const data: any = {};
  if (typeof body?.name === "string") data.name = body.name;
  if (typeof body?.quantity === "number") data.quantity = Math.max(1, body.quantity);
  const item = await prisma.item.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
