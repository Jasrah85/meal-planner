"use client";

import { use } from "react";                      // 👈 add
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

async function fetchItems(pantryId: number) {
  const res = await fetch(`/api/items?pantryId=${pantryId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load items");
  return res.json() as Promise<{ items: Array<{ id: number; name: string; quantity: number; barcode?: { code: string|null } | null }> }>;
}

export default function PantryItems({
  params,
}: {
  params: Promise<{ pantryId: string }>;          // 👈 change type
}) {
  const { pantryId } = use(params);               // 👈 unwrap
  const pantryIdNum = Number(pantryId);

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["items", pantryIdNum],
    queryFn: () => fetchItems(pantryIdNum),
  });

  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pantryId: pantryIdNum, name, quantity: qty }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      setName(""); setQty(1);
      qc.invalidateQueries({ queryKey: ["items", pantryIdNum] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Items</h1>
      <div className="flex gap-2 max-w-md">
        <Input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value || "1"))} />
        <Button onClick={() => mutation.mutate()} disabled={!name || mutation.isPending}>Add</Button>
      </div>

      {isLoading ? <div>Loading…</div> : (
        <ul className="divide-y border rounded-md">
          {data?.items.map(i => (
            <li key={i.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{i.name}</div>
                <div className="text-xs text-gray-500">Qty: {i.quantity}{i.barcode ? ` • UPC ${i.barcode.code}` : ""}</div>
              </div>
              {/* delete/edit could go here */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}