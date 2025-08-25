"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function Breadcrumbs() {
  const pathname = usePathname(); // e.g. /p/12/items
  const parts = pathname.split("/").filter(Boolean); // ["p","12","items"]

  if (parts.length === 0) return null;

  const crumbs = parts.map((seg, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const label = decodeURIComponent(seg)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase()); // simple title case

    const last = i === parts.length - 1;
    return last ? (
      <span key={href} className="text-gray-900">{label}</span>
    ) : (
      <Link key={href} href={href} className="text-gray-600 hover:underline">
        {label}
      </Link>
    );
  });

  return (
    <div className="mb-4 text-sm text-gray-600">
      <nav aria-label="Breadcrumbs" className="flex items-center gap-2">
        <Link href="/" className="text-gray-600 hover:underline">Home</Link>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-gray-400">/</span>
            {c}
          </span>
        ))}
      </nav>
    </div>
  );
}
