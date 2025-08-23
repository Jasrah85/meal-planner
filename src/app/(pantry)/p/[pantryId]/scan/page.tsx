"use client";

import { use } from "react";                      // 👈 add
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Scanner from "@/components/scanner";

export default function ScanPage({
  params,
}: {
  params: Promise<{ pantryId: string }>;          // 👈 change type
}) {
  const { pantryId } = use(params);               // 👈 unwrap
  const pantryIdNum = Number(pantryId);

  const [code, setCode] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ code: string; label?: string } | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleCode(scanned: string) {
    setCode(scanned);
    const res = await fetch(`/api/upc?code=${encodeURIComponent(scanned)}`);
    setLookup(res.ok ? await res.json() : null);
  }

  async function addItem() {
    if (!code) return;
    setAdding(true);
    await fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pantryId: pantryIdNum,
        name: lookup?.label ?? "Unknown item",
        quantity: 1,
        barcode: { code },
      }),
    });
    setAdding(false);
    alert("Item added to pantry.");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Scan a Barcode</h1>
      <Scanner onResult={handleCode} />
      <div className="rounded-md border p-3">
        <div>Last code: <b>{code ?? "—"}</b></div>
        {lookup
          ? <div>Known label: <b>{lookup.label}</b></div>
          : code && <div className="text-gray-500">No existing label (will add as “Unknown item”).</div>}
        <div className="mt-3">
          <Button onClick={addItem} disabled={!code || adding}>{adding ? "Adding…" : "Add to Pantry"}</Button>
        </div>
      </div>
    </div>
  );
}
