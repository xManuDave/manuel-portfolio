import type { NextConfig } from "next";

// Set by the GitHub Pages workflow, e.g. "/manuel-portfolio" for https://<user>.github.io/manuel-portfolio/
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
