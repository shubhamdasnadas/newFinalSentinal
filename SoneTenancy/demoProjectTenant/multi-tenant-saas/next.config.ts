/** @type {import('next').NextConfig} */
const nextConfig = {

  transpilePackages: ['xlsx'],
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.0.101", "localhost", "192.168.0.102", "192.168.9.116","192.168.9.141","192.168.9.54"],
  images: { unoptimized: true },

};

module.exports = nextConfig;
