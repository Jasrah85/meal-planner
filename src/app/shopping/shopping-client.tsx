// src/app/shopping/shopping-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type PantryLite = { id: number; name: string };

type ShoppingItem = {
  id: string;           // local uid
  name: string;
  qty?: string;         // keep as string for simple free-form entry ("2", "2 lbs")
  note?: string;
  done: boolean;
  tag?: string;         // optional tag/category
};

type Props = {
  pantries: PantryLite[];
};

const STORAGE_KEY = (pantryId: number) => `shopping:${pantryId}`;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ShoppingClient({ pantries }: Props) {
  const [selectedPantryId, setSelectedPantryId] = useState<number>(
    pantries[0]?.id ?? 0
  );

  // list state
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sort, setSort] = useState<"name" | "status">("status");

  // new row inputs
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newTag, setNewTag] = useState("");

  // load list when pantry changes
  useEffect(() => {
    if (!selectedPantryId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(selectedPantryId));
      const parsed: ShoppingItem[] = raw ? JSON.parse(raw) : [];
      setItems(parsed);
    } catch {
      setItems([]);
    }
  }, [selectedPantryId]);

  // persist on change
  useEffect(() => {
    if (!selectedPantryId) return;
    localStorage.setItem(STORAGE_KEY(selectedPantryId), JSON.stringify(items));
  }, [selectedPantryId, items]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.tag && set.add(i.tag));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visible = useMemo(() => {
    let list = items;

    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.note && i.note.toLowerCase().includes(q)) ||
          (i.tag && i.tag.toLowerCase().includes(q))
      );
    }

    if (tagFilter !== "all") {
      list = list.filter((i) => (i.tag ?? "") === tagFilter);
    }

    if (sort === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // status: unchecked first, then by name
      list = [...list].sort((a, b) => {
        if (a.done === b.done) return a.name.localeCompare(b.name);
        return a.done ? 1 : -1;
      });
    }

    return list;
  }, [items, filter, tagFilter, sort]);

  function addItem() {
    const name = newName.trim();
    if (!name) return;
    const next: ShoppingItem = {
      id: uid(),
      name,
      qty: newQty.trim() || undefined,
      tag: newTag.trim() || undefined,
      done: false,
    };
    setItems((prev) => [next, ...prev]);
    setNewName("");
    setNewQty("");
    setNewTag("");
  }

  function toggle(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
    );
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearPurchased() {
    setItems((prev) => prev.filter((i) => !i.done));
  }

  function markAllDone(done: boolean) {
    setItems((prev) => prev.map((i) => ({ ...i, done })));
  }

  function copyToClipboard() {
    const lines = items
      .filter((i) => !i.done)
      .map((i) => `• ${i.name}${i.qty ? ` — ${i.qty}` : ""}${i.tag ? ` [${i.tag}]` : ""}`);
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // Optional: build from recipe coverage if you have /api/match
  const [recipeIdInput, setRecipeIdInput] = useState("");
  const [building, setBuilding] = useState(false);
  async function addMissingFromRecipe() {
    const rid = Number(recipeIdInput);
    if (!Number.isFinite(rid) || !selectedPantryId) return;
    setBuilding(true);
    try {
      const res = await fetch(
        `/api/match?pantryId=${selectedPantryId}&recipeId=${rid}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("match failed");
      const json: {
        result?: {
          missing?: string[];
        };
      } = await res.json();

      const missing = json.result?.missing ?? [];
      if (missing.length) {
        const now = Date.now();
        const toAdd = missing.map<ShoppingItem>((m, idx) => ({
          id: `${now}-${idx}`,
          name: m,
          done: false,
        }));
        setItems((prev) => [...toAdd, ...prev]);
      }
    } catch {
      // ignore; keeps page functional even if API isn't wired
    } finally {
      setBuilding(false);
      setRecipeIdInput("");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shopping</h1>
          <p className="text-sm text-gray-600">
            Build a pantry‑specific list. Lists are saved to your browser per pantry.
          </p>
        </div>
        <Link href="/" className="underline text-sm">Back home</Link>
      </div>

      {/* Pantry picker */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">Pantry</label>
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={selectedPantryId || ""}
            onChange={(e) => setSelectedPantryId(Number(e.target.value))}
          >
            {pantries.length === 0 && <option value="">No pantries</option>}
            {pantries.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (ID {p.id})
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => markAllDone(false)}>Uncheck all</Button>
            <Button variant="outline" onClick={() => markAllDone(true)}>Check all</Button>
            <Button variant="outline" onClick={clearPurchased}>Clear purchased</Button>
            <Button onClick={copyToClipboard}>Copy list</Button>
          </div>
        </div>
      </Card>

      {/* Add new */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Input
            placeholder="Item name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Qty (e.g. 2, 2 lbs)"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
          />
          <Input
            placeholder="Tag (e.g. Produce)"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
          />
          <Button onClick={addItem} disabled={!newName.trim()}>
            Add
          </Button>
        </div>
      </Card>

      {/* Optional builder from recipe coverage */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Build from Recipe ID</span>
          <Input
            className="w-32"
            placeholder="e.g. 12"
            value={recipeIdInput}
            onChange={(e) => setRecipeIdInput(e.target.value)}
          />
          <Button onClick={addMissingFromRecipe} disabled={building || !recipeIdInput.trim()}>
            {building ? "Adding…" : "Add missing ingredients"}
          </Button>
          <span className="text-xs text-gray-500">
            Uses <code>/api/match</code> if available.
          </span>
        </div>
      </Card>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="w-56"
          placeholder="Search list…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as "name" | "status")}
        >
          <option value="status">Sort: Status</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* List */}
      <ul className="space-y-2">
        {visible.map((it) => (
          <li key={it.id} className="rounded-md border p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={it.done}
                onChange={() => toggle(it.id)}
                aria-label={`Mark ${it.name} ${it.done ? "not purchased" : "purchased"}`}
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={it.done ? "line-through text-gray-500" : ""}>
                    {it.name}
                  </span>
                  {it.qty && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                      {it.qty}
                    </span>
                  )}
                  {it.tag && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">
                      {it.tag}
                    </span>
                  )}
                </div>
                {it.note && (
                  <div className="text-xs text-gray-500 mt-1">{it.note}</div>
                )}
              </div>
              <Button variant="ghost" onClick={() => remove(it.id)} aria-label={`Remove ${it.name}`}>
                🗑️
              </Button>
            </div>
          </li>
        ))}
        {!visible.length && (
          <li className="rounded-md border p-4 text-sm text-gray-500">
            No items match your filters.
          </li>
        )}
      </ul>

      <div className="text-xs text-gray-500">
        Tip: this list is stored in your browser per pantry. You can also scan items on{" "}
        <Link className="underline" href={`/p/${selectedPantryId || pantries[0]?.id || ""}/scan`}>
          the pantry scan page
        </Link>
        .
      </div>
    </div>
  );
}
