import { NextResponse } from "next/server";
import prisma from "@/lib/db";

type Params = { id: string };

export async function PATCH(
  req: Request,
  { params }: { params: Params }
) {
  try {
    const { id } = params;
    const body = (await req.json()) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const updated = await prisma.pantry.update({
      where: { id: Number(id) },
      data: { name },
      select: { id: true, name: true },
    });
    return NextResponse.json({ pantry: updated });
  } catch (e) {
    return NextResponse.json({ error: "Rename failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params }
) {
  try {
    const deleted = await prisma.pantry.delete({
      where: { id: Number(params.id) },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: deleted.id });
  } catch (e) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
