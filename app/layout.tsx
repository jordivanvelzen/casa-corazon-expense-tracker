import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Casa Corazón",
  description: "Household expense tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Casa Corazón",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased bg-gray-50 text-gray-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
