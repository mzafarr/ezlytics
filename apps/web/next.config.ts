import "@my-better-t-app/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  transpilePackages: ["shiki"],
  async rewrites() {
    return [{ source: "/js/script.js", destination: "/script.js" }];
  },
};

export default nextConfig;
