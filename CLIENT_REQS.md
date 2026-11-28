# Client requirements — enrolment and sessions

**Status:** 28 November 2026. Derived from D-078 (§16.45), D-079 (§16.46) and the session model
D-056 (§16.23). These are requirements on the native mobile app, which is the
MVP's only client (§2.1). Where a requirement restates a rule in the design
record, the rule is the authority and this file is the checklist for whoever
builds the app.

## Scope

The volunteer's app is enrolled once per device and then holds a session. There
is a second way in, added by D-079: a person with no account at all scans a join
ticket in a room, registers themselves, and waits for approval on a session that
reaches nothing until then (C9). The address they type is the only one the
product ever collects, and the instance still sends nothing to it. There
is no password field anywhere in the product, no sign-in screen, no "forgot
password", no email is sent by the instance, and no third-party identity service
is contacted.

## C1 — First run: address

1.1 The app ships with no server address and no directory of servers. The
address comes from the enrolment QR, or is typed by the person.

1.2 Before any credential is sent the app **displays the host** it is about to
contact and requires an explicit confirmation. This is §16.17's rule and it is
not optional.

1.3 An address that does not answer, or answers and is not Hourly, is an
onboarding failure with its own message. It is never reported as an
authentication failure.

1.4 HTTPS only, with a single `http://localhost` exception for development. The
app refuses a redirect to a different host on an authenticated request.

## C2 — Enrolment

2.1 Two paths, equal in standing:

- **Scan.** The app's own camera reads the enrolment QR and extracts both the
  host and the code.
- **Type.** Twelve characters accepted case-insensitively, with `I`/`L` read as
  `1`, `O` as `0` and `U` as `V`, hyphens and spaces ignored, paste accepted.

2.2 The confirmation screen shows **the host and the person's display name**
before the code is sent: "Sign in as Dee Okafor at pantry.example". This is the
app's defence against a mislaid or shoulder-surfed printout and is required.

2.3 `POST /v1/auth/enrol` carries `{code, deviceLabel}`. The `deviceLabel` is
something a person would recognise in a device list — "Pixel 8 — Dee", not an
opaque identifier.

2.4 A `401` from the enrolment route shows one message covering every cause
(spent, expired, unknown): "That code cannot be used. Ask your coordinator for a
new one." The app must not attempt to distinguish the causes, because the server
does not.

2.5 A failure that is not a `401` (no network, timeout, `5xx`) leaves the grant
**unspent** and offers retry with the same code. The app must not discard the
code on a transport failure.

2.6 A `429` is shown as "Too many attempts; wait and try again", with the
`Retry-After` delay respected.

## C3 — The QR the app draws

3.1 Rendering a QR is required in two places: an administrator issuing a grant
for someone else, and a volunteer issuing one for their own additional device.

3.2 Payload: `hourly-enrol:1?host=<host>&code=<code>`. The server returns the
host and code; the app renders the image. No server-side image generation, no
PDF, no print pipeline.

3.3 The issuing screen offers a share sheet and, where the platform supports it,
printing. A coordinator will photograph the screen and send it over a messaging
app whether or not that is designed for; the screen should say plainly that the
code is single use and expires in 48 hours.

## C4 — Token storage

4.1 iOS: Keychain item with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, under
a dedicated service and account. Never `UserDefaults`, never a file, never a log
line, never a crash report.

4.2 Android: Keystore-backed storage (an authentication-required Keystore key
wrapping the token, or the platform's encrypted preferences).

4.3 **Excluded from backup.** Android: `android:fullBackupContent` and, for
Android 12 and later, `dataExtractionRules` excluding the token store. iOS: the
`ThisDeviceOnly` accessibility class is what keeps the item out of encrypted
backups and iCloud Keychain.

4.4 **Fresh-install detection.** iOS Keychain items survive app deletion. The app
writes a marker to ordinary storage (which is removed on uninstall) and, finding
no marker at first launch, deletes any token left in the Keychain. Without this,
"delete the app" does not sign a volunteer out, and a handed-on phone resumes the
previous person's session.

4.5 A token restored onto a device by any means must end in a clean signed-out
state, never a half-authenticated one. A `401` on the first refresh after restore
clears storage and shows the enrolment screen.

## C5 — Sessions

5.1 The session response is handled by the same token pipeline as a refresh.
There is one code path for "tokens arrived", not two.

5.2 Refresh is single-flight: concurrent `401`s produce one refresh, never
several. Rotation is single use, and a replay of a spent token inside the
server's grace window returns the same pair rather than ending the session.

5.3 Refresh on foreground, not on a timer.

5.4 A `401` during sync pauses the queue and preserves it (§7.1). Nothing queued
is discarded because a session ended.

5.5 The app shows the idle and absolute limits where a person would look for
them, and warns before re-enrolment is needed — the absolute limit is 400 days
and is not extended by use.

## C6 — Device list

6.1 `GET /v1/auth/sessions` is a first-class screen: device label, created,
last refreshed, and which entry is the current device.

6.2 `DELETE /v1/auth/sessions/{id}` ends one, with confirmation. This is the only
lever on a lost phone, so it must be reachable in two taps from the app's home
surface, not buried in settings.

6.3 Signing out locally is the same act applied to the current session.

## C7 — Administrator screens

7.1 Issue a grant for a member: shows the QR, the twelve characters, the expiry,
and the person's name.

7.2 List un-redeemed grants with their expiry and issuer, and cancel one.

7.3 Membership approval and grant issue are one flow for a known person: an
administrator does not approve a membership and leave someone unable to enrol.
**Amended 28 November 2026 (D-079, §16.46):** on the room path the order is
reversed and the person enrols first, so 7.3 is satisfied by the pending session
they already hold — approval is what unlocks it, and no grant is issued.

7.4 Batch issue for an intake is not built: an intake uses a join ticket and
self-registration (C9), which needs no per-person grant at all. Grant batching
would serve only an organisation that insists on issuing twenty single-use
codes, and §16.46 records that answer as no.

### The join ticket, from the administrator's chair

The volunteer's half of this flow is C9; this is the half that has to work at the
front of a room, on a projector, with twenty people looking at it.

7.5 **Opening one is one screen and two numbers.** Headcount, defaulting to 20
and capped at 100, and a life defaulting to 1 hour and selectable from 10 minutes
to 4 hours (§16.46 rule 2). The app refuses to send a request outside those
ranges rather than letting the server refuse it, and shows both numbers back
before the ticket exists. `POST /v1/join-tickets` answers with the ticket: `id`,
`code`, `host`, `expiresAt`, `maxUses`.

7.6 **Showing it is the point.** The QR is full-screen, high contrast, and large
enough to scan from the back of a room; the twelve characters sit beneath it in
three groups of four, for the person whose camera will not focus. The screen
states the headcount and the closing time in words — "20 places · closes 20:30" —
and a countdown, because "1 hour" means nothing once it is on a wall. The wake
lock is held while it is displayed. The payload is the `hourly-join:1` form of
§16.46 rule 3, rendered by the app from the server's fields: host, then ticket. No
server-side image, no PDF, no print pipeline (C3.2).

7.7 **The roll fills in, and the administrator watches it.** Below the QR, a live
list of registrations: display name, address, device label, and the time. It
refreshes by polling while the screen is in the foreground and no faster than
every 5 seconds; there is no push channel and no notification type for a
registration (§16.46 rule 12). Approving is one call per person (§16.46 rule 7);
"approve all shown" issues them sequentially and reports a failure against the row
it belongs to, never as one toast for twenty. Deleting an application is available
on the same row and is how a name the administrator does not recognise is handled.

7.8 **Revoking closes the door and nothing else.** `DELETE /v1/join-tickets/{id}`
answers `204`, after a confirmation that names the consequence: no one else can
register with this code, and the people already on the roll stay on it. A revoked
ticket cannot be reopened — a second evening gets a second ticket (7.10) — and the
screen switches to a closed state that keeps the roll readable and approvable.

7.9 **What this screen must not do.** It must not edit a registrant's address: the
person typed it, and an administrator who believes it is wrong deletes the
application and asks them to register again, which is the only path that does not
put words in someone's mouth. It must not approve a row showing no address. It
must not offer "regenerate the code": that is revoke and open, and hiding it
behind one button hides that the old slide stopped working.

7.10 **Offline.** Opening or revoking a ticket needs the network. Showing one that
is already open does not: the QR and its expiry are held locally, and the screen
says plainly that it cannot see new registrations until it reconnects, rather than
showing a stale roll as if it were current.

7.11 **What a row says.** Five states, and only the first carries both actions:

- **Pending** — display name, address, device label, time; Approve and Delete.
- **Approved** — the row stays until the screen is closed or the ticket ends,
  marked with the decision and its time, and with no actions left on it.
  Approving is not a removal: the administrator has to be able to see that the
  person got in, or the natural next move is to approve them again.
- **Already a member** — a pending row whose person holds an active membership
  here, which happens when someone approved them from another device, or when a
  rejoin landed while the application sat unapproved. The server refuses the
  *registration* itself with `409 ALREADY_A_MEMBER` (§16.46 rule 11), so this row
  only ever appears when the membership became active after the person registered.
  The row is marked, Approve is disabled and says why, and Delete is the only
  action. **It must not read as a failure**: nothing went wrong, the roll has
  caught up with the organisation.
- **Rejected leaves no row.** Rejection is a deletion, not a state (§16.46 rule 6),
  so there is no "rejected" badge to render: the row leaves the list, and the
  confirmation says plainly what happened — the person is not a member, nothing of
  theirs was stored, and they may register again with the same address, which was
  released by the same transaction. An administrator who rejects by mistake
  reopens the door rather than undoing a state, and the screen must not offer an
  undo it cannot honour.
- **Expired** — a pending row swept at 30 days (§16.39 rule 12) simply stops
  appearing. The app does not invent a tombstone for it, and the ticket's own
  expiry shows as the closed state of 7.8.

7.12 **Every refusal this screen can receive.** An administrator's actions are
privileged writes, so each code has one reading and one response; none of them is
retried blindly.

| Code | What it means here | What the screen does |
|---|---|---|
| `400 VALIDATION_FAILED` | The app sent something the contract forbids: a headcount over 100, a life outside 10 minutes to 4 hours, a status other than `active` | A client bug. Show the field errors from `details.errors`; never a generic failure |
| `401 UNAUTHENTICATED` | The session ended mid-ticket | Sign out and re-enrol (C2). Unsent approvals are lost, which is right: a decision needs a live administrator |
| `403 FORBIDDEN` | Not an administrator, or the row is outside the caller's scope | Remove the controls after it. Retrying cannot help and the screen should not have offered them |
| `404 NOT_FOUND` | The row is stale: deleted, swept, or decided on another device | Refresh silently and drop the row. No error, no toast |
| `409 ALREADY_A_MEMBER` | Returned to the **volunteer**, never to this screen | Never surfaces here. If the org state changed, the roll shows the "already a member" row of 7.11 |
| `409 INVALID_TRANSITION` | Someone else already decided — approved on another device, or the application was swept — or a grant was cancelled after it was redeemed | Refresh the row; it becomes approved or disappears. Do not retry the same write |
| `429 RATE_LIMITED` | Expected during "approve all shown" | Respect `Retry-After`, continue with the remaining rows, and leave the throttled ones undecided. A `429` must never abort the run |
| `413 PAYLOAD_TOO_LARGE` | An import or an export, not this screen | Should be unreachable; treat as a bug and report it |
| `500`, `503` | The decision did not happen | Keep the row, offer retry, and never mark it approved optimistically |

## C8 — Camera and permissions

8.1 Camera permission is requested at the moment of scanning, with a sentence
explaining that it is used only to read the enrolment code.

8.2 Denial, a broken camera, or an old device without a working autofocus must
fall through to the typed path without a dead end.

8.3 The store listing declares camera use for enrolment only. There is no photo
capture, no file access and no other permission added by this feature.

8.4 **No deep links.** The QR is scanned inside the app. A custom URL scheme is
squattable, and a universal link would require associated domains on a hostname
the app cannot know in advance — the same constraint that rules out passkeys.

## C9 — Joining a room

9.1 Three screens: **Join** (organisation name, host and expiry, read from
`GET /v1/join-tickets/{id}`), **Register** (display name, email, device label),
and **Waiting** (organisation name, the person's own name, and who they are
waiting for).

9.2 The scanner accepts both payloads and distinguishes them by scheme:
`hourly-enrol:1` is a grant for one device, `hourly-join:1` is a door. Sending a
join ticket to the enrolment route, or a grant to the join route, is an app bug
and not a message to show.

9.3 The Join screen shows the organisation name and host **before** the form
appears, under §16.17. A host in the payload that differs from the host actually
contacted is refused, never confirmed.

9.4 Registration sends `{ticket, displayName, email, deviceLabel}` to
`POST /v1/auth/join`. The display name is the person's own and may be corrected by
an administrator afterwards; the app must not prefill it from the device account,
which on a shared phone belongs to somebody else.

9.5 The email is validated only as non-empty with one `@`. Normalisation and
uniqueness are the server's, and the app must not apply its own test. A
`409 EMAIL_IN_USE` shows "That address is already registered here. Ask an
administrator to add you." — and does not immediately invite a second address,
so a squatter's conflict is read rather than typed past.

9.6 A `403 JOIN_CLOSED` shows "This code has closed. Ask your coordinator for a
new one." It is a closed door, not an authentication failure, and must not be
styled as one.

9.7 A `5xx`, a timeout or no network leaves the form populated and offers a retry
with the same ticket. Admission is counted only when the server answered, so a
retry either succeeds or reports the door closed.

9.8 The Waiting screen is a real session: it survives a restart, appears in the
device list, and refreshes on foreground. It must reach no other screen — no
tabs, no empty lists, no "0 hours" — and must not poll faster than foreground.

While the membership is pending, every business route answers
`403 MEMBERSHIP_PENDING` with the organisation's name in `details` (§16.46
rule 5).
**That answer is the Waiting screen's normal state, not an error.** The app must
not show a failure message, must not retry the refused request in a loop, must not
clear the token store, and must not return to the Join screen. The distinction is
carried by `code` alone, because `403` is shared with `FORBIDDEN`: a `403` with
any other code is an error under C1's rules, and a `401` follows 9.10. A client
that branches on the status instead of the code will show a volunteer a network
failure on a screen that is working exactly as designed.

9.9 Approval is discovered, not pushed: on the next foreground refresh the app
sees an active membership and shows the organisation. There is no notification to
receive and none to wait for.

9.10 A rejected or expired application ends the session with a `401`. The app
clears storage and returns to the Join screen with a neutral message: the person
did nothing wrong.

9.11 The form's fields leave memory and logs when the request completes. The
address is never written to the token store, a file, a log line or a crash
report; only tokens go to the Keychain (C4).

9.12 The QR an administrator draws for a join ticket uses `hourly-join:1` and
states the headcount and the expiry on the screen, as C3.3 requires of a grant.

## C10 — Non-requirements

- No password entry, change or reset screen; no credential storage of any kind.
- No open self-registration screen. The Join screen exists only behind a join ticket; an address alone reaches nothing.
- No email sending or address verification.
- No second factor, no recovery codes.
- No WebAuthn, no associated-domains entitlement, no third-party identity SDK.
- No server-rendered QR images.

## C11 — Acceptance checks

These are the assertions that prove the feature, not a substitute for a test
suite:

1. Scan a QR, confirm the host and name, and land in the app with a working
   session.
2. Type the same code with lower case and hyphens removed, and succeed.
3. Reuse a spent code and see the single "cannot be used" message.
4. Kill the network mid-enrolment, restore it, retry the same code, and succeed
   without a new grant.
5. Force an Android backup and restore onto a second device: the app must be
   signed out, not signed in.
6. Delete and reinstall on iOS: the app must be signed out.
7. Deny the camera: the typed path completes enrolment.
8. Let an access token expire while offline with entries queued: after a
   successful refresh the queue drains and nothing is lost.
9. End a session from the device list and confirm the other device is refused on
   its next request.
10. Issue a grant as an administrator, cancel it, and confirm redemption now
    fails with the same `401`.
11. From a fresh install, scan a join QR, register, and land on the Waiting
    screen rather than the app. Before approval, every business route must answer
    `403 MEMBERSHIP_PENDING`, and the app must render that as 9.8's waiting state —
    no error, no Join screen, no cleared tokens — surviving a relaunch.
12. Approve the membership from the administrator's device, and confirm the
    volunteer's next foreground refresh shows the organisation with no re-login
    and no second scan.
13. Register a second account with the same address and confirm
    `409 EMAIL_IN_USE` with the message of 9.5.
14. Let a ticket expire, then register and confirm `403 JOIN_CLOSED`, styled as a
    closed door rather than a failed sign-in.
15. Leave an application unapproved past its window and confirm the app is refused
    on refresh and returns to the Join screen.
16. Open a ticket with 20 places and one hour: the QR displays and stays scannable
    with the network off, the payload scheme is `hourly-join:1`, and headcount and
    closing time appear in words beside a running countdown.
17. With the ticket on screen, register two people: both appear on the roll within
    one poll interval with name, address, device label and time, and neither needs
    a manual refresh.
18. Approve one row and confirm that person's app shows the organisation on next
    foreground while the other stays pending. Then use "approve all shown" and
    confirm one request per person, with a forced failure on a single row reported
    against that row only.
19. Revoke the ticket: a further registration gets `403 JOIN_CLOSED`, the two
    people already on the roll can still be approved, and the screen shows closed
    while keeping the roll readable.
20. Ask for 101 places and for a five-hour life: the form refuses both before any
    request is sent, and the server refuses a forced request with
    `400 VALIDATION_FAILED`.
21. Approve one row, then approve the same row again from a second administrator
    device: the second call gets `409 INVALID_TRANSITION`, the row reads approved,
    and no error is shown.
22. Register a person, approve them from another device, then look at the first
    device's roll: the row reads "already a member" with Approve disabled and its
    reason, and Delete available.
23. Delete a pending row: it leaves the roll at once, the confirmation says the
    person is not a member and may register again, and the same address then
    registers successfully a second time.
24. Run "approve all shown" across three rows with one forced `429` and one forced
    `404`: the run continues, the throttled row stays undecided, the missing row
    disappears, and the third is approved.
