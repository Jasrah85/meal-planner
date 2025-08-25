"use client";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { use } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

type CookMatched = { ingredient: string; itemId: number; before: number; decrement: number };
type CookApplied = { itemId: number; before: number; after: number; dec: number };
type CookSummary = { matched: number; missing: number; total: number };
type CookResponse = {
  pantryId: number; recipeId: number; title: string;
  coverage: number; matched: CookMatched[]; missing: string[];
  applied: CookApplied[]; summary: CookSummary;
};

async function fetchRecipe(id: number) {
  const res = await fetch(`/api/recipes/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load recipe");
  return (await res.json() as { recipe: RecipeDetail }).recipe;
}

/* ------------------------------ Tag Chips ------------------------------ */

function tokenizeTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function uniqueCaseFold(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

function TagChips({
  value,
  onChange,
  placeholder = "Add tag and press Enter",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commitDraft() {
    const tokens = uniqueCaseFold([...value, ...tokenizeTags(draft)]);
    setDraft("");
    onChange(tokens);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeAt(i: number) {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
    inputRef.current?.focus();
  }

  return (
    <div className="rounded-md border p-2">
      <div className="flex flex-wrap gap-2">
        {value.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs">
            {t}
            <button
              onClick={() => removeAt(i)}
              className="rounded-full px-1 text-gray-500 hover:bg-gray-200"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="min-w-[10ch] flex-1 outline-none text-sm"
        />
      </div>
    </div>
  );
}

/* --------------------------- Steps Helpers ----------------------------- */

function normalizeLines(s: string): string[] {
  return s.replace(/\r\n?/g, "\n").split("\n");
}

function toNumbered(lines: string[]): string[] {
  let n = 1;
  return lines.map((ln) => {
    const txt = ln.replace(/^\s*[-*]\s+/, "").replace(/^\s*\d+\.\s+/, "");
    return txt.trim() ? `${n++}. ${txt}` : "";
  });
}

function toBulleted(lines: string[]): string[] {
  return lines.map((ln) => {
    const txt = ln.replace(/^\s*\d+\.\s+/, "").replace(/^\s*[-*]\s+/, "");
    return txt.trim() ? `- ${txt}` : "";
  });
}

function insertTemplate(): string {
  return [
    "1. Preheat oven to 375°F (190°C).",
    "2. Prep ingredients as listed.",
    "3. Cook according to steps below:",
    "- Mix filling …",
    "- Stuff shells …",
    "- Bake 20–25 minutes …",
  ].join("\n");
}

/* ---------------------------------------------------------------------- */

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
  const [tagList, setTagList] = useState<string[]>([]);
  const [steps, setSteps] = useState<string>("");
  const [rows, setRows] = useState<IngredientRow[]>([]);

  // initialize when data arrives
  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setTagList(uniqueCaseFold(data.tags));
    setSteps(data.steps ?? "");
    setRows(data.ingredients);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        steps,
        tags: tagList,
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
      const res = await fetch(`/api/cook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pantryId: pid, recipeId, deduct: false }),
      });
      if (!res.ok) throw new Error("Coverage failed");
      const json = (await res.json()) as CookResponse;
      setCoverage({
        coverage: json.coverage,
        matched: json.matched.map((m) => m.ingredient),
        missing: json.missing,
        counts: json.summary,
      });
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

  // derived UI bits
  const coveragePct = useMemo(
    () => (coverage ? Math.round(coverage.coverage * 100) : 0),
    [coverage]
  );

  // ----- guards so `data` is never possibly undefined -----
  if (isLoading) return <div>Loading…</div>;
  if (error) return <div className="text-red-600">Failed to load recipe.</div>;
  if (!data)
    return (
      <div>
        Recipe not found.{" "}
        <Link href="/recipes" className="underline">
          Back to recipes
        </Link>
      </div>
    );
  // from here on, `data` is RecipeDetail

  return (
    <div className="relative space-y-6">
      {/* Header / summary */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Edit Recipe</h1>
          <span className="text-xs text-gray-500">ID: {data.id}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <div className="space-y-1">
            <label className="text-xs font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Servings (optional)</label>
            <Input
              type="number"
              placeholder="e.g. 4"
              value={data.servings ?? ""}
              onChange={() => {/* reserved for future editing */}}
              disabled
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Tags</label>
          <TagChips value={tagList} onChange={setTagList} />
        </div>
      </div>

      {/* Main grid: Steps | Ingredients */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Steps */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Steps</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSteps((s) => (s.trim() ? toNumbered(normalizeLines(s)).join("\n") : insertTemplate()))}
                title="Insert template or convert to numbered"
              >
                Template / 1.
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSteps((s) => toBulleted(normalizeLines(s)).join("\n"))}
                title="Convert to bullets"
              >
                • Bullets
              </Button>
            </div>
          </div>
          <textarea
            className="w-full rounded-md border p-2 text-sm min-h-[320px] leading-6"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={"1. Preheat oven…\n2. Mix filling…\n- Tip: you can paste any text, then use the buttons to format."}
          />
          <p className="text-xs text-gray-500">
            Tip: Paste lines and click <b>Template / 1.</b> for a quick numbered list, or <b>• Bullets</b>.
          </p>
        </section>

        {/* Ingredients */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Ingredients</h2>
            <Button variant="outline" size="sm" onClick={addRow}>
              Add ingredient
            </Button>
          </div>

          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr,90px,90px,40px] items-center gap-2 border-b px-3 py-2 text-xs text-gray-600">
              <div>Name</div>
              <div>Qty</div>
              <div>Unit</div>
              <div />
            </div>
            <div className="divide-y">
              {rows.map((r, idx) => (
                <div key={`${r.id}-${idx}`} className="grid grid-cols-[1fr,90px,90px,40px] items-center gap-2 px-3 py-2">
                  <Input
                    placeholder="e.g. Olive Oil"
                    value={r.name}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="e.g. 3"
                    value={r.qty ?? ""}
                    onChange={(e) =>
                      updateRow(idx, { qty: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                  <Input
                    placeholder="e.g. tbsp"
                    value={r.unit ?? ""}
                    onChange={(e) => updateRow(idx, { unit: e.target.value || null })}
                  />
                  <Button variant="ghost" onClick={() => removeRow(idx)} aria-label="Remove row">
                    🗑️
                  </Button>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500">
                  No ingredients yet. Click <b>Add ingredient</b> to begin.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Pantry Actions */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pantry Actions</h2>
          {coverage && (
            <span className="text-sm">
              Coverage: <b>{coveragePct}%</b> ({coverage.counts.matched}/{coverage.counts.total})
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-24"
            value={pantryIdInput}
            onChange={(e) => setPantryIdInput(e.target.value)}
            aria-label="Pantry ID"
          />
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-2">
              <div className="text-sm font-medium mb-1">Matched</div>
              {coverage.matched.length ? (
                <ul className="text-sm list-disc pl-5">
                  {coverage.matched.map((m) => (
                    <li key={`m-${m}`}>{m}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No matches.</div>
              )}
            </div>
            <div className="rounded-md border p-2">
              <div className="text-sm font-medium mb-1">Missing</div>
              {coverage.missing.length ? (
                <ul className="text-sm list-disc pl-5 text-red-600">
                  {coverage.missing.map((m) => (
                    <li key={`x-${m}`}>{m}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">Nothing missing 🎉</div>
              )}
            </div>
          </div>
        )}

        {cookResult && (
          <div className="rounded-md border p-2">
            <div className="text-sm font-medium mb-1">Cook result</div>
            <div className="text-sm">
              Coverage: <b>{Math.round(cookResult.coverage * 100)}%</b>{" "}
              ({cookResult.summary.matched}/{cookResult.summary.total})
            </div>
            {cookResult.applied?.length ? (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {cookResult.applied.map((a, i) => (
                  <li key={i}>Item {a.itemId}: −{a.dec} ({a.before} → {a.after})</li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-sm text-gray-500">No deductions (simulation or no matches).</div>
            )}
            {!!cookResult.missing?.length && (
              <div className="mt-1 text-sm text-red-600">
                Missing: {cookResult.missing.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Save bar */}
      <div className="sticky bottom-0 z-10 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 p-3">
          {save.isSuccess && <span className="text-xs text-green-700">Saved ✓</span>}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
