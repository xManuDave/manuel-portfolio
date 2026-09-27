import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manuel Strunz — Interactive Portfolio",
  description: "Interactive 3D portfolio of Manuel Strunz.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
