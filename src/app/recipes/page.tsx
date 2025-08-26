// Server Component
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import RecipesClient from "./RecipesClient";

type RecipeListRow = {
  id: number;
  title: string;
  servings: number | null;
  sourceType: string | null;
  sourceUrl: string | null;
  tags: string[];
  _count?: { ingredients: number };
  pantryName?: string | null; // optional
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000"; // dev fallback
}

export default async function RecipesPage() {
  let initialLibrary: RecipeListRow[] = [];
  try {
    const res = await fetch(`${getBaseUrl()}/api/recipes`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { recipes: RecipeListRow[] };
      initialLibrary = data.recipes ?? [];
    }
  } catch {
    // ignore; client will still fetch
  }

  return <RecipesClient initialLibrary={initialLibrary} />;
}
