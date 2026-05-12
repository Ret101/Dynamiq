/** @type {import('next').NextConfig} */

// When deploying to GitHub Pages at https://ret101.github.io/Dynamiq/
// Next.js needs to know the sub-path. Set NEXT_PUBLIC_BASE_PATH='' for
// custom-domain or root deployments.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/Dynamiq';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
