import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aniketgiriyalkar.github.io"),
  title: "Queens-Reimagined — Daily logic, offline",
  description:
    "A tactile daily logic puzzle with uniquely generated boards, practice modes, local streaks, and no account required.",
  openGraph: {
    title: "Queens-Reimagined",
    description: "Place one crown in every row, column, and region.",
    type: "website",
    url: "/games/queens-reimagined/",
    images: [
      {
        url: "/games/queens-reimagined/og.png",
        width: 1200,
        height: 630,
        alt: "Queens-Reimagined daily logic game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/games/queens-reimagined/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
