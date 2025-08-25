"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EditDeletePantry({
  pantryId,
  pantryName,
}: { pantryId: number; pantryName: string }) {
  const router = useRouter();
  const [name, setName] = useState(pantryName);
  const [editing, setEditing] = useState(false);

  const update = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pantries/${pantryId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update pantry");
      return res.json();
    },
    onSuccess: () => setEditing(false),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!confirm("Delete this pantry? This cannot be undone.")) return;
      const res = await fetch(`/api/pantries/${pantryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete pantry");
      return res.json();
    },
    onSuccess: () => router.push("/"),
  });

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <>
          <Input className="h-8 w-56" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            size="sm"
            onClick={() => update.mutate()}
            disabled={update.isPending || !name.trim()}
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setName(pantryName); setEditing(false); }}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Rename
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => del.mutate()}
            disabled={del.isPending}
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        </>
      )}
    </div>
  );
}
