import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/convert-image-format",
        destination: "/convert-image",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
