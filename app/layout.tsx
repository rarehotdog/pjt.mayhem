import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
  title: "Tyler Telegram Assistant",
  description:
    "Telegram 5-bot orchestration backend (Tyler.Durden, LENS, BOLT, INK, SENTRY).",
  icons: {
    icon: "/icon-192.svg",
    apple: "/icon-192.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans">
        <div className="main-shell">{children}</div>
      </body>
    </html>
  );
}
