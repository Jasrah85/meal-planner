export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/db";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export default async function PantriesIndex() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@pantry.local" } });

  const pantries = await prisma.pantry.findMany({
    where: demo ? { userId: demo.id } : undefined,
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pantries</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pantries.map((p) => (
          <Card key={p.id} className="card p-4 card-hover flex items-center justify-between">
            <div className="font-medium">{p.name}</div>
            <div className="flex gap-2">
              <Link className="underline text-sm" href={`/p/${p.id}`}>Overview</Link>
              <Link className="underline text-sm" href={`/p/${p.id}/items`}>Items</Link>
              <Link className="underline text-sm" href={`/p/${p.id}/scan`}>Scan</Link>
            </div>
          </Card>
        ))}
        {pantries.length === 0 && (
          <Card className="card p-4 card-hover flex items-center justify-between">
            No pantries yet. Go to <Link className="underline" href="/settings">Settings</Link> to add one.
          </Card>
        )}
      </div>
    </div>
  );
}
