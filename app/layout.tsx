import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CsComunNuovo",
  description: "Centro Sportivo Comun Nuovo",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
