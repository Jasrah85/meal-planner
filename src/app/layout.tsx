import "./globals.css";
import ReactQueryProvider from "../components/react-query-client";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CommandPalette } from "@/components/command-palette";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          {/* Top bar */}
          <header className="border-b">
            <nav className="container-gutter mx-auto flex max-w-6xl items-center gap-4 py-3">
              <Link href="/" className="font-medium">Pantry Planner</Link>
              <div className="ml-auto flex items-center gap-4 text-sm">
                <Link href="/scan">Scan</Link>
                <Link href="/settings">Settings</Link>
              </div>
            </nav>
            {/* Breadcrumbs under the top bar */}
            <div className="container-gutter mx-auto max-w-6xl py-2">
              <Breadcrumbs />
            </div>
          </header>

          {/* Shell: sidebar + main */}
          <div className="container-gutter mx-auto max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr] gap-0">
              <Sidebar />
              <main className="p-4">{children}</main>
            </div>
          </div>

          {/* Global command palette overlay */}
          <CommandPalette />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
