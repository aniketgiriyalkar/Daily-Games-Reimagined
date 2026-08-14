import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/games/queens-reimagined",
  assetPrefix: "/games/queens-reimagined",
  images: { unoptimized: true },
};

export default nextConfig;
