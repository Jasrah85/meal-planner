import "./globals.css";
import ReactQueryProvider from "../components/react-query-client";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CommandPalette } from "@/components/command-palette";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <header className="border-b mb-4">
            <nav className="mx-auto flex max-w-5xl items-center gap-4 p-4">
              <Link href="/">Pantry Planner</Link>
              <div className="ml-auto flex items-center gap-3">
                <Link href="/scan">Scan</Link>
                <Link href="/settings">Settings</Link>
              </div>
            </nav>
            <div className="mx-auto max-w-5xl px-4 py-2">
              <Breadcrumbs />
            </div>
          </header>

          <main className="mx-auto max-w-5xl p-4">
            {children}
          </main>

          <CommandPalette />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
