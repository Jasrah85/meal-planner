"use client";

import { NavLink } from "./NavLink";

export function Sidebar() {
  return (
    <nav className="p-3 space-y-6">
      <div className="space-y-1">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Overview
        </div>
        <NavLink href="/" exact>Dashboard</NavLink>
      </div>

      <div className="space-y-1">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Pantries
        </div>
        <NavLink href="/p">Manage Pantries</NavLink>
      </div>

      <div className="space-y-1">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Recipes
        </div>
        <NavLink href="/recipes">All Recipes</NavLink>
        <NavLink href="/recipes/new">New Recipe</NavLink>
      </div>

      <div className="space-y-1">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Tools
        </div>
        <NavLink href="/scan">Scan Item</NavLink>
        <NavLink href="/shopping">Shopping List</NavLink>
      </div>

      <div className="space-y-1">
        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Settings
        </div>
        <NavLink href="/settings">General</NavLink>
      </div>
    </nav>
  );
}
