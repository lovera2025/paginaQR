/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite levantar un segundo servidor de prueba en la misma carpeta sin que se pisen
  // (NEXT_DIST_DIR=.next-preview). En producción no se define y queda ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
