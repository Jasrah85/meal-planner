import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const url = process.env.DATABASE_URL ?? "";
    const filePart = url.startsWith("file:") ? url.replace(/^file:/, "") : null;
    const resolved = filePart ? path.resolve(process.cwd(), filePart) : null;
    const exists = resolved ? fs.existsSync(resolved) : null;

    const [users, pantries, items, barcodes, recipes] = await Promise.all([
      prisma.user.count(),
      prisma.pantry.count(),
      prisma.item.count(),
      prisma.barcode.count(),
      prisma.recipe.count().catch(() => 0),
    ]);

    return NextResponse.json({
      ok: true,
      url,
      resolvedPath: resolved,
      fileExists: exists,
      counts: { users, pantries, items, barcodes, recipes },
      cwd: process.cwd(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
