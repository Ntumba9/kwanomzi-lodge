import "dotenv/config";
import "@testing-library/jest-dom/vitest";

// Redirect the whole test run at a dedicated database, separate from the
// one the dev server/demo uses — this must happen before anything imports
// lib/db/prisma.ts (which reads process.env.DATABASE_URL at module load
// time), which is why it's here in the global setup file rather than in an
// individual test. See .env.example's TEST_DATABASE_URL for the one-time
// setup this requires.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  console.warn(
    "TEST_DATABASE_URL is not set — integration tests will run against DATABASE_URL " +
      "(the same database the dev server uses). See .env.example.",
  );
}
