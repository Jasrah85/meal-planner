import prisma from "@/lib/db";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type PantryLite = { id: number; name: string };

export default async function Home() {
  const demo = await prisma.user.upsert({
    where: { email: "demo@pantry.local" },
    update: {},
    create: { email: "demo@pantry.local", name: "Demo User" },
  });

  const pantries: PantryLite[] = await prisma.pantry.findMany({
    where: { userId: demo.id },
    orderBy: { id: "asc" },
    select: { id: true, name: true }, // ensures the shape matches PantryLite
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pantries.map((p: PantryLite) => ( // 👈 no implicit any
        <Card key={p.id} className="flex items-center justify-between">
          <div>
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-gray-500">ID: {p.id}</div>
          </div>
          <div className="flex gap-2">
            <Link className="underline" href={`/p/${p.id}`}>Overview</Link>
            <Link className="underline" href={`/p/${p.id}/items`}>Items</Link>
            <Link className="underline" href={`/p/${p.id}/scan`}>Scan</Link>
          </div>
        </Card>
      ))}
    </div>
  );
}
