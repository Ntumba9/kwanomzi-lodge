/**
 * One-time OWNER bootstrap — run manually (`npm run create-owner`), never
 * as part of build/deploy. Reads OWNER_EMAIL / OWNER_PASSWORD from the
 * environment so no credential is ever hardcoded or committed; the password
 * is hashed with the same Argon2 implementation the login flow verifies
 * against (lib/auth/passwords.ts) and is never logged or printed, in
 * plaintext or otherwise.
 *
 * Idempotent: safe to re-run. If the email already exists, this promotes it
 * to OWNER and resets its password to OWNER_PASSWORD rather than erroring —
 * useful for recovering access, not just first setup.
 */
// Run directly via `npm run create-owner` (tsx), not through the Prisma CLI
// like seed.ts — so .env isn't loaded automatically unless we do it here.
import "dotenv/config";
import { getPrisma } from "../lib/db/prisma";
import { hashPassword } from "../lib/auth/passwords";

async function main() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) {
    console.error("OWNER_EMAIL and OWNER_PASSWORD must both be set in the environment. Nothing was created.");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("OWNER_PASSWORD must be at least 8 characters. Nothing was created.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  const prisma = await getPrisma();

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "OWNER", isActive: true },
    create: { email, name: "Owner", passwordHash, role: "OWNER" },
  });

  console.log(`OWNER account ready: ${user.email} (id ${user.id}). Password was not logged.`);
}

main()
  .catch((err) => {
    console.error("Failed to create OWNER account:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await getPrisma()).$disconnect();
  });
