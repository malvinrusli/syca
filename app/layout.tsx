import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SYCA AI",
  description: "Personal branding chat for Start Your Content Academy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans">{children}</body>
    </html>
  );
}
