export const runtime = "nodejs";
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const tag = new URL(req.url).searchParams.get("tag")?.trim();
  if (!tag) return NextResponse.json({ error: "tag required" }, { status: 400 });
  const found = await prisma.recipe.findFirst({ where: { tags: { some: { value: tag } } }, select: { id: true } });
  if (!found) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, id: found.id });
}
