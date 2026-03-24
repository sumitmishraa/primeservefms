import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // xlsx (SheetJS) uses Node.js built-ins that can't be bundled by webpack.
  // Marking it as server-external tells Next.js to require() it at runtime
  // instead of trying to bundle it.
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
