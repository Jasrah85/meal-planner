"use client";

import { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function ItemForm({ pantryId, onAdded }: { pantryId: number; onAdded?: () => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);

  async function submit() {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pantryId, name, quantity }),
    });
    if (res.ok) {
      setName(""); setQuantity(1);
      onAdded?.();
    } else {
      alert("Failed to add item");
    }
  }

  return (
    <div className="flex gap-2">
      <Input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value || "1"))} />
      <Button onClick={submit} disabled={!name}>Add</Button>
    </div>
  );
}
