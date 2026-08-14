import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/games/mini-sudoku-reimagined",
  assetPrefix: "/games/mini-sudoku-reimagined",
  images: { unoptimized: true },
  transpilePackages: ["@daily-games/game-core"],
};

export default nextConfig;
