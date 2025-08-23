import prisma from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$connect();
    // lightweight check
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "connected" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
