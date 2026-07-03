import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vera — Merchant Growth OS",
  description: "AI-powered merchant growth and customer engagement command center"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
