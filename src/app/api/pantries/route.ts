import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  // no auth: return all, but in real app scope by user
  const pantries = await prisma.pantry.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ pantries });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // attach to demo user for now
  const user = await prisma.user.upsert({
    where: { email: "demo@pantry.local" },
    update: {},
    create: { email: "demo@pantry.local", name: "Demo User" },
  });

  const pantry = await prisma.pantry.create({ data: { name, userId: user.id } });
  return NextResponse.json({ pantry }, { status: 201 });
}
