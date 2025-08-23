import prisma from "@/lib/db";
import Link from "next/link";

// Optional: ensure this page runs on Node (not Edge)
export const runtime = "nodejs";

// If you want explicit types for items:
type ItemLite = { id: number; name: string; quantity: number };

export default async function PantryOverview({
  params,
}: {
  // Accept both shapes to be future-proof
  params: Promise<{ pantryId: string }> | { pantryId: string };
}) {
  const { pantryId } = await (params as any); // ✅ works if it's a Promise or a plain object
  const id = Number(pantryId);
  if (!Number.isFinite(id)) return <div>Invalid pantry id.</div>;

  const pantry = await prisma.pantry.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      items: {
        orderBy: { id: "desc" },
        select: { id: true, name: true, quantity: true },
      },
    },
  });

  if (!pantry) return <div>Pantry not found.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{pantry.name}</h1>
      <div className="flex gap-3">
        <Link className="underline" href={`/p/${id}/items`}>Manage Items</Link>
        <Link className="underline" href={`/p/${id}/scan`}>Scan Barcodes</Link>
      </div>
      <h2 className="text-xl font-medium mt-6">Recent Items</h2>
      <ul className="list-disc pl-6">
        {pantry.items.map((i: ItemLite) => (
          <li key={i.id}>{i.name} × {i.quantity}</li>
        ))}
      </ul>
    </div>
  );
}
