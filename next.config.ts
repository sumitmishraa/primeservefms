import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // xlsx (SheetJS) uses Node.js built-ins that can't be bundled by webpack.
  // Marking it as server-external tells Next.js to require() it at runtime
  // instead of trying to bundle it.
  serverExternalPackages: ["xlsx"],
  async redirects() {
    return [
      {
        source: "/terms",
        destination: "/legal/terms-and-conditions",
        permanent: false,
      },
      {
        source: "/terms-and-conditions",
        destination: "/legal/terms-and-conditions",
        permanent: false,
      },
      {
        source: "/privacy",
        destination: "/legal/privacy-policy",
        permanent: false,
      },
      {
        source: "/privacy-policy",
        destination: "/legal/privacy-policy",
        permanent: false,
      },
      {
        source: "/shipping",
        destination: "/legal/shipping-and-delivery-policy",
        permanent: false,
      },
      {
        source: "/shipping-policy",
        destination: "/legal/shipping-and-delivery-policy",
        permanent: false,
      },
      {
        source: "/shipping-and-delivery-policy",
        destination: "/legal/shipping-and-delivery-policy",
        permanent: false,
      },
      {
        source: "/refund-policy",
        destination: "/legal/refund-policy",
        permanent: false,
      },
      {
        source: "/credit-terms",
        destination: "/legal/credit-policy",
        permanent: false,
      },
      {
        source: "/credit-policy",
        destination: "/legal/credit-policy",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
