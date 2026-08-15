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
};

export default nextConfig;
