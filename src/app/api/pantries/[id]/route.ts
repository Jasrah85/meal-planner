import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const pantry = await prisma.pantry.findUnique({
    where: { id },
    include: { items: { include: { barcode: true } } },
  });
  if (!pantry) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ pantry });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = await req.json();
  const name = String(body?.name || "").trim();
  const pantry = await prisma.pantry.update({ where: { id }, data: { name } });
  return NextResponse.json({ pantry });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  await prisma.pantry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
