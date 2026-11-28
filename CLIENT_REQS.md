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
uniqueness are the server's, and the app must not apply its own test. A `409
EMAIL_IN_USE` shows "That address is already registered here. Ask an
administrator to add you." — and does not immediately invite a second address, so
a squatter's conflict is read rather than typed past.

9.6 A `403 JOIN_CLOSED` shows "This code has closed. Ask your coordinator for a
new one." It is a closed door, not an authentication failure, and must not be
styled as one.

9.7 A `5xx`, a timeout or no network leaves the form populated and offers a retry
with the same ticket. Admission is counted only when the server answered, so a
retry either succeeds or reports the door closed.

9.8 The Waiting screen is a real session: it survives a restart, appears in the
device list, and refreshes on foreground. It must reach no other screen — no
tabs, no empty lists, no "0 hours" — and must not poll faster than foreground.

While the membership is pending, every business route answers `403
MEMBERSHIP_PENDING` with the organisation's name in `details` (§16.46 rule 5).
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
13. Register a second account with the same address and confirm `409
    EMAIL_IN_USE` with the message of 9.5.
14. Let a ticket expire, then register and confirm `403 JOIN_CLOSED`, styled as a
    closed door rather than a failed sign-in.
15. Leave an application unapproved past its window and confirm the app is refused
    on refresh and returns to the Join screen.
