import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/db/prisma.ts reads certs/rds-eu-north-1-bundle.pem via a plain
  // fs.readFileSync when DATABASE_SSL=true — Vercel's serverless bundler
  // can't trace that (it only bundles files it can statically detect from
  // imports), so without this the cert would silently be missing from the
  // deployed function the moment SSL gets turned on. DATABASE_SSL stays
  // unset for the first deployment, but this needs to already be in place
  // for whenever it's flipped on later.
  outputFileTracingIncludes: {
    "/*": ["./certs/**/*.pem"],
  },

  // No middleware or other central place set these before — applied to
  // every response, guest-facing and staff portal alike.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Only this site may frame itself — blocks clickjacking (e.g. an
          // invisible iframe over the staff login or the payment-retry button).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stops the browser from guessing content types, which can turn an
          // uploaded room photo into executable content in a crafted attack.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Never leak the full URL (which can contain a booking reference or
          // guest email in a query string) to a third-party site a guest
          // clicks through to.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No reason for this site to use the camera/mic/geolocation.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
