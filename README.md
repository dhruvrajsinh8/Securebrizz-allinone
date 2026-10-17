# SecureBiz

A passive web security scanner with a dashboard. Point it at a domain and it
reports what an ordinary browser can observe — TLS, HTTP headers, cookies, DNS
and email records, page content, and whether the site looks like an
impersonation of a known brand.

**Passive by design.** The scanner requests the page the way a browser would and
reads public DNS and Certificate Transparency records. It sends no payloads, does
no port scanning, and never attempts an exploit. Scan sites you own or have
permission to test.

## What it checks

| Area | Looks at |
|---|---|
| **Site authenticity** | Lookalike domains, homoglyphs, punycode/IDN, risky TLDs, brand mentions on the wrong domain, urgency language, login forms on unverified certificates |
| **Transport** | Certificate validity, chain, hostname match, expiry, protocol and cipher, HSTS |
| **Headers** | CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| **Cookies** | Secure, HttpOnly, SameSite |
| **DNS & email** | SPF, DMARC, DNSSEC, CAA, MX — the records behind domain spoofing |
| **Content** | Mixed content, subresource integrity, disclosed paths, technology fingerprinting |
| **Attack surface** | Subdomains from public Certificate Transparency logs |

## Scoring

Every scan starts at **100** and subtracts points per finding:

| Severity | Cost |
|---|---|
| Critical | −25 |
| High | −12 |
| Medium | −6 |
| Low | −2 |

Two rules keep the number honest:

- **Repeats cost less.** Within a category only the first finding is charged in
  full; the next count for 60%, 35%, then 20%. One weak area cannot sink the score.
- **Failed checks never deduct.** A lookup that could not complete is excluded
  rather than counted against you — the Checks tab shows real coverage.

Grades: `A+ ≥95 · A ≥85 · B ≥75 · C ≥65 · D ≥50 · F <50`

The site-authenticity verdict is scored separately and reads the other way —
there, a *higher* number means *more* suspicious. A legitimate site with sloppy
headers can score poorly on security while showing zero phishing risk.

## Getting started

Requires Node 20+ and a Postgres database (Neon works well).

```bash
npm install
```

Copy the environment template and fill it in:

```bash
cp .env.example .env
```

`DATABASE_URL` and `DIRECT_URL` come from your Postgres provider. Generate an
auth secret with:

```bash
openssl rand -base64 32
```

Create the schema and seed demo accounts:

```bash
npx prisma db push && npm run seed
```

Then start the dev server:

```bash
npm run dev
```

Open http://localhost:3000. The login screen offers two demo accounts.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run seed` | Seed demo users and data |
| `npm run scan` | Run a scan from the command line |

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection (host contains `-pooler`) |
| `DIRECT_URL` | Direct connection, used for migrations |
| `AUTH_SECRET` | Signs session cookies. 32+ characters. Required in production |
| `ALLOW_LOCAL_SCAN` | Permit scanning localhost. Keep `false` in production |
| `SCAN_LIMIT_USER` | Scans per user per window |
| `SCAN_LIMIT_WINDOW_MINUTES` | Rate-limit window |
| `SCAN_LIMIT_USER_DAILY` | Daily per-user cap |
| `SCAN_LIMIT_IP` | Per-IP cap |
| `AUTH_LIMIT_EMAIL` | Failed sign-ins per account before lockout (default 5) |
| `AUTH_LIMIT_IP` | Failed sign-ins per IP before lockout (default 20) |
| `AUTH_LIMIT_WINDOW_MINUTES` | Sign-in lockout window (default 15) |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma + Postgres ·
Tailwind CSS v4 · Radix UI · Recharts · Zod

## Security

The scanner fetches URLs that callers supply, which makes a few protections
load-bearing rather than optional:

- **SSRF guard.** Hostnames are resolved and the *answer* is checked, so a
  public name pointing at `127.0.0.1` or the cloud metadata address
  (`169.254.169.254`) is refused. Loopback, RFC1918, carrier-grade NAT,
  link-local and multicast ranges are all blocked, in IPv4, IPv6 and
  IPv4-mapped-IPv6 form — and the check runs again on **every redirect hop**,
  not just the first request.
- **Sign-in throttling.** Failed attempts are counted per account and per IP;
  exceeding either returns `429` with `Retry-After`. A correct password clears
  the account's failure history, so a legitimate mistype cannot lock anyone out.
- **Revocable sessions.** The session cookie is an HMAC-SHA256 token bound to a
  `Session` row. Deleting that row invalidates the cookie on the next request,
  which is what makes "sign out this device" real rather than cosmetic.
- **Scan rate limits.** Recorded in the database, so they hold across serverless
  instances and double as an abuse audit trail.

## Testing

```bash
npm run test
```

Vitest covers the logic where a silent regression would be most costly: the SSRF
guard, the scoring model, session token signing and expiry, the phishing
heuristics (including the false-positive guards), and the scan persistence
round-trip. CI runs typecheck, lint, tests and a production build on every push.

## Limitations

The authenticity verdict is a heuristic pattern check, not a certified ruling.
It has no reputation feed and no takedown history, so it can be wrong in both
directions — a brand-new legitimate domain may look suspicious, and a careful
forgery may not. Treat it as one signal. The reliable habit is still to type the
address yourself rather than following a link, and to check the domain before
entering a password.
