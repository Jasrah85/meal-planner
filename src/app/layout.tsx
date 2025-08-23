import "./globals.css";
import ReactQueryProvider from "../components/react-query-client";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <header className="border-b mb-4">
            <nav className="mx-auto flex max-w-5xl items-center gap-4 p-4">
              <Link href="/">Pantry Planner</Link>
              <div className="ml-auto flex items-center gap-3">
                <Link href="/settings">Settings</Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl p-4">{children}</main>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
