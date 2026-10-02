import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Loaded from node_modules at runtime instead of bundled (it ships its own font handling).
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      // Excel imports are uploaded through a Server Action (default limit is 1 MB).
      bodySizeLimit: "5mb",
    },
  },
};

export default withNextIntl(nextConfig);
