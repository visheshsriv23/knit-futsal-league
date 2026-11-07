import type { Metadata } from "next";
import { Anton, Barlow } from "next/font/google";
import "./globals.css";

const display = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });

export const metadata: Metadata = {
  title: "KNIT Futsal League – Live Auction",
  description: "Live player auction for the KNIT Futsal League.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}