import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function norm(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pantryId = Number(body?.pantryId);
  const recipeId = Number(body?.recipeId);
  const deduct = Boolean(body?.deduct);          // if true, decrement pantry counts
  const perIngredientDefault = Number(body?.perIngredient ?? 1); // fallback deduction per matched ingredient

  if (!Number.isFinite(pantryId) || pantryId <= 0) {
    return NextResponse.json({ error: "pantryId required" }, { status: 400 });
  }
  if (!Number.isFinite(recipeId) || recipeId <= 0) {
    return NextResponse.json({ error: "recipeId required" }, { status: 400 });
  }

  // Load pantry items (names + barcode labels)
  const items = await prisma.item.findMany({
    where: { pantryId },
    include: { barcode: true },
  });

  // Build match bank: normalized → array of item refs
  const bank = new Map<string, { id: number; name: string; quantity: number }[]>();
  function addKey(key: string, it: { id: number; name: string; quantity: number }) {
    const k = norm(key);
    if (!k) return;
    const arr = bank.get(k) ?? [];
    arr.push(it);
    bank.set(k, arr);
  }
  for (const it of items) {
    addKey(it.name, { id: it.id, name: it.name, quantity: it.quantity });
    if (it.barcode?.label) addKey(it.barcode.label, { id: it.id, name: it.name, quantity: it.quantity });
  }

  // Load recipe ingredients (names + qty/unit for future use)
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, title: true, ingredients: { select: { name: true, qty: true, unit: true } } },
  });
  if (!recipe) return NextResponse.json({ error: "recipe not found" }, { status: 404 });

  // Greedy match by normalized name (substring fallback)
  const matched: { ingredient: string; itemId: number; before: number; decrement: number }[] = [];
  const missing: string[] = [];

  for (const ing of recipe.ingredients) {
    const key = norm(ing.name);
    const candidates =
        bank.get(key) ??
        [...bank.entries()]
            .filter(([k]) => k === key || k.includes(key) || key.includes(k))
            .flatMap(([, arr]) => arr);

    // pick the first item with quantity > 0, or just first
    const picked = candidates.find((c) => c.quantity > 0) ?? candidates[0];

    if (!picked) {
      missing.push(ing.name);
      continue;
    }

    // basic decrement logic: use ingredient qty if numeric, else default perIngredient
    const dec = Math.max(
      0,
      Math.ceil(
        typeof ing.qty === "number" && Number.isFinite(ing.qty) ? ing.qty : perIngredientDefault
      )
    );

    matched.push({ ingredient: ing.name, itemId: picked.id, before: picked.quantity, decrement: dec });

    // update the bank copy so we don't over-consume one item in scoring
    const newQty = Math.max(0, picked.quantity - dec);
    picked.quantity = newQty;
  }

  // If deduct: apply changes in a transaction
  let applied: { itemId: number; before: number; after: number; dec: number }[] = [];
  if (deduct && matched.length) {
    const updates = matched.map((m) =>
      prisma.item.update({
        where: { id: m.itemId },
        data: { quantity: { decrement: m.decrement } },
        select: { id: true, quantity: true },
      })
    );
    const results = await prisma.$transaction(updates);
    applied = results.map((r, i) => ({
      itemId: r.id,
      before: matched[i].before,
      after: Math.max(0, r.quantity),
      dec: matched[i].decrement,
    }));
  }

  const total = recipe.ingredients.length || 1;
  const coverage = (total - missing.length) / total;

  return NextResponse.json({
    pantryId,
    recipeId,
    title: recipe.title,
    coverage,
    matched,
    missing,
    applied, // only non-empty if deduct=true
    summary: {
      matched: matched.length,
      missing: missing.length,
      total,
    },
  });
}
