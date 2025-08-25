import "./globals.css";
import ReactQueryProvider from "../components/react-query-client";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <div className="min-h-dvh grid grid-rows-[auto_1fr]">
            {/* Top bar */}
            <TopNav />

            {/* App content */}
            <div className="grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
              {/* Sidebar (collapses on mobile, hidden via TopNav button) */}
              <aside className="border-r bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40 lg:block hidden">
                <Sidebar />
              </aside>

              {/* Main column */}
              <main className="mx-auto w-full max-w-5xl p-4">
                <Breadcrumbs />
                {children}
              </main>
            </div>
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
