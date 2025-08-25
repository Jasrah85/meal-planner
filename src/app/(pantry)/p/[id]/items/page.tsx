"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type ItemRow = {
  id: number;
  name: string;
  quantity: number;
  barcode?: { code: string | null } | null;
};

async function fetchItems(pantryId: number) {
  const res = await fetch(`/api/items?pantryId=${pantryId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load items");
  return (await res.json()) as { items: ItemRow[] };
}

export default function PantryItems({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const pantryIdNum = Number(id);

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["items", pantryIdNum],
    queryFn: () => fetchItems(pantryIdNum),
  });

  // Add form state
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);

  const addMutation = useMutation({
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
      setName("");
      setQty(1);
      qc.invalidateQueries({ queryKey: ["items", pantryIdNum] });
    },
  });

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState<number>(1);

  function startEdit(item: ItemRow) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(item.quantity);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditQty(1);
  }

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; name?: string; quantity?: number; syncBarcodeLabel?: boolean }) => {
      const res = await fetch(`/api/items/${payload.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items", pantryIdNum] });
      cancelEdit();
    },
  });

  // NEW: delete
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items", pantryIdNum] });
    },
  });

  const incDec = (item: ItemRow, delta: number) => {
    const next = Math.max(0, (item.quantity ?? 0) + delta); // 👈 allow 0
    updateMutation.mutate({ id: item.id, quantity: next });
  };

  const zeroOut = (item: ItemRow) => {
    updateMutation.mutate({ id: item.id, quantity: 0 }); // 👈 set to zero
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      name: editName.trim(),
      quantity: Math.max(0, Number(editQty) || 0), // 👈 allow 0 in edit
      syncBarcodeLabel: true, // rename teaches the barcode label
    });
  };

  const remove = (id: number) => {
    if (confirm("Delete this item? This cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Items</h1>

      {/* Add form */}
      <div className="flex flex-wrap items-center gap-2 max-w-xl">
        <Input
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-72"
        />
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</Button>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1")))}
            className="w-20 text-center"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setQty((q) => q + 1)}>+</Button>
        </div>
        <Button onClick={() => addMutation.mutate()} disabled={!name.trim() || addMutation.isPending}>
          {addMutation.isPending ? "Adding…" : "Add"}
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div>Loading…</div>
      ) : (
        <ul className="divide-y rounded-md border">
          {data?.items.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <li key={item.id} className="p-3">
                {isEditing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-64" />
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditQty((q) => Math.max(0, q - 1))}>−</Button>
                      <Input
                        type="number"
                        min={0}
                        value={editQty}
                        onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value || "0")))}
                        className="w-20 text-center"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditQty((q) => q + 1)}>+</Button>
                    </div>
                    <Button onClick={saveEdit} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className={`font-medium ${item.quantity === 0 ? "text-gray-400 line-through" : ""}`}>
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Qty: {item.quantity}{item.barcode?.code ? ` • UPC ${item.barcode.code}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => incDec(item, -1)} disabled={updateMutation.isPending}>−</Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => incDec(item, +1)} disabled={updateMutation.isPending}>+</Button>
                      </div>
                      <Button variant="ghost" onClick={() => startEdit(item)}>Edit</Button>
                      <Button variant="outline" onClick={() => zeroOut(item)} disabled={updateMutation.isPending}>Zero</Button>
                      <Button variant="ghost" onClick={() => remove(item.id)} disabled={deleteMutation.isPending}>🗑️</Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
