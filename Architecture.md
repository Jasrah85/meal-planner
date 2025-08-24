# Pantry Planner — Architecture

> This document describes the system architecture of Pantry Planner: tech stack, data model, folder layout, runtime environments, APIs, and deployment. Save as `architecture.md` at the repo root.

---

## 1) Goals & Scope

* Track pantries, items, and barcodes.
* Scan UPCs via camera; label unknown barcodes.
* Minimal APIs using Next.js Route Handlers.
* Persist locally with SQLite (dev) and Postgres (prod).
* Foundation for recipes, matching, and cooking flows.

## 2) Tech Stack

* **Framework:** Next.js 15 (App Router)
* **Language:** TypeScript (strict)
* **Styling:** Tailwind CSS + shadcn/ui (Radix primitives)
* **Data:** Prisma ORM

  * **Dev:** SQLite file DB (`file:./prisma/dev.db`)
  * **Prod:** Postgres (Neon) via Vercel
* **Client data fetching:** TanStack Query (React Query v5)
* **Scanning:** `@zxing/library`
* **Runtime:** Node.js runtime for server routes and RSCs
* **Bundler:** Turbopack

## 3) Directory Layout

```
src/
  app/
    (pantry)/
      p/[pantryId]/page.tsx             # pantry overview (RSC)
      p/[pantryId]/items/page.tsx       # list+add+edit items (client)
      p/[pantryId]/scan/page.tsx        # camera scanner (client)
    recipes/
      page.tsx                          # list recipes (RSC)
      [id]/page.tsx                     # recipe detail + cook (RSC + client bits)
    api/
      items/route.ts                    # GET/POST items
      items/[id]/route.ts               # GET/PUT/DELETE item
      pantries/route.ts                 # GET/POST pantries
      pantries/[id]/route.ts            # GET/PUT/DELETE pantry
      recipes/route.ts                  # GET/POST recipes, supports query/tag
      recipes/[id]/route.ts             # GET/PUT/DELETE recipe
      recipes/import/themealdb/route.ts # import from TheMealDB (optional)
      cook/route.ts                     # compute coverage & optional deduction
      upc/route.ts                      # resolve UPC → barcode/label (stub)
      health/prisma/route.ts            # DB connectivity health check
    layout.tsx                          # Root layout; wraps React Query provider
    page.tsx                            # Home: list demo user's pantries
  components/
    react-query-client.tsx
    scanner.tsx                         # ZXing camera reader
    item-form.tsx
    ui/                                 # shadcn/ui primitives (Button, Card, Input, etc.)
  lib/
    db.ts                               # PrismaClient singleton
  prisma/
    schema.prisma                       # DEV: SQLite schema
    schema.postgres.prisma              # PROD: Postgres schema
    migrations/                         # PROD: SQL migrations for Postgres
public/
  favicon.ico
```

## 4) Data Model (Prisma)

**Core entities**

* `User (1) — (M) Pantry`
* `Pantry (1) — (M) Item`
* `Item (M) — (1?) Barcode` (optional link)
* `Recipe (1) — (M) Ingredient`
* `Recipe (1) — (M) RecipeTag`
* `Ingredient (M) — (0..1) Barcode` (optional link to canonical product)
* `Ingredient (M) — (0..1) Item` (optional link to your pantry item)

**Important notes**

* Cascade deletes from `User → Pantry → Item`, and from `Recipe → Ingredient/RecipeTag`.
* `Item.quantity` is non-negative integer; `PUT /api/items/[id]` clamps to `≥ 0`.
* Renaming an `Item` can optionally sync the attached `Barcode.label`.
* Timestamps: `createdAt` default now; `updatedAt` via `@updatedAt` (Item/Recipe).

## 5) Runtime Environments

### Dev (local)

* **DB:** SQLite (`DATABASE_URL="file:./prisma/dev.db"`)
* **Schema:** `prisma/schema.prisma`
* **Commands:**

  ```bash
  npx prisma generate
  npx prisma db push           # create/update tables in dev.db
  npm run dev
  ```

### Prod (Vercel + Neon Postgres)

* **DB:** Postgres (Neon) with pooled & non-pooled URLs
* **Schema:** `prisma/schema.postgres.prisma`
* **Env vars (Preview & Prod):**

  * `DATABASE_URL` → pooled/"Prisma" URL
  * `DIRECT_URL` → non-pooled URL (migrations)
  * `PRISMA_SCHEMA_PATH=prisma/schema.postgres.prisma` (optional if scripts pass `--schema`)
* **Build:**

  * `postinstall`: `prisma generate --schema prisma/schema.postgres.prisma`
  * `db:deploy`: `prisma migrate deploy --schema prisma/schema.postgres.prisma`
  * **Build Command:** `npm run db:deploy && npm run build`
* **Pages touching DB:** include

  ```ts
  export const dynamic = "force-dynamic";
  export const runtime = "nodejs";
  ```

## 6) API Surface (Route Handlers)

*All routes support `HEAD` to avoid 405s on prefetch.*

* `GET /api/health/prisma` → `{ ok: boolean, url: string }`
* **Pantries**

  * `GET /api/pantries` → list
  * `POST /api/pantries` → create
  * `GET /api/pantries/:id`, `PUT`, `DELETE`
* **Items**

  * `GET /api/items?pantryId=…` → list for pantry
  * `POST /api/items` → create
  * `GET /api/items/:id`, `PUT`, `DELETE` → edit/delete
* **Barcodes / UPC**

  * `POST /api/upc` → resolve or upsert a `Barcode` (stub; can integrate external UPC API)
* **Recipes**

  * `GET /api/recipes?query=…&tag=…` → search/filters
  * `POST /api/recipes` → create with tags/ingredients
  * `GET /api/recipes/:id`, `PUT`, `DELETE`
  * `GET /api/recipes/import/themealdb` (optional) → import sample recipes; `?q=chicken&limit=3&import=true`
* **Cook**

  * `POST /api/cook` `{ pantryId, recipeId, deduct?: boolean, perIngredient?: number }`

    * Returns coverage, matches, missing; optional stock deduction transaction.

**Status codes**: `200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`.

## 7) Frontend Flow

* **Root `/` (RSC)**: Lists demo user’s pantries (dev). In prod, demo upsert is disabled.
* **`/p/:pantryId` (RSC)**: Pantry summary + recent items.
* **`/p/:pantryId/items` (client)**: TanStack Query fetch + mutate; add/edit/delete items; quantity increment/decrement with optimistic updates; rename can sync barcode label.
* **`/p/:pantryId/scan` (client)**: `Scanner` component mounts camera; ZXing continuous decode; posts to `/api/upc` + creates/links items.
* **`/recipes` (RSC)**: List recipes, basic search, tags.
* **`/recipes/:id` (RSC)**: Show ingredients; “Cook this” button → calls `/api/cook`; displays coverage and (if `deduct`) the applied decrements.

**React Query**

* Provider via `src/components/react-query-client.tsx` wrapped in root layout.
* Common keys: `['pantries']`, `['pantry', id]`, `['items', pantryId]`, `['recipes']`, `['recipe', id]`.
* Mutations invalidate related keys; optimistic updates for item quantity changes.

## 8) Edge Cases & Platform Notes

* **Next 15 params**: `params` are Promises. In RSC, use `const { pantryId } = use(params)`; in routes, `const { id } = await ctx.params`.
* **HEAD support**: Add `export async function HEAD() { return NextResponse.json(null, { status: 200 }); }` to avoid 405s from prefetching.
* **Case-insensitive search**: SQLite lacks `mode: 'insensitive'`; use plain `contains` in dev. Postgres can add `mode` later or use `ILIKE` via raw SQL if needed.
* **Build vs runtime**: DB access must not run at build time; ensure `dynamic = 'force-dynamic'` on pages that query Prisma.

## 9) Health & Observability

* `/api/health/prisma` checks Prisma can connect; returns URL and simple counts (optional).
* Consider enabling Prisma query logging in dev: `new PrismaClient({ log: ['query'] })`.
* Add structured logs around mutations (future).

## 10) Security & Configuration

* Do **not** commit production secrets; store in Vercel env vars.
* Prefer rotating Neon credentials after testing.
* CORS: same-origin app → no special config needed.
* Camera: browser permission prompts when opening `/scan`.

## 11) Local Dev Recipes

```bash
# Ensure schema is synced to SQLite
npx prisma db push

# Seed (optional)
npx tsx prisma/seed.ts

# Run
npm run dev

# Import sample recipes via TheMealDB importer (when route is enabled)
curl "http://localhost:3000/api/recipes/import/themealdb?q=chicken&limit=3&import=true"
```

## 12) Deployment (Vercel)

* Env (Preview + Prod): `DATABASE_URL`, `DIRECT_URL`, `PRISMA_SCHEMA_PATH=prisma/schema.postgres.prisma`.
* Build Command: `npm run db:deploy && npm run build`.
* Postinstall: `prisma generate --schema prisma/schema.postgres.prisma`.
* Verify: `https://<domain>/api/health/prisma` → `ok: true`.

## 13) Roadmap

* **Auth**: multi-user auth (NextAuth or custom) + RLS-style enforcement in app layer.
* **Better UPC**: integrate an external UPC DB; cache results in `Barcode`.
* **Matching**: smarter ingredient↔item matching (tokens, categories, synonyms).
* **Cooking UX**: adjustable serving size → scaled deduction; batch operations.
* **Insights**: low-stock alerts; consumption trends.
* **Tests**: e2e (Playwright) for scanner and item flows; API contract tests.

---

**Appendix — Prisma Client Singleton**

```ts
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
```

**Appendix — React Query Provider**

```tsx
// src/components/react-query-client.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
export function ReactQueryClient({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
```
