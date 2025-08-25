"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PantryRow = { id: number; name: string };

async function fetchPantries(): Promise<{ pantries: PantryRow[] }> {
  const res = await fetch("/api/pantries", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load pantries");
  return res.json();
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["pantries"], queryFn: fetchPantries });
  const pantries = data?.pantries ?? [];

  // create
  const [newName, setNewName] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create pantry");
      return res.json();
    },
    onSuccess: () => {
      setNewName("");
      qc.invalidateQueries({ queryKey: ["pantries"] });
    },
  });

  // inline rename state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (p: PantryRow) => {
    setEditingId(p.id);
    setRenameValue(p.name);
  };
  const cancelRename = () => {
    setEditingId(null);
    setRenameValue("");
  };

  const rename = useMutation({
    mutationFn: async (payload: { id: number; name: string }) => {
      const res = await fetch(`/api/pantries/${payload.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: payload.name.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename pantry");
      return res.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setRenameValue("");
      qc.invalidateQueries({ queryKey: ["pantries"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/pantries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete pantry");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pantries"] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Manage Pantries */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Manage Pantries</h2>
          <Link className="underline text-sm" href="/p">
            Go to pantries
          </Link>
        </div>

        <div className="flex max-w-lg gap-2">
          <Input
            placeholder="New pantry name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button
            onClick={() => create.mutate()}
            disabled={!newName.trim() || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>

        <div className="divide-y rounded border">
          {pantries.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                {editingId === p.id ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => rename.mutate({ id: p.id, name: renameValue })}
                      disabled={!renameValue.trim() || rename.isPending}
                    >
                      {rename.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelRename}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">ID: {p.id}</div>
                  </>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {editingId === p.id ? null : (
                  <>
                    <Link className="underline text-sm" href={`/p/${p.id}`}>
                      Open
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => startRename(p)}>
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this pantry? This cannot be undone.")) {
                          del.mutate(p.id);
                        }
                      }}
                      disabled={del.isPending}
                    >
                      {del.isPending ? "Deleting…" : "Delete"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {pantries.length === 0 && (
            <div className="p-3 text-sm text-gray-600">No pantries yet.</div>
          )}
        </div>
      </section>

      {/* You can add other global settings sections here later */}
    </div>
  );
}
