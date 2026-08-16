# KwaNomzi Boutique Lodge Management & Booking Platform

Production booking and lodge-management system for KwaNomzi Boutique Lodge (Lusikisiki, South Africa). Guests book and pay online; staff manage rooms, guests, and reservations from the staff portal at `/staff`.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript, single modular-monolith codebase
- **Database:** MySQL, via Prisma ORM (`@prisma/adapter-mariadb`, driver adapter — see [lib/db/prisma.ts](lib/db/prisma.ts))
- **Auth:** Auth.js v5, credentials provider, JWT sessions — staff portal only, no guest accounts
- **Payments:** Yoco Checkout API, confirmed via webhook (see "Booking & payment lifecycle" below)
- **Email:** Resend (transactional)
- **Testing:** Vitest (unit + integration), Playwright (e2e)
- **Hosting:** Vercel

## Booking & payment lifecycle

**KwaNomzi is prepaid.** A booking is never confirmed just because a guest submitted the form or was redirected back from checkout only a verified Yoco webhook confirms a booking. The browser redirect after checkout is informational only; it renders whatever the database already says.


Guest selects room/dates → enters details
  → Booking created as PAYMENT_PENDING (room nights reserved, hold timer starts)
  → Guest redirected to Yoco Checkout
  → Guest pays
  → Yoco calls POST /api/webhooks/yoco (payment.succeeded)
  → Signature verified, amount verified against the booking, event de-duplicated
  → Payment → SUCCEEDED, Booking → CONFIRMED (single transaction)
  → Guest confirmation email + staff paid-reservation email sent


Key guarantees already implemented (see [lib/services/WebhookService.ts](lib/services/WebhookService.ts), [lib/services/BookingService.ts](lib/services/BookingService.ts)):

- **Idempotency** each Yoco event id is inserted into `WebhookEvent` under a unique constraint before anything else happens; a redelivered event fails that insert and is dropped as a duplicate.
- **Amount verification** the webhook's reported amount is checked against `Booking.totalAmountCents` (a server-computed snapshot from booking creation, never client-supplied); a mismatch is logged to `AuditLog` and does **not** confirm the booking.
- **Stale-booking protection**— if a payment succeeds for a booking that's no longer `PAYMENT_PENDING` (already confirmed, or its hold expired and the room may belong to someone else), it's logged for manual review instead of auto-confirmed.
- **Double-booking prevention** one `BookingNight` row per occupied night with `UNIQUE(room_id, stay_date)`; enforced by the database itself, not just an application-level check, plus a `SELECT ... FOR UPDATE` room lock and deadlock-retry to keep concurrent attempts on the same room resolving cleanly rather than racing.
- **Failed payments are retryable** a `payment.failed` webhook leaves the booking in `PAYMENT_PENDING` so the guest can retry, rather than destroying it.
- **Booking hold expiry** a `PAYMENT_PENDING` booking whose `holdExpiresAt` has passed is expired (releasing its `BookingNight` rows) by `expireStaleHolds()`, run on a schedule — see "Booking hold expiry (cron)" below.
- **Email failures never roll back a payment** — if Resend fails after a booking is confirmed, the error is logged and swallowed; the payment/booking state (already correctly committed) is not affected. There's currently no automatic retry for a failed transactional email — see "Known limitations" below.

## Local Development

```bash
npm install
cp .env.example .env   # fill in local values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Requires a local MySQL 8 server. See [.env.example](.env.example) for the exact `DATABASE_URL` format and the note on why it must stay `mysql://` (not `mariadb://`) even though the runtime driver is `mariadb`.

### Scripts

| Script                             | Purpose                                                        |
| ----------------------------------- | ---------------------------------------------------------------|
| `npm run dev`                       | Start the dev server                                           |
| `npm run build`                     | Production build (`postinstall` runs `prisma generate` first)  |
| `npm run start`                     | Run a production build                                         |
| `npm run lint`                      | ESLint                                                          |
| `npm run typecheck`                 | TypeScript, no emit                                             |
| `npm run format` / `format:check`   | Prettier write / check                                          |
| `npm test`                          | Unit + integration tests (Vitest)                                |
| `npm run test:watch`                | Vitest in watch mode                                             |
| `npm run test:e2e`                  | End-to-end tests (Playwright)                                    |
| `npm run prisma:generate`           | Regenerate the Prisma client after a schema change (also runs automatically on `npm install` via `postinstall`) |

## Environment Variables

See [.env.example](.env.example) for the full, commented list. Summary:

| Variable                    | Required | Purpose                                                                 |
| ---------------------------- | -------- | ------------------------------------------------------------------------|
| `DATABASE_URL`                | Yes      | Application MySQL connection (`mysql://` scheme)                        |
| `TEST_DATABASE_URL`           | Tests only | Separate MySQL database used by the automated test suite               |
| `AUTH_SECRET`                 | Yes      | Auth.js session/JWT signing secret                                      |
| `YOCO_SECRET_KEY`              | Yes      | Yoco Checkout API server-side key (test or live)                        |
| `YOCO_WEBHOOK_SECRET`          | Yes      | Verifies `POST /api/webhooks/yoco` came from Yoco (`whsec_...`)         |
| `YOCO_MODE`                    | No       | `test` / `live` — informational logging label only                      |
| `RESEND_API_KEY`               | Yes      | Resend API key for transactional email                                  |
| `EMAIL_FROM`                   | Yes      | Send-from address; must be on a domain verified with Resend             |
| `NEXT_PUBLIC_APP_URL`          | Yes      | Origin used to build Yoco's success/cancel/failure return URL           |
| `INTERNAL_SWEEP_SECRET`        | Yes      | Manual/external-scheduler auth for `POST /api/internal/expire-holds`    |
| `CRON_SECRET`                  | Production | Vercel-injected auth for `GET /api/internal/expire-holds` (Vercel Cron) |
| `DATABASE_CONNECTION_LIMIT`    | No       | Per-instance MySQL pool size (unset = driver default of 10; set explicitly in production) — see "Production database connections" below |

## Production Deployment (Vercel)

The production URL is `https://kwanomzilodge.co.za`.

### Overview


kwanomzilodge.co.za
        │
        ▼
     Vercel   Next.js site, booking flow, staff portal, API routes
        │
        ├──► MySQL (managed, reachable from Vercel's network)
        ├──► Yoco Checkout API + webhook (payment.succeeded / payment.failed)
        └──► Resend (staff + guest transactional email)

Vercel Cron ──(every 5 min)──► GET /api/internal/expire-holds (booking hold expiry sweep)
```

### Steps

1. Import the repository into a new Vercel project.
2. Set all required environment variables from the table above under Project → Settings → Environment Variables, scoped to **Production** (use separate test/sandbox values for **Preview**, if preview deployments are enabled).
   - `NEXT_PUBLIC_APP_URL=https://kwanomzilodge.co.za`
   - `YOCO_SECRET_KEY` / `YOCO_WEBHOOK_SECRET` — keep these as **test** credentials until the business is ready to accept real payments (see "Known limitations" — do not switch to live until deployment infra is verified end-to-end).
   - `EMAIL_FROM` — an address on a domain verified with Resend (not `kwanomzilodge@gmail.com`; that stays the staff **destination** address, set separately in [lib/content/business.ts](lib/content/business.ts)).
   - `CRON_SECRET` — generate a new random value; Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` on every cron-triggered request.
3. Point `kwanomzilodge.co.za` and `www.kwanomzilodge.co.za` at Vercel (see the exact DNS records requested separately — not applied yet).
4. Register the production webhook with Yoco against `https://kwanomzilodge.co.za/api/webhooks/yoco` and set the resulting `whsec_...` as `YOCO_WEBHOOK_SECRET`. Test-mode and live-mode webhooks are registered/secrets issued separately — re-register when switching to live.
5. Verify `kwanomzilodge.co.za` (or a subdomain of it) as a sending domain in Resend and add the SPF/DKIM records it provides.
6. Deploy. `prisma generate` runs automatically via `postinstall`.

### Booking hold expiry (cron)

[vercel.json](vercel.json) defines a Vercel Cron job:

```json
{ "path": "/api/internal/expire-holds", "schedule": "*/5 * * * *" }
```

This calls `GET /api/internal/expire-holds` every 5 minutes, which expires any `PAYMENT_PENDING` booking whose hold has passed (releasing its room nights) via `expireStaleHolds()`. The request is authenticated by Vercel automatically sending `Authorization: Bearer <CRON_SECRET>` — see [app/api/internal/expire-holds/route.ts](app/api/internal/expire-holds/route.ts).

**Vercel plan requirement:** cron jobs running more often than once a day require a **Pro** (or higher) plan — the Hobby plan only permits daily-or-less-frequent schedules. This project needs sub-daily execution (default hold length is 15 minutes; a daily sweep would leave rooms falsely blocked for up to ~24 hours after an abandoned checkout). Confirm the Vercel project is on Pro before relying on this cron; if staying on Hobby, use an external scheduler (e.g. a third-party cron pinger) calling `POST /api/internal/expire-holds` with the `x-internal-secret` header instead.

The endpoint can also be triggered manually at any time:

```bash
curl -X POST https://kwanomzilodge.co.za/api/internal/expire-holds \
  -H "x-internal-secret: $INTERNAL_SWEEP_SECRET"
```

### Production database connections

Vercel functions run as multiple concurrent serverless instances rather than one long-lived server process. Each warm instance holds its own MySQL connection pool (`DATABASE_CONNECTION_LIMIT`, unset by default — see [lib/db/prisma.ts](lib/db/prisma.ts)), so the total connection count against the database scales with traffic. Before going live, check the production MySQL server's `max_connections`, and set `DATABASE_CONNECTION_LIMIT` in the Vercel Production environment (e.g. `3`) if it needs a tighter per-instance cap — `max_connections` should comfortably exceed `DATABASE_CONNECTION_LIMIT × expected concurrent instances`.

## Known limitations

- **No automatic retry for a failed transactional email.** If Resend fails after a payment is confirmed (or after a hold expires), the booking/payment state is correct but the guest or staff email is simply not sent; the failure is only visible in server logs. There is currently no dead-letter queue or retry mechanism.
- **`YOCO_MODE` / test vs. live credentials.** Switching to live payments is a deliberate, separate step (swap `YOCO_SECRET_KEY`, re-register the production webhook, update `YOCO_WEBHOOK_SECRET`) — not part of initial deployment.

## Project Structure

```
/app
  /(guest)/...     guest-facing pages (public): browse rooms, book, manage booking
  /staff/...       staff portal pages — dashboard, bookings, calendar, rooms, guests, settings (auth-gated via proxy.ts)
  /api/...         route handlers (bookings, availability, payments, webhooks, auth, internal)
/lib
  /services        domain/business logic (BookingService, PaymentService, WebhookService, ...)
  /yoco            Yoco webhook signature verification
  /email           Resend client, templates, template data mappers
  /db              Prisma client singleton (mariadb driver adapter)
  /validation      Zod schemas shared between client and server
  /auth            password hashing helpers
  /generated       Prisma client output (generated via `prisma generate`, gitignored)
auth.ts            Auth.js configuration
proxy.ts            Next.js 16's middleware equivalent — gates /staff/* behind a session
/prisma
  schema.prisma     data model
  migrations/       Prisma migrations
  seed.ts           seed script
/components         shared UI components
/tests
  /unit             Vitest
  /integration      Vitest, exercises real logic against TEST_DATABASE_URL
  /e2e              Playwright
```
