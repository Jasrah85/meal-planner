export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PantryLite = { id: number; name: string };

async function getPantries(): Promise<PantryLite[]> {
  // If you later add auth, swap this to filter by current user.
  const demo = await prisma.user.findUnique({ where: { email: "demo@pantry.local" } });
  const where = demo ? { userId: demo.id } : undefined;
  return prisma.pantry.findMany({
    where,
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
}

// Server action: redirects to /p/[id]/scan based on the form selection
async function goToScan(formData: FormData) {
  "use server";
  const pantryIdRaw = formData.get("pantryId");
  const pantryId = Number(pantryIdRaw);
  if (!Number.isFinite(pantryId) || pantryId <= 0) {
    // Fall back to settings if something's off
    redirect("/settings");
  }
  redirect(`/p/${pantryId}/scan`);
}

export default async function ScanRouterPage() {
  const pantries = await getPantries();

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Scan Items</h1>
        <p className="text-sm text-gray-600">
          Choose a pantry to scan into. You can also jump directly using the quick links below.
        </p>
      </header>

      {/* Picker form (server action) */}
      <form action={goToScan} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="pantryId" className="text-sm font-medium">Pantry</label>
          <select
            id="pantryId"
            name="pantryId"
            className="min-w-[240px] rounded-md border px-2 py-2 text-sm"
            defaultValue={pantries[0]?.id ?? ""}
            required
          >
            {pantries.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (ID {p.id})</option>
            ))}
          </select>
        </div>
        <Button type="submit">Open scanner</Button>
      </form>

      {/* Empty state */}
      {pantries.length === 0 && (
        <Card className="p-4 text-sm">
          No pantries yet. Go to{" "}
          <Link className="underline" href="/settings">
            Settings
          </Link>{" "}
          to create one.
        </Card>
      )}

      {/* Quick links */}
      {pantries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Quick Links</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pantries.map((p) => (
              <Card key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">ID: {p.id}</div>
                </div>
                <Link className="underline text-sm" href={`/p/${p.id}/scan`}>
                  Scan to this pantry
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
