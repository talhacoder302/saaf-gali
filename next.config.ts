import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Excel imports are uploaded through a Server Action (default limit is 1 MB).
      bodySizeLimit: "5mb",
    },
  },
};

export default withNextIntl(nextConfig);
