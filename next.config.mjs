/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Webinar banners are served from the Supabase Storage public bucket.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
