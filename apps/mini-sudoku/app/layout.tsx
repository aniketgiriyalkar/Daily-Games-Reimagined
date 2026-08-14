import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aniketgiriyalkar.github.io"),
  title: "Mini Sudoku-Reimagined — Six digits, one clean grid",
  description:
    "A crisp offline-first 6×6 Sudoku with daily boards, unlimited practice, notes, hints, and local streaks.",
  openGraph: {
    title: "Mini Sudoku-Reimagined",
    description: "Every digit, once per row, column, and shaded box.",
    type: "website",
    url: "/games/mini-sudoku-reimagined/",
    images: [
      {
        url: "/games/mini-sudoku-reimagined/og.png",
        width: 1200,
        height: 630,
        alt: "Mini Sudoku-Reimagined social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/games/mini-sudoku-reimagined/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
