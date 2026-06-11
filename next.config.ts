import path from "path";
import type { NextConfig } from "next";

// GitHub Pages serves a project site from a subfolder
// (https://<user>.github.io/<repo>/), so the build needs a matching basePath.
// The Pages workflow sets NEXT_PUBLIC_BASE_PATH=/<repo>. Left empty everywhere
// else (local dev, the Electron shell, root-hosted static deploys), which keeps
// the desktop build serving cleanly from app://bundle/.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // static export so the app can run from the Electron shell (and any static host)
  output: "export",
  basePath,
  // a stray lockfile in the user profile makes Next mis-infer the workspace root
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
