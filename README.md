# KwaNomzi Boutique Lodge — Management & Booking Platform

Production booking and lodge-management system for KwaNomzi Boutique Lodge (South Africa). See the project's Phase 0 architecture document (in the project conversation history) for the full technical blueprint — this README covers local setup only.

**Status:** Phase 1 (project setup and foundation). No booking, payment, auth, or room-management functionality exists yet — see "Development phases" below.

## Tech Stack

- **Frontend/Backend:** Next.js 16 (App Router) + React 19 + TypeScript, single modular-monolith codebase
- **Database:** PostgreSQL, via Prisma ORM (schema not yet defined — Phase 2)
- **Auth:** Auth.js (admin only) — Phase 3
- **Payments:** Yoco Checkout API — Phase 8
- **Testing:** Vitest + React Testing Library (unit/integration), Playwright (e2e)
- **Linting/formatting:** ESLint (flat config) + Prettier

## Getting Started

```bash
npm install
cp .env.example .env   # fill in a real DATABASE_URL once Phase 2 provisions a database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                            | Purpose                                            |
| --------------------------------- | -------------------------------------------------- |
| `npm run dev`                     | Start the dev server                               |
| `npm run build`                   | Production build                                   |
| `npm run start`                   | Run a production build                             |
| `npm run lint`                    | ESLint                                             |
| `npm run typecheck`               | TypeScript, no emit                                |
| `npm run format` / `format:check` | Prettier write / check                             |
| `npm test`                        | Unit + integration tests (Vitest)                  |
| `npm run test:watch`              | Vitest in watch mode                               |
| `npm run test:e2e`                | End-to-end tests (Playwright)                      |
| `npm run prisma:generate`         | Regenerate the Prisma client after a schema change |

## Project Structure

```
/app
  /(guest)/...     guest-facing pages (public)
  /admin/...       admin dashboard pages (auth-gated from Phase 3 onward)
  /api/...         route handlers
/lib
  /services        domain/business logic (BookingService, AvailabilityService, ...)
  /payments        payment provider adapters, behind a shared interface (Yoco only)
  /db              Prisma client singleton
  /validation      Zod schemas shared between client and server
  /auth            Auth.js configuration
  /generated       Prisma client output (generated, gitignored)
/prisma
  schema.prisma    data model (empty until Phase 2)
/components        shared UI components
/tests
  /unit            Vitest
  /integration     Vitest, exercises real logic against a test database (Phase 2+)
  /e2e             Playwright
```

## Environment Variables

See [.env.example](.env.example) for the full list. Only `DATABASE_URL` is relevant until Phase 2; the Auth.js and Yoco variables are placeholders documenting what's coming and are not read by any code yet.

## Development Phases

This project is being built in gated phases (0–12); each phase is scoped, implemented, tested, and confirmed before the next begins. See the phase history for full detail. Current phase: **1 — project setup and foundation**.
