import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isProjectPage =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryName.length > 0 &&
  !repositoryName.endsWith(".github.io");
const basePath = isProjectPage ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
