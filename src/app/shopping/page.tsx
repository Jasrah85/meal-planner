// src/app/shopping/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import ShoppingClient, { PantryLite } from "./shopping-client";

export default async function ShoppingPage() {
  // Use the demo user like your root page does
  const demo = await prisma.user.findUnique({
    where: { email: "demo@pantry.local" },
    select: { id: true },
  });

  const pantries: PantryLite[] = await prisma.pantry.findMany({
    where: demo ? { userId: demo.id } : undefined,
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  if (!pantries) return notFound();

  return <ShoppingClient pantries={pantries} />;
}
