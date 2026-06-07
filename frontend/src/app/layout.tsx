import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Export Controls Dependency Map — Real Rails",
  description:
    "Real-time intelligence dashboard mapping global export-control dependencies across critical minerals, semiconductor tooling, and advanced logic.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: "#030712" }}>

        {/* ── Real Rails Header ── */}
        <header className="flex-none flex items-center justify-between border-b border-border px-6 py-3" style={{ background: "rgba(11,17,23,0.9)", backdropFilter: "blur(12px)" }}>
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="rr-glow flex h-8 w-8 items-center justify-center rounded-md bg-card border border-border">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Real Rails · Governance &amp; Trust</div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">Export Controls Dependency Map</h1>
            </div>
          </div>

          {/* Right: Live indicator */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {/* Animated ping dot */}
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              LIVE · {new Date().toISOString().slice(0, 10)}
            </span>
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
