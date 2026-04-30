import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stageside",
  description: "DJ career operating system",
};

const navLinks = [
  { href: "/promoters", label: "Promoters" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/pitch/new", label: "Pitch" },
  { href: "/events", label: "Events" },
  { href: "/mixes", label: "Mixes" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b border-border px-6 py-4">
          <nav className="flex items-center gap-8 max-w-5xl mx-auto">
            <Link
              href="/promoters"
              className="text-sm font-semibold tracking-widest uppercase text-foreground"
            >
              Stageside
            </Link>
            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
