/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/cron/daily-backup/route": ["./node_modules/pdfkit/js/data/**/*"],
    },
  },
};

module.exports = nextConfig;
