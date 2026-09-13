import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "./park.css";

const displayFont = localFont({
  src: "./fonts/fredoka.woff2",
  weight: "400 700",
  variable: "--font-display",
  display: "swap",
});
const bodyFont = localFont({
  src: "./fonts/nunito.woff2",
  weight: "400 800",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Credit Count — Every ride counts",
    template: "%s · Credit Count",
  },
  description:
    "Your personal rollercoaster journal. Log rides, collect credits, and keep the memories.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
