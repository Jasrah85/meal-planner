"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { useState } from "react";

async function fetchPantries() {
  const res = await fetch("/api/pantries", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load pantries");
  return res.json() as Promise<{ pantries: Array<{ id: number; name: string }> }>;
}

export default function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["pantries"], queryFn: fetchPantries });

  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create pantry");
      return res.json();
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["pantries"] });
    }
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="flex max-w-md gap-2">
        <Input placeholder="New pantry name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Create</Button>
      </div>

      <h2 className="text-xl font-medium mt-6">Pantries</h2>
      <ul className="list-disc pl-6">
        {data?.pantries.map(p => <li key={p.id}>{p.name} (ID {p.id})</li>)}
      </ul>
    </div>
  );
}
