"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function NewRecipePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          sourceType: "USER",
        }),
      });
      if (!res.ok) throw new Error("Failed to create recipe");
      return res.json() as Promise<{ recipe: { id: number } }>;
    },
    onSuccess: (data) => {
      router.push(`/recipes/${data.recipe.id}`);
    },
  });

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">New Recipe</h1>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <Button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}>
        {create.isPending ? "Creating…" : "Create"}
      </Button>
    </div>
  );
}
