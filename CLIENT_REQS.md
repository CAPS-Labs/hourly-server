# Client requirements — enrolment and sessions

**Status:** 28 November 2026. Derived from D-078 (§16.45) and the session model
D-056 (§16.23). These are requirements on the native mobile app, which is the
MVP's only client (§2.1). Where a requirement restates a rule in the design
record, the rule is the authority and this file is the checklist for whoever
builds the app.

## Scope

The volunteer's app is enrolled once per device and then holds a session. There
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

7.3 Membership approval and grant issue are one flow: an administrator does not
approve a membership and leave the person unable to enrol.

7.4 Batch issue for an intake is desirable but not required for the MVP.

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

## C9 — Non-requirements

- No password entry, change or reset screen; no credential storage of any kind.
- No self-registration screen.
- No email sending or address verification.
- No second factor, no recovery codes.
- No WebAuthn, no associated-domains entitlement, no third-party identity SDK.
- No server-rendered QR images.

## C10 — Acceptance checks

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
