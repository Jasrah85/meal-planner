import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const bc = await prisma.barcode.findUnique({ where: { code } });
  if (!bc) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ code: bc.code, label: bc.label });
}
