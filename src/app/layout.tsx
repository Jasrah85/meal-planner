import "./globals.css";
import ReactQueryProvider from "../components/react-query-client";
import { Sidebar } from "@/components/Sidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";

// NEW: import the improved top nav
import { TopNav } from "@/components/TopNav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          {/* Top bar (improved) */}
          <TopNav />

          {/* Breadcrumbs under the top bar */}
          <div className="container-gutter mx-auto max-w-6xl py-2">
            <Breadcrumbs />
          </div>

          {/* Shell: sidebar + main */}
          <div className="container-gutter mx-auto max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr] gap-0">
              <Sidebar />
              <main id="page-content" className="p-4 sm:p-6">
                {children}
              </main>
            </div>
          </div>

          {/* NOTE: Command palette is provided inside <TopNav /> now. 
              If your CommandPalette is meant to be global and NOT controlled by TopNav,
              you can re-add it here instead and remove it from TopNav. */}
        </ReactQueryProvider>
      </body>
    </html>
  );
}
