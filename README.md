# Hourly — Volunteer Time-Tracking API

Backend API for a mobile app that lets volunteers record time for a volunteer
organisation. A volunteer submits entries from the phone; a coordinator or
administrator reviews them according to the organisation's policy.

> **Note:** this README was written by Buffy, the Codebuff coding agent, from
> `DESIGN_DOC.md`. A human-written README will replace it soon.

## Status: design phase

There is no application code yet — no `src/` directory, no routes, no database
schema in the repo. `DESIGN_DOC.md` (≈8,700 lines) is the project's only source of
truth: a living decision record, not a finished API specification. It holds
decisions D-001–D-075, the outstanding-decisions list maintained at the head of
§16, and a backlog of gaps never yet raised as B1–B20 in §17.

Read the design doc before writing any code. Most of what follows is a summary of
it; where the two disagree, the doc wins.

## Stack

| Concern | Choice |
|---|---|
| Language / runtime | TypeScript, Node.js 22 (`.nvmrc` pins v22.20.0) |
| HTTP framework | Express 5 |
| Modules | ESM (`"type": "module"`), path alias `#*` → `./src/*` |
| Database | PostgreSQL, one database per instance (D-069): add-fill-remove migrations behind a schema-version guard, a boot-time advisory lock, five performance indexes and four uniqueness constraints; per-table constraints are in §16.37 |
| Tests | Vitest (with `@vitest/coverage-v8`) |
| Lint / format | ESLint 10 + typescript-eslint, Prettier |

```bash
npm install
npm run dev          # tsx --watch src/index.ts
npm run build        # tsc -p tsconfig.build.json
npm run type-check   # tsc --noEmit
npm run lint
npm run test:run     # vitest --run
```

`package.json` still declares `ISC` while `LICENSE` is GPL-3.0; the licence file
is authoritative.

## Deployment model

- **Each organisation runs its own instance and database.** The deployment is the
  tenant: identity is scoped to it and no organisation identifier appears in the
  API (D-050).
- **The only client is a native mobile app.** Every business route uses a bearer
  token; no cookies, no CORS, no browser session (D-056).
- Routes are versioned with a `/v1` prefix.

## Domain model in one pass

- **`User` and `Membership` are separate.** Membership carries the role: `volunteer`
  or `administrator`. Coordination is not a role — it is a `project_coordinators`
  grant on a specific project, and never an assignment type (D-051, D-070).
- **Project → Activity.** Projects are archived rather than deleted, and archive is
  reversible; volunteer assignments end at the archival instant and are not restored
  (D-041–D-043). An entry stores no `project_id` — its activity is its project claim,
  and `projectId` is derived on read (D-070).
- **Assignments are explicit.** No project time without one, and project-less entries
  are allowed only with a written description.
- **No server-side timer.** The MVP has no timer resource or route; timing is a
  device-side stopwatch whose output is a pre-filled manual entry (D-048).
- **An entry** carries a client-generated UUID, an integer `version`, either
  `startedAt`/`endedAt` (UTC instants, second precision) or a work date plus
  `durationMinutes`, and a stored `durationSeconds`. Between 60 seconds and 24 hours;
  may cross midnight; one organisation time zone interprets local dates (D-046). The
  list order and date filters read a stored `local_anchor`, not a per-read derivation
  (D-069).
- **One status field**, `approvalStatus`: `pending`, `approved`, `rejected` or
  `not_required`, set at submission and changed only by a decision, a resubmission or
  a material edit. Drafts live on the device and never reach the server. Deletion is
  `deletedAt`/`deletedBy`/`deleteReason`, not a fifth status (D-044, D-058, D-063).

## Conventions already settled

- **Errors** use the custom envelope with a machine-readable `code` (§16.4), e.g.
  `409 VERSION_MISMATCH`, `409 DATE_NOT_ELIGIBLE`, `409 INVALID_TRANSITION`,
  `400 DATE_IN_FUTURE`, `401 UNAUTHENTICATED`, `413 EXPORT_TOO_LARGE`.
- **Lists** all share `{ items, nextCursor, pageSize }` with a fixed keyset order and
  an opaque signed cursor; no `total` in any list body (D-037, D-038, D-040, D-054).
- **Writes** return the changed resource; creates are `201` + `Location`, replays
  `200`, and deletion is the only `204`. No mutation returns counts (D-055).
- **Concurrency**: optimistic on `version`; a stale write gets `409` with `current`
  and `changedFields` and is re-applied by hand (D-049, D-061).
- **Auth**: 30-minute access token, single-use rotating refresh token with a 120-second
  replay grace, 90-day idle / 180-day absolute limits, revocation effective on the next
  request (D-056).
- **Load control**: 300 requests/min per user, 60/min per address, 1 MiB body cap,
  server-minted `X-Request-Id` on every response (D-053).
- **Also specified**: an insert-only audit trail (`GET /v1/audit-log`, D-067), in-app
  notifications written in the act's own transaction (D-068), a change feed at
    `GET /v1/sync` keyed by a per-organisation `changeSeq` (D-064), and self-service
export at `GET /v1/me/export` (D-052).
- **Import**: `POST /v1/imports` takes a CSV of time entries against members,
  projects, activities and assignments that already exist. Administrators only;
  every row is checked by the routes' own rules; the whole file applies or none of
  it does, with a dry run; duplicates are refused by file fingerprint and by content;
  one `import` audit row records the file and none per row (D-075).
- **Erased members** are pseudonymised, not deleted: the user row becomes
  "Former member" at one sentinel address while the work and its history stay intact
  (D-071).
- **Reports** count `approved` and `not_required` entries, summed at read time with
  weeks starting Sunday; the report route takes `format=json|csv`, streaming at most
  100,000 rows and refusing anything larger before the first byte (D-066, D-074).
- **Retention**: sessions are deleted 30 days after they end; notifications a month
  after being read, or at the organisation's mailbox window when unread (1–24 months,
  default 12). The record and the audit trail are never deleted. A daily in-process
  sweep at 03:00 organisation time enforces it (D-072, D-073).

## Still open

- **Contract drafting itself** — §17's backlog is closed again, so the remaining work
  is §15.12 item 29: endpoint paths, HTTP methods, DTOs, validation rules and error
  codes.
- **B3 — timer semantics**: deferred, not resolved; it returns only if a server timer
  is added back.
- **§15.12 items still open**: one assignment resource or two (15), assignment-departure
  effects on in-flight items (16), assignment-boundary timestamps (17), membership
  revocation and restore (18), project-less description vs. notes (22), required
  profile fields and email-change verification (23), policy changes on pending
  assignment requests (24, partially), the sign-in credential itself (26, partially),
  the first-administrator bootstrap (27), and the `/v1` compatibility and deprecation
  policy (31, partially).
- **Deliberately deferred**: counting for UI elements (unread notifications, pending
  requests).

---

Written by Buffy (the Codebuff coding agent) from `DESIGN_DOC.md` at commit
`6f226e7`. No code has been reviewed against this summary.
