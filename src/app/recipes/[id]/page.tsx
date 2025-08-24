"use client";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { use } from "react";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type IngredientRow = {
  id: number;
  name: string;
  qty: number | null;
  unit: string | null;
  barcode?: { code: string | null } | null;
};
type RecipeDetail = {
  id: number;
  title: string;
  servings: number | null;
  notes: string | null;
  steps: string | null;
  tags: string[];
  ingredients: IngredientRow[];
};

async function fetchRecipe(id: number) {
  const res = await fetch(`/api/recipes/${id}`, { cache: "no-store" });
  if (res.status === 404) return null; // handle not found cleanly
  if (!res.ok) throw new Error("Failed to load recipe");
  return (await res.json() as { recipe: RecipeDetail }).recipe;
}

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const recipeId = Number(id);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: () => fetchRecipe(recipeId),
  });

  // local edit state
  const [title, setTitle] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [steps, setSteps] = useState<string>("");
  const [rows, setRows] = useState<IngredientRow[]>([]);

  // initialize local state when data arrives (avoid setState during render)
  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setTags(data.tags.join(", "));
    setSteps(data.steps ?? "");
    setRows(data.ingredients);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        steps,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        ingredients: rows.map((r) => ({
          name: r.name,
          qty: r.qty ?? undefined,
          unit: r.unit ?? undefined,
        })),
      };
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save recipe");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe", recipeId] });
      alert("Saved.");
    },
  });

  // ingredient row helpers
  const addRow = () =>
  setRows((rs) => [
    ...rs,
    { id: -Date.now(), name: "", qty: null, unit: null, barcode: null },
  ]);
  const removeRow = (idx: number) =>
    setRows((rs) => rs.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<IngredientRow>) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // coverage + cook
  const [pantryIdInput, setPantryIdInput] = useState<string>("1");
  const [checking, setChecking] = useState(false);
  const [coverage, setCoverage] = useState<null | {
    coverage: number;
    matched: string[];
    missing: string[];
    counts: { matched: number; missing: number; total: number };
  }>(null);

  async function checkCoverage() {
    const pid = Number(pantryIdInput);
    if (!Number.isFinite(pid) || pid <= 0) return alert("Enter a valid pantry id");
    setChecking(true);
    try {
      const res = await fetch(`/api/match?pantryId=${pid}&recipeId=${recipeId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Match failed");
      const json = await res.json();
      setCoverage(json.result);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  const [cooking, setCooking] = useState(false);
  const [cookResult, setCookResult] = useState<null | {
    coverage: number;
    matched: Array<{ ingredient: string; itemId: number; before: number; decrement: number }>;
    missing: string[];
    applied: Array<{ itemId: number; before: number; after: number; dec: number }>;
    summary: { matched: number; missing: number; total: number };
  }>(null);

  async function cookThis(deduct: boolean) {
    const pid = Number(pantryIdInput);
    if (!Number.isFinite(pid) || pid <= 0) return alert("Enter a valid pantry id");
    setCooking(true);
    try {
      const res = await fetch(`/api/cook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pantryId: pid, recipeId, deduct }),
      });
      if (!res.ok) throw new Error("Cook failed");
      const json = await res.json();
      setCookResult(json);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCooking(false);
    }
  }

  // states
  if (isLoading) return <div>Loading…</div>;
  if (error) return <div className="text-red-600">Failed to load recipe.</div>;
  if (data === null) return <div>Recipe not found. <Link href="/recipes" className="underline">Back to recipes</Link></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Edit Recipe</h1>

      <div className="space-y-2">
        <label className="text-sm">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Tags (comma-separated)</label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Steps</label>
        <textarea
          className="w-full rounded-md border p-2 text-sm min-h-[120px]"
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Ingredients</label>
          <Button variant="outline" size="sm" onClick={addRow}>Add ingredient</Button>
        </div>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <Input className="w-64" placeholder="name"
                value={r.name}
                onChange={(e) => updateRow(idx, { name: e.target.value })}
              />
              <Input className="w-24" placeholder="qty" type="number"
                value={r.qty ?? ""}
                onChange={(e) =>
                  updateRow(idx, { qty: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
              <Input className="w-28" placeholder="unit"
                value={r.unit ?? ""}
                onChange={(e) => updateRow(idx, { unit: e.target.value || null })}
              />
              <Button variant="ghost" onClick={() => removeRow(idx)}>🗑️</Button>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save"}
      </Button>

      {/* Coverage & Cook */}
      <div className="rounded-md border p-3 space-y-2">
        <div className="font-medium">Pantry actions</div>
        <div className="flex items-center gap-2">
          <Input className="w-24" value={pantryIdInput} onChange={(e) => setPantryIdInput(e.target.value)} />
          <Button onClick={checkCoverage} disabled={checking}>
            {checking ? "Checking…" : "Check coverage"}
          </Button>
          <Button variant="outline" onClick={() => cookThis(false)} disabled={cooking}>
            {cooking ? "Simulating…" : "Simulate cook"}
          </Button>
          <Button onClick={() => cookThis(true)} disabled={cooking}>
            {cooking ? "Cooking…" : "Cook this"}
          </Button>
        </div>
        {coverage && (
          <div className="text-sm mt-2">
            <div>
              Coverage: <b>{Math.round(coverage.coverage * 100)}%</b>{" "}
              ({coverage.counts.matched}/{coverage.counts.total})
            </div>
            {!!coverage.missing.length && (
              <div className="mt-1 text-red-600">Missing: {coverage.missing.join(", ")}</div>
            )}
          </div>
        )}
        {cookResult && (
          <div className="text-sm mt-2">
            <div className="font-medium">Cook result</div>
            <div>
              Coverage: <b>{Math.round(cookResult.coverage * 100)}%</b>{" "}
              ({cookResult.summary.matched}/{cookResult.summary.total})
            </div>
            {cookResult.applied?.length ? (
              <div className="mt-1">
                Deducted:
                <ul className="list-disc pl-5">
                  {cookResult.applied.map((a, i) => (
                    <li key={i}>Item {a.itemId}: −{a.dec} ({a.before} → {a.after})</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-1">No deductions (simulation or no matches).</div>
            )}
            {!!cookResult.missing?.length && (
              <div className="mt-1 text-red-600">Missing: {cookResult.missing.join(", ")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
