# Hourly - Volunteer Time-Tracking API

## Design Decision Record and Structural Specification

**Document status:** Living design record --- not a finalized API
contract\
**Version:** 0.1\
**Prepared:** 25 October 2026\
**Audience:** Project owner and future implementers\
**Scope:** Structural decisions made during API-design discussions,
accepted recommendations, provisional proposals, and unresolved
questions.

------------------------------------------------------------------------

## 1. Purpose and status conventions

This document records the decisions made so far for a mobile application
that lets volunteers record time for volunteer organizations. It is
intended both as a durable record of design reasoning and as a practical
reference for future API, database, and client implementation.

It is **not** a complete API specification. Exact routes,
request/response schemas, database migrations, authentication flows,
error formats, and the full synchronization protocol have not yet been
finalized.

### 1.1 Decision-status labels

Each item is marked using these labels:

-   **Confirmed decision** --- explicitly chosen by the project owner.
-   **Accepted recommendation** --- a recommendation was explicitly
    accepted.
-   **Provisional proposal** --- suggested during discussion but not yet
    accepted or fully specified.
-   **Open question** --- a decision remains to be made.
-   **Deferred** --- intentionally postponed until a later design stage.

A recommendation is not treated as a settled requirement merely because
it appears in this document. Where a rule has a confirmed default but is
intended to be configurable, both facts are recorded.

### 1.2 Important design principle

The API server is authoritative for access control, validation, policy
enforcement, and final synchronization decisions. The mobile app can
validate inputs and record work while offline, but client-side checks do
not replace server-side enforcement.

------------------------------------------------------------------------

## 2. Product scope and architecture

### 2.1 Product purpose

**Confirmed decision:** The product is a time-tracking app for volunteer
organizations. A mobile app records time and synchronizes records with a
central server for the relevant organization.

**Confirmed 24 November 2026 (D-056, §16.23) — the MVP has one client, the native mobile app.** No browser client is planned for the MVP and the API is not designed for one. Every client constraint in this record is therefore a phone's constraint: a device that is carried, that loses signal, that locks and unlocks, and whose storage is the operating system's secure store. The consequences are recorded where they bite — no cookie, no CSRF protection and no CORS headers (§16.23), tokens in the Keychain or Keystore (§16.23), and a sync queue that survives a rejected sign-in (§7.1). A browser client later is an additive decision, not a change to this one.

The MVP supports: - Manual time entries, in both established forms:
exact start and end timestamps, or a work date plus total duration. - A
device-local stopwatch that times work and pre-fills a timestamp entry,
which the volunteer may edit and submit. - Project and activity
categorization. - Project-less time entries under a
description requirement. - Offline recording and later
synchronization. - Volunteer, coordinator, and
organization-administrator roles. **Amended 23 November 2026 (D-051,
§16.18):** the roles are volunteer and administrator only; coordination is
a per-project grant, not a role. - Configurable organization-level
policies for selected workflows.

**Amended 22 November 2026 (D-048, §16.15):** timer-based entries are
out of the MVP. There is no server-side running timer, no timer start or
stop route, and no timer state on the server. The stopwatch runs on the
device and produces a pre-filled manual entry; everything the server
receives is a submitted manual entry.

### 2.2 Server and database per organization

**Confirmed decision:** Each organization has its own server and
database.

Consequences: - An organization's API and database form its own
operational boundary. - A request is made against the relevant
organization's server. - The server validates authorization against that
organization's data and current policies. - Provisioning, deployment,
upgrades, monitoring, backup, and recovery may need to be repeated or
automated per organization. - A central identity provider, if one is
chosen later, would be a separate design decision and would not
eliminate the need for organization-specific authorization checks.

**Confirmed from the client side 23 November 2026 (D-050, §16.17):** the app
ships with no built-in server address. A new installation asks for the
person's email address and the organisation's Hourly web address, and that
address is how the connection is established and maintained.

### 2.3 Multi-organization accounts

**Confirmed decision:** Multi-organization account support is postponed
from the MVP.

**Confirmed structural choice:** Even for the MVP, `User` and
`Membership` are separate concepts. This avoids tying a person's account
identity permanently to one organization's role or approval state and
leaves a path to future multi-organization support.

**Implication:** The MVP can still enforce one organization membership
per person in practice, without collapsing user identity and membership
into one resource.

**Clarified 23 November 2026 (D-050, §16.17):** an account exists on
exactly one instance. The same person at two organisations holds two
unrelated accounts — separate credentials, separate memberships, separate
histories — with no linking, no shared login and no cross-instance lookup
in the MVP.

### 2.4 Client/server boundary

**Established design direction:** The mobile app must not connect
directly to PostgreSQL. It communicates with the organization's API, and
the API performs authorization, validation, business logic, and database
operations. The client on the other side of that boundary is the native
mobile app, and only it (§2.1, D-056): nothing in this record specifies a
browser-facing contract.

The exact backend stack for this specific project has not been
reconfirmed as part of this decision record. TypeScript, Express, and
PostgreSQL have been discussed in the user's broader development
context, but the final implementation stack for this app remains **not
explicitly confirmed here**.

------------------------------------------------------------------------

## 3. Authentication, registration, and membership

### 3.1 Authentication method

**Deferred:** The authentication method is intentionally undecided.

**Partly resolved 24 November 2026 (D-056, §16.23):** the *session
machinery* is settled — bearer tokens on every business route, a 30-minute
access token, a single-use rotating refresh token with a 90-day idle and
180-day absolute limit, server-side revocation checked on every request,
and no cookie, CSRF protection or CORS because there is no browser client.
What remains open here is the **credential itself**: password, one-time
code, sign-in link, or an external provider. D-056 is written so that the
answer does not change it, with one exception: its rule 10 ("changing the
credential ends the other sessions") applies to whichever credential is
chosen.

Options discussed: - Email and password. - Passwordless email using a
one-time code or sign-in link. - External identity provider such as
Google or Microsoft. - A managed authentication service versus
self-managed authentication infrastructure.

No option or provider has been selected. The project owner explicitly
asked to postpone this decision and return to it later.

Future comparison should consider: - Implementation complexity and
security responsibility. - Ongoing service and infrastructure costs. -
How authentication is provisioned across separate organization
servers. - Account recovery and email verification. - Mobile secure
storage and token/session lifecycle. - Offline use and what happens when
credentials expire while the device is offline. - Provider dependency
and the effect of outages or pricing changes.

**Answered for the session layer by D-056 (§16.23):** mobile secure
storage, the token and session lifecycle, and what happens when credentials
expire while a device is offline — synchronisation pauses and the queue is
preserved. The remaining items above still bear on the credential choice.

**Important:** Authentication answers "who is signing in?" Authorization
answers "what may that person do?" A valid login alone must not grant
access to organization data.

### 3.2 Open self-registration and administrator approval

**Confirmed decision:** Users may self-register, after which an
organization administrator approves or rejects their membership.

Conceptual flow: 1. The person registers against a particular
organization's server. 2. The account/profile is created and any
required email verification is completed. 3. The organization membership
remains pending. 4. An administrator approves or rejects the membership.
5. Approval activates the person's organization access under an assigned
role.

The precise point at which the account is created relative to email
verification, and the exact registration endpoints, remain to be
designed.

**Security requirement:** A pending membership must not provide access
to protected organization records or time-entry operations merely
because the person can authenticate.

**Open implementation issue:** A trusted initial setup/bootstrap process
is needed so that an organization has its first administrator. The
process has not yet been designed.

### 3.3 User and Membership are separate resources

**Accepted recommendation:** Store account identity separately from the
person's relationship with an organization.

Conceptual responsibilities:

-   `User`: person-level account and profile data.
-   `Membership`: organization relationship, role, membership approval
    status, and related membership lifecycle information.

A membership---not a profile field on `User`---is the appropriate place
for organization role and approval status.

Illustrative relationship:

``` text
User
  |
  | one or more memberships over time / in a future multi-org design
  v
Membership
  |
  +-- organization-specific role
  +-- membership approval status
  +-- membership lifecycle
```

The actual database keys and whether a user record is globally shared or
stored only in an organization's database depend on the eventual
identity architecture. That has not been decided.

### 3.4 Profile fields and names

**Confirmed decision:** First and last names are stored as separate
values. They are concatenated for display and reporting.

Illustrative API representation:

``` json
{
  "firstName": "Alex",
  "lastName": "Morgan",
  "displayName": "Alex Morgan"
}
```

The database should store `firstName` and `lastName`; `displayName` is
derived rather than maintained as an independent source of truth. An API
may return the derived display name for convenience.

Names should not be validated under an unnecessarily restrictive naming
convention.

**Initial profile-field proposal:** Email address and first/last name
were proposed as required profile information; phone number was proposed
as optional. The final required/optional field list has not been
formally confirmed. Avoid collecting personal data without a product
need.

### 3.5 Profile and membership permissions

**Accepted recommendation:** The default policy is that users may edit
their own first and last names, but cannot change their own role or
membership approval status.

**Accepted recommendation:** Email-address changes should use a separate
verification process.

The project owner specified that the current profile policy should be
the default, with settings administrators can adjust. The following
distinction is important:

-   Ordinary profile-editing permissions can be configurable at
    organization level.
-   A user must not be able to grant themselves a role or approve their
    own membership through a profile update.
-   Email verification remains a recommended security safeguard; the
    exact extent to which an administrator may configure this process is
    not fully specified.

Illustrative policy settings (names are examples, not finalized API
fields):

``` json
{
  "allowSelfServiceNameChanges": true,
  "requireEmailVerificationForEmailChange": true
}
```

------------------------------------------------------------------------

## 4. Roles and authorization

### 4.1 Roles in the MVP

**Confirmed decision:** The MVP has three roles: - `volunteer` -
`coordinator` - `organizationAdministrator`

A person's role is associated with their organization membership, not
simply their global account identity.

### 4.2 Volunteer permissions

A volunteer generally: - Manages their own profile, within organization
policy. - Creates and manages their own time entries, subject to
lifecycle and approval rules. - Requests assignment to active
projects. - Can resolve their own time-entry conflicts by default,
subject to the organization setting. - Cannot change their own role or
approve their own membership.

### 4.3 Coordinator permissions

**Accepted recommendation and confirmed project-scope model:**
Coordinators manage work in projects to which they are assigned. They do
not automatically have organization-wide authority over a volunteer
merely because that volunteer has a coordinator relationship somewhere
else.

The project owner clarified the intended model: - A coordinator is
assigned to a project. - Multiple volunteers may be assigned to that
project. - The coordinator manages those volunteers' work **as it
relates to that project**.

A coordinator's authority therefore depends on the relevant project
assignment and requested action. A role check alone is insufficient.

A coordinator may, within their remit: - Manage projects and
activities. - Review or approve assigned volunteers' entries, subject to
approval rules. - Resolve conflicts for assigned volunteers, subject to
the eventual conflict-resolution permission model. - Manage project
assignments within the permissions ultimately defined.

**Resolved 18 November 2026:** within their remit, a coordinator may archive projects and activities, and an organization administrator may archive anything in the organization. No administrator approval step (§16.6, D-041).

### 4.4 Organization-administrator permissions

Organization administrators have organization-wide authority. The
discussed responsibilities include: - Approving registrations and
managing memberships. - Assigning and changing roles. - Managing
organization-level settings. - Managing organization-wide projects,
activities, and assignments. - Reviewing entries and resolving conflicts
across the organization.

The exact administrative permission matrix still needs to be formalized.

### 4.5 Authorization must be enforced by the server

The API must check both the user's role and the relevant resource scope.
For project-related work, it must verify the coordinator's project
assignment and the volunteer's assignment to that project.

Example: - Coordinator A is assigned to Project X. - Volunteer B is
assigned to Projects X and Y. - Coordinator A may manage B's work on X
within the applicable permissions. - Coordinator A does not
automatically gain authority over B's work on Y.

A time entry with no project association is not automatically within a
coordinator's authority. Organization administrators retain
organization-wide access.

------------------------------------------------------------------------

## 5. Projects, activities, and assignments

### 5.1 Project/activity hierarchy

**Confirmed decision:** Projects contain multiple activities. Each
activity belongs to one project. A time entry can reference an activity.

Conceptual model:

``` text
Project
  └── Activity (one or more)
        └── TimeEntry references an Activity when categorized
```

**Confirmed decision:** Coordinators and organization administrators can
create and manage projects and activities.

**Confirmed decision:** When a project or activity ends, it is archived,
history is retained, and new entries against the archived item are
prevented.

Archiving is a reversible status change, not a deletion: it ends volunteer
assignments at a dated boundary (§16.9, D-042) and can be undone by the same
authority (§16.10, D-043). The exact status vocabulary remains to be designed.

### 5.2 Explicit project assignments

**Confirmed decision:** Volunteers may log project-based time only for
projects to which they have been explicitly assigned. Assignment is not
inferred from an existing time entry.

**Confirmed decision:** Users should be able to request or make their
own project assignments, subject to an organization-wide approval
setting.

**Accepted recommendation:** For the MVP, any volunteer with an approved
organization membership may request assignment to any active project.
Project-specific eligibility restrictions are deferred.

### 5.3 Assignment approval

An organization-level setting controls whether self-assignment: - Takes
effect immediately; or - Remains pending until approved by a coordinator
or administrator with appropriate authority.

A pending assignment does not grant permission to record valid project
time.

The exact API fields, default setting value, and approval-routing rules
are not yet specified. Do not assume that a pending assignment is
active.

Illustrative setting (field name not finalized):

``` json
{
  "requireProjectAssignmentApproval": true
}
```

### 5.4 Leaving a project

**Confirmed decision:** The MVP must support an organization-level
setting for whether a volunteer may leave a project independently or
must obtain coordinator approval.

Two modes: 1. **Self-service departure:** The volunteer's assignment
ends immediately; the relevant coordinator may be notified. 2.
**Coordinator approval required:** The volunteer requests to leave. The
assignment remains active until an authorized coordinator approves the
departure.

The notification behaviour was suggested as a recommendation, not fully
specified as a requirement.

A pending departure request does not end the assignment.

### 5.5 Historical time after departure

**Confirmed decision:** Leaving a project does not remove the ability to
submit time that was worked before the departure. Time for work after
the effective departure boundary must be prevented.

The project owner accepted recording an effective assignment end
date/time and chose an **inclusive departure date**.

Rules: - **Timestamp-based entries:** Work must end at or before the
assignment's effective end time. - **Duration-only entries:** The work
date may be the departure date or an earlier date. - An entry
synchronized after departure can still be eligible if its work period
falls within the allowed period. - An entry dated after departure must
not be accepted as valid project time. - Corrections must be revalidated
against assignment history. - Historical entries must remain intact.

Example: If an assignment ends effective 25 October at 5:00 PM, a
timestamp-based entry ending at 4:30 PM that day is eligible. An entry
ending at 5:30 PM is not. A duration-only entry dated 25 October is
eligible, subject to other rules.

**Open detail:** The precise meaning of "effective end time" must be
consistent with the assignment's time zone and timestamp model. The
inclusive date rule is clear, but timezone representation and boundary
storage are not yet designed.

### 5.6 Archival and assignment closure

**Confirmed decision:** Archived projects and activities retain
historical records and do not accept new time entries.

**Resolved 18 November 2026 — authority (§16.6, D-041) and effects (§16.9, D-042):** coordinators may archive projects and activities within their remit, administrators anything in the organization, with no approval step. Archiving then ends volunteer assignments at the archival instant, cancels pending assignment requests, keeps pending time entries reviewable, accepts work dated before the instant, and stops running timers, keeping their elapsed time as a pre-filled draft on the volunteer's device (§16.11, D-044); the timer half is superseded by D-048 (§16.15), the MVP having no server timer. Coordinator assignments survive so the project can be restored.

**Restore resolved 18 November 2026 (§16.10, D-043):** archiving is reversible. Restoring returns the project, and the activities archived with it, to active. Volunteer assignments stay ended and must be re-established. The archived interval stays in the record, so work dated inside it remains ineligible.

### 5.7 Project-less time entries

**Confirmed decision:** Project-less time is permitted, but a written
description of the activity is mandatory.

Implications: - A project-less entry has no project/activity
association. - The server validates that the required description is
present and meaningful according to a validation rule still to be
defined. - The entry remains identifiable as project-less in reports. -
A coordinator does not automatically gain authority over a project-less
entry; organization administrators retain organization-wide access. - Unsubmitted drafts stay on the device (§16.11, D-044), but the server
must not accept an invalid project-less entry as a valid completed
submission. -
The API should return a structured validation error so the user can
correct it.

**Open detail:** It has not been decided whether the mandatory activity
description is a separate field from optional notes or whether one
description field will serve both purposes.

Illustrative representation:

``` json
{
  "projectId": null,
  "activityId": null,
  "activityDescription": "Helped prepare materials for the volunteer orientation",
  "notes": null
}
```

This is illustrative only; exact field names and whether both
`activityDescription` and `notes` exist remain open.

### 5.8 Assignment changes and offline devices

The server must evaluate a submitted entry against the authoritative
assignment history, not merely the client's cached project list or
assignment state.

If an offline device submits an entry against a project whose assignment
is no longer active: - Preserve the submitted record. - Validate its
work date/timestamps against the effective assignment end boundary. -
Allow eligible historical work through normal validation and approval. -
Reject or flag work outside the allowed period using a structured
result. - Do not silently discard local work.

The final conflict/rejection workflow for such entries remains to be
designed.

------------------------------------------------------------------------

## 6. Time-entry model and lifecycle

### 6.1 Entry creation modes

**Confirmed decision:** The MVP supports both timer-based and manual
time entries.

**Superseded in part 22 November 2026 (D-048, §16.15):** the MVP has no
timer-based entries and no server timer. Entry creation is manual only,
in the two forms below, optionally pre-filled by a device-local
stopwatch. "Both" no longer describes the MVP; the two manual forms
stand unchanged.

Manual entry supports two forms: 1. Exact start and end timestamps. 2. A
date plus total duration, without exact timestamps.

The server must not fabricate start/end timestamps for duration-only
entries.

### 6.2 Conceptual time-entry fields

The following is a conceptual field inventory, not a finalized schema:

-   Entry ID.
-   Volunteer/membership reference.
-   Optional activity reference.
-   Start timestamp, when applicable.
-   End timestamp, when applicable.
-   Work date and duration for duration-only entries.
-   Required activity description for project-less entries.
-   Optional notes.
-   Lifecycle status.
-   Approval status.
-   Conflict status or conflict references.
-   Creation and update timestamps.
-   Audit history or audit-history references.

Exact nullability, identifiers, enum values, and timestamp conventions
remain to be designed.

### 6.3 One running timer per volunteer

**Confirmed decision:** A volunteer may have only one accepted running
timer at a time.

**Superseded 22 November 2026 (D-048, §16.15):** with no server timer in
the MVP there is no running timer to constrain, so nothing here is
implemented — no constraint, no timer row, no route. The rule and its
atomicity requirement are kept for a release that adds server-side
timers. The reconciliation of competing offline timers it describes
belongs with §7.4, which is deferred with it.

The server must enforce this atomically using a database constraint or
transaction-safe equivalent. An application-layer "check then insert"
without concurrency protection is not sufficient.

Because offline devices can independently start timers, the server
cannot guarantee that two devices never create competing local timers.
Instead, it must reconcile the conflict when they sync.

### 6.4 Overlapping entries

**Confirmed decision:** Overlapping time entries are allowed, but they
trigger a warning or review rather than being silently rejected.

The server should repeat overlap validation even if the client has
already warned the user. The exact severity, review workflow, and any
organization settings for overlap handling are not finalized.

For duration-only entries, precise overlap detection is limited because
there are no exact start/end timestamps.

### 6.5 Timing source of truth

-   Timestamp-based entries use start and end timestamps as the source
    of truth; the server calculates duration.
-   Duration-only entries use a date and total duration; the server must
    not invent precise timestamps.
-   A running timer has a start timestamp and no end timestamp until
    stopped.
-   Timezone handling, daylight-saving behaviour, rounding, and duration
    precision need a later explicit decision.

### 6.6 Conceptual lifecycle and approval

The following lifecycle is a **provisional model**, not a finalized
state machine: - Running → completed. - If approval is required:
completed/submitted → pending → approved or rejected. - If approval is
not required: validated entries may become auto-accepted or
`notRequired`. - A rejected entry may be corrected and resubmitted.

Approval status should be separate from entry lifecycle and conflict
status. Resolving a conflict does not automatically approve hours.

**Confirmed decisions:** - Organization-wide approval configuration
controls the default approval policy. - Entries follow the current
organization policy by default. - Administrators can adjust relevant
settings. - Volunteers can correct rejected entries and resubmit them. -
Prior rejection/approval history should be retained, not overwritten. -
Material changes to approved entries that affect hours or substantive
details should trigger reapproval when the policy requires it; prior
approval should remain in audit history.

**Open questions:** - ~~Must volunteers explicitly submit completed entries for approval, or are they submitted automatically?~~ Resolved 22 November 2026: submission is explicit — finishing work produces a draft, not a submission (§16.11, D-044). - What precisely counts as a material change? - ~~What happens to pending entries when the organization approval policy changes?~~ Resolved 22 November 2026: the policy in force at submission governs, and a change applies only to later submissions (§16.12, D-045). - Who may approve which categories of entries, and can coordinators approve entries for work that is not associated with their project? **Resolved 23 November 2026 (D-051, §16.18):** no. A coordinator's authority is confined to projects they coordinate, an entry is reviewed by an active coordinator of its project other than its author or by an administrator, nobody approves their own entry, and project-less entries are administrator-only.

------------------------------------------------------------------------

## 7. Offline synchronization

### 7.1 Offline support is a requirement

**Confirmed decision:** The mobile app must be able to record time while
offline and synchronize it later.

The client should use local persistence and a durable sync queue. The
server remains authoritative for accepted state.

The client must also download server-side changes; synchronization is
not only uploading local changes.

**Amended 24 November 2026 (D-056, §16.23):** a session that has ended —
expired, revoked or replaced — pauses synchronisation and asks for sign-in.
It never clears the outbox. The queue is a local record of work already
done, and losing it to an authentication error would punish the offline
support this section requires.

### 7.2 Stable identifiers and idempotency

**Confirmed decision (D-049, §16.16) — 23 November 2026:** Client-created
records use stable client-generated UUIDs, and the API makes retrying a
sync operation idempotent so that a network retry does not create duplicate
entries.

This is especially important because mobile requests can fail after the
server has committed a change but before the client receives the
response.

The mechanism is fixed in §16.16: the entry's own id is the deduplication
record, and an integer `version` guards concurrent edits. There is no
`Idempotency-Key`, no retention window, and no request contract beyond the
resource body itself.

### 7.3 Sync validation

When the client reconnects, the server revalidates each change against
current authoritative information, including: - Membership status and
authorization. - Current organization settings. - Project/activity
archive status. - Project assignment state and assignment history. -
Time-entry timing and overlap rules. - Approval and conflict-resolution
permissions.

A client-side validation result is not sufficient because the device may
have stale data.

### 7.4 Concurrent offline timers

**Deferred 22 November 2026 (D-048, §16.15):** there are no server
timers in the MVP, so this section does not describe MVP behaviour. What
remains is the duplicate: the same shift timed on two devices and
submitted twice, which is an overlap and is handled as an advisory
conflict (D-047). This section applies again only if server timers
return.

**Confirmed decision:** If two competing timers are created offline, the
first timer accepted by the server wins. The competing timer is
preserved and flagged for resolution.

Important qualification: "first server-accepted" means the order in
which the server accepts/processes the timers; it does not prove which
timer reflects the real-world chronological start. The competing entry
must remain visible and correctable.

The server should not silently discard the losing entry. The exact
ordering rule, transaction strategy, and conflict response schema remain
to be designed.

### 7.5 Conflict resolution permissions

**Confirmed decision:** By default, volunteers can resolve their own
time-entry conflicts, and administrators can resolve conflicts. An
organization administrator can disable volunteer conflict resolution
through an organization-level setting.

**Provisional proposal:** Coordinators may be allowed to resolve
conflicts for volunteers assigned to projects they manage. This was
suggested, but the precise permission model has not been fully
confirmed.

Resolution options discussed: - Correct the entry. - Keep the entry as
valid work, subject to overlap and approval rules. - Mark the entry
erroneous so it is excluded from valid time totals while audit history
is retained.

Conflict resolution should record the actor, time, relevant changes, and
reason where applicable.

An offline resolution can be queued locally, but the server must
authorize it at sync time. If permission is denied, the request and
record should be preserved and the client should be told; it must not
silently delete the request or entry.

### 7.6 Separate business state from synchronization state

**Established design direction:** Business state (such as
running/completed, approval status, and conflict status) should be kept
separate from local synchronization state.

Sync state is primarily client-side---for example, queued, sending, or
synchronized---while the server retains the authoritative business
record and relevant conflict/audit history.

A giant all-purpose `/v1/sync` endpoint has not been selected.
Synchronization endpoints and protocol should be designed after the
domain resources and operations are clearer.

------------------------------------------------------------------------

## 8. Organization settings and policy enforcement

### 8.1 Organization-level configuration

**Confirmed design direction:** Relevant policies should have an
organization-wide default and administrator-adjustable settings where
specified. The server must enforce the current setting.

Known settings or configurable policy areas include:

  -----------------------------------------------------------------------
  Policy area                         Known rule/status
  ----------------------------------- -----------------------------------
  Profile name changes                Allowed by default; organization
                                      settings may adjust

  Email changes                       Separate verification recommended;
                                      exact configurability not finalized

  Project-assignment approval         Organization-wide setting
                                      determines whether self-assignment
                                      activates immediately or waits for
                                      approval

  Leaving projects                    Organization-wide setting
                                      determines self-service departure
                                      versus coordinator approval

  Time-entry approval                 Organization-wide approval
                                      configuration; entries follow
                                      current policy by default

  Volunteer conflict resolution       Enabled by default; administrator
                                      can disable

  Project-less time                   Permitted; written activity
                                      description is mandatory

  Project eligibility                 Project-specific eligibility
                                      restrictions deferred; volunteers
                                      may request assignment to any
                                      active project

  Overlap handling                    Overlaps allowed with warning or
                                      review; exact configuration not
                                      finalized
  -----------------------------------------------------------------------

Not every policy above has a final setting name, type, or default beyond
what is expressly stated. Do not treat the table as a database schema.

### 8.2 Stale settings and offline clients

The client may be offline or have stale settings. Therefore: - The
server checks the current policy when it receives a request or sync
change. - A client cannot rely on an old cached permission to bypass a
new restriction. - The system should preserve local records that cannot
currently be accepted and provide a clear, structured result.

**Partly resolved 22 November 2026 (§16.12, D-045):** for the approval policy, the rule is prospective — the policy in force when a submission is received governs it, and a later change applies only to submissions made after its effective time. Already-pending and already-approved entries keep the handling they entered. Assignment requests and other pending operations still need a per-policy answer (§15.12 item 24).

------------------------------------------------------------------------

## 9. Conceptual resource inventory

This list describes domain concepts, not a commitment to one table per
resource or a finalized REST design.

  ------------------------------------------------------------------------
  Resource/concept         Purpose                 Key relationships or
                                                   notes
  ------------------------ ----------------------- -----------------------
  `User`                   Account identity and    Stores separate first
                           profile                 and last names

  `Membership`             Relationship to an      Holds role and
                           organization            membership
                                                   approval/lifecycle

  `Project`                Organized unit of work  Has many activities and
                                                   assignments

  `Activity`               Category/task within a  Belongs to one project
                           project                 

  `ProjectAssignment`      Associates a person     Supports coordinator
                           with a project          and volunteer
                                                   assignments, approval,
                                                   departure, and history

  `TimeEntry`              Record of volunteer     May reference an
                           work                    activity; project-less
                                                   entries require a
                                                   description

  `OrganizationSettings`   Organization-wide       Controls specified
                           policy                  configurable workflows

  `AuditHistory`           Records important       Supports traceability
                           actions and decisions   for approval, conflict
                                                   resolution, and
                                                   assignment changes

  Conflict information     Represents competing or Exact resource/table
                           disputed entries        structure is not
                                                   decided
  ------------------------------------------------------------------------

**Open modeling detail:** Whether `ProjectAssignment` uses one general
assignment resource with a role/type or distinct volunteer-assignment
and coordinator-assignment concepts has not been decided. The API must
nevertheless represent both project membership and the scope of
coordinator authority.

------------------------------------------------------------------------

## 10. Illustrative API examples

These examples are explanatory only. They are **not approved endpoint
contracts or final field names**.

### 10.1 A project-based time entry

``` json
{
  "clientEntryId": "8e1dbb5a-3aaf-4a4e-b8fb-5a1cbf42a110",
  "activityId": "activity-uuid-example",
  "startTime": "2026-10-25T15:00:00-07:00",
  "endTime": "2026-10-25T16:30:00-07:00",
  "notes": "Prepared and distributed supplies"
}
```

In a final contract, identifiers and timestamp format must be
consistently defined. The server should derive the associated project
from the activity or otherwise enforce their consistency, rather than
trusting contradictory client-supplied relationships.

### 10.2 A duration-only entry

``` json
{
  "clientEntryId": "c20b99a4-11c5-4ef5-a9a9-1a5c70d86e4c",
  "workDate": "2026-10-25",
  "durationMinutes": 90,
  "activityId": "activity-uuid-example",
  "notes": null
}
```

This example intentionally does not invent start and end timestamps.

> **Refinement (D-046, §16.13):** `durationMinutes` is the request field for a duration-only entry; the stored record carries it as whole seconds. A timestamp entry sends `startTime` and `endTime` only, and the server derives the duration.

### 10.3 A project-less entry

``` json
{
  "clientEntryId": "c9e2c5c8-9f1d-4e42-9f77-54b1f2c8a711",
  "workDate": "2026-10-25",
  "durationMinutes": 45,
  "projectId": null,
  "activityId": null,
  "activityDescription": "Helped prepare materials for volunteer orientation",
  "notes": null
}
```

The separate `activityDescription` field is illustrative. It remains
undecided whether this is distinct from notes or whether the final
contract uses a different shape.

### 10.4 A pending project assignment

``` json
{
  "projectId": "project-uuid-example",
  "membershipId": "membership-uuid-example",
  "status": "pending",
  "requestedAt": "2026-10-25T10:15:00-07:00"
}
```

`status` and other field names are examples, not final enum definitions.
A pending assignment must not grant permission to record valid project
time.

### 10.5 Illustrative structured validation error

``` json
{
  "error": {
    "code": "PROJECT_ASSIGNMENT_ENDED",
    "message": "This entry falls outside the permitted project assignment period.",
    "details": {
      "assignmentEndTime": "2026-10-25T17:00:00-07:00"
    }
  }
}
```

**Envelope resolved 15 November 2026 (§16.4, D-039).** The status code, and whether an out-of-period
submission is represented as a rejected entry, a conflict, or a separate
review item remain to be designed. The example illustrates the goal:
return a stable machine-readable reason and preserve the user's
submitted work rather than silently dropping it.

------------------------------------------------------------------------

## 11. API and implementation principles already established

These are design directions from the API-learning discussion that inform
future implementation. They do not finalize the endpoint catalogue.

-   The API is the contract between the mobile app and the server;
    Express or another framework is an implementation choice, not the
    API itself.
-   The only client is the native mobile app (D-056, §16.23): every route
    but sign-in and refresh authenticates with a bearer token, and no
    response sets a cookie or a CORS header.
-   The mobile app should not access the database directly.
-   Use predictable resource-oriented endpoints and standard HTTP
    semantics where appropriate.
-   Validate external input at runtime; TypeScript types alone do not
    validate untrusted request bodies.
-   Keep controllers/HTTP handling separate from business rules and
    persistence logic.
-   Use stable, machine-readable error codes.
-   Apply authorization and policy checks on the server.
-   Use transactions or equivalent atomic database mechanisms where
    concurrency can violate invariants.
-   Design idempotent create/sync operations for offline retries.
-   Preserve audit history for significant decisions and corrections.
-   Keep API versioning and pagination/synchronization strategy to a
    later contract-design stage.
-   Do not finalize route names or a database schema before the
    remaining lifecycle and permission rules are resolved.

------------------------------------------------------------------------

## 12. Decision register

This is the compact record of major decisions and their current status.

  --------------------------------------------------------------------------
  ID                      Decision                   Status
  ----------------------- -------------------------- -----------------------
  D-001                   Separate server and        Confirmed decision
                          database per organization  

  D-002                   Defer multi-organization   Confirmed decision
                          account support from MVP   

  D-003                   Keep `User` and            Accepted recommendation
                          `Membership` separate      

  D-004                   Open self-registration     Confirmed decision
                          followed by administrator  
                          membership approval        

  D-005                   Authentication             Deferred
                          method/provider remains    
                          undecided                  

  D-006                   Store first and last names Confirmed decision
                          separately; derive         
                          display/report name        

  D-007                   Default self-service       Accepted recommendation
                          profile policy, with       
                          administrator-adjustable   
                          settings                   

  D-008                   Three roles: Volunteer,    Confirmed decision
                          Coordinator, Organization  
                          Administrator              

  D-009                   Coordinator authority is   Confirmed design
                          scoped to assigned         direction
                          projects and volunteers'   
                          work on those projects     

  D-010                   Projects contain           Confirmed decision
                          activities; activities     
                          belong to one project      

  D-011                   Archive ended              Confirmed decision
                          projects/activities,       
                          retain history, prevent    
                          new entries                

  D-012                   Support timer and manual   Confirmed decision
                          entries                    

  D-013                   Manual entries support     Confirmed decision
                          timestamps or date plus    
                          duration                   

  D-014                   One accepted running timer Confirmed decision
                          per volunteer              

  D-015                   Overlaps allowed with      Confirmed decision
                          warning/review             

  D-016                   Project-less time allowed  Confirmed decision
                          with mandatory written     
                          activity description       

  D-017                   Project-based time         Confirmed decision
                          requires explicit active   
                          project assignment         

  D-018                   Volunteers can request     Accepted recommendation
                          assignment to any active   
                          project                    

  D-019                   Organization setting       Confirmed decision
                          controls whether           
                          self-assignment requires   
                          approval                   

  D-020                   Organization setting       Confirmed decision
                          controls whether leaving a 
                          project requires           
                          coordinator approval       

  D-021                   Historical work before     Confirmed decision
                          departure remains eligible 
                          for submission             

  D-022                   Departure date is          Confirmed decision
                          inclusive; timestamp work  
                          must end by effective      
                          assignment end time        

  D-023                   Organization-wide approval Confirmed decision
                          policy governs entry       
                          approval defaults          

  D-024                   Volunteers can correct and Confirmed decision
                          resubmit rejected entries  

  D-025                   Preserve                   Confirmed design
                          approval/rejection history direction
                          and reapprove material     
                          edits when policy requires 

  D-026                   Offline recording and      Confirmed decision
                          later synchronization are  
                          required                   

  D-027                   Stable client-generated    Confirmed decision
                          IDs and idempotent retries

  D-028                   First server-accepted      Confirmed decision
                          concurrent timer wins;     
                          competing timer is         
                          preserved and flagged      

  D-029                   Volunteers may resolve own Confirmed decision
                          conflicts by default;      
                          administrator can disable  
                          this                       

  D-030                   Keep sync state separate   Established design
                          from business state        direction

  D-031                   Coordinator                Provisional proposal;
                          conflict-resolution scope  exact model open

  D-032                   Coordinator                Open question
                          project-archival authority 

  D-033                   Exact entry lifecycle,     Open questions
                          submission flow, and       
                          policy-change effects      

  D-034                   Exact database schema,     Deferred until
                          endpoint contracts, and    structural design
                          sync protocol              advances
  --------------------------------------------------------------------------

------------------------------------------------------------------------

> **Register status (22 November 2026):** this table is maintained only through D-034. Decisions taken after it are recorded in §15, which assigns no IDs, and in §16, which continues the sequence. For findability, the identifiers added so far are: **D-035** — time-entry retrieval consistency, live results (§16.1); **D-036** — import/export mechanism, deferred (§16.7); **D-037** — cursor encoding, opaque signed tokens (§16.2); **D-038** — entry ordering, start-time anchor with duration-only entries last within their date (§16.3); **D-039** — error envelope, status and code mapping (§16.4); **D-040** — paginated list response body (§16.5); **D-041** — project and activity archive authority (§16.6); **D-042** — effects of archival on assignments, requests, and timers (§16.9); **D-043** — restoring archived projects and activities (§16.10); **D-044** — explicit submission of entries (§16.11); **D-045** — approval policy applies at submission (§16.12); **D-046** — time and duration model, seconds as the canonical unit (§16.13); **D-047** — definition of an overlap, advisory and volunteer-wide (§16.14); **D-048** — stopwatch instead of a server timer (§16.15), which supersedes D-012 and D-014 in part; **D-049** — mutation identity and concurrency, client-generated UUIDs plus an integer `version` (§16.16); **D-050** — identity scoped to the organisation's own instance, onboarding by email address and server address (§16.17); **D-051** — roles limited to volunteer and administrator, coordination held as project grants in `project_coordinators` (§16.18); **D-052** — retention and erasure, the record retained while the person is anonymised (§16.19); **D-053** — request identity and load control, server-minted UUIDv7 request ids with per-user and per-address token buckets and size caps (§16.20); **D-054** — one list contract for every collection, a fixed order per collection and cursors bound to their collection and filters (§16.21); **D-055** — every mutation returns the resource it changed, replays are `200` with `Idempotency-Replay`, and archival's counts are read before the act rather than returned after it (§16.22). **D-056** — the session model: a bearer access token with a single-use rotating refresh token, and no cookie, CSRF or CORS because the MVP has no browser client (§16.23). Gaps not yet raised by any section are tracked as backlog items B1–B19 in §17; they carry no D-IDs until decided. The **D-032** row above is now answered: see D-041. This register should be reconciled with §§15–16 when the document is next consolidated.

## 13. Outstanding decisions and recommended order

The following items remain unresolved. They should be handled one at a
time rather than filled in by assumption.

### Priority 1 --- Finish project lifecycle and authority

1.  ~~**Project archival authority:** Can coordinators archive their own
    projects, or does this require administrator approval?~~ **Resolved
    18 November 2026 --- coordinators within their remit, administrators
    organization-wide, with no approval step (§16.6, D-041).**
2.  **Coordinator conflict resolution:** Confirm whether coordinators
    can resolve conflicts for volunteers assigned to their projects, and
    define treatment of project-less entries.
3.  **Assignment model:** Decide whether coordinator and volunteer
    assignments use one generalized assignment resource or separate
    concepts.
4.  **Assignment end boundaries:** Define timestamp/timezone storage and
    exact effective-time semantics, preserving the agreed inclusive
    departure date.

### Priority 2 --- Finalize time-entry lifecycle

5.  ~~Decide whether completed entries are automatically submitted for
    approval or require explicit volunteer submission.~~ **Resolved 22
    November 2026 — explicit submission (§16.11, D-044).**
6.  Define entry lifecycle, approval status, and conflict status as
    separate state models.
7.  Define the exact conditions that trigger reapproval after editing an
    approved entry.
8.  ~~Define what happens to pending entries and requests when
    organization settings change.~~ **Entries resolved 22 November 2026
    — the policy in force at submission governs (§16.12, D-045). Pending
    assignment requests remain open (§15.12 item 24).**
9.  Define how invalid but preserved submissions are surfaced,
    corrected, reviewed, or excluded from totals.

### Priority 3 --- Resource and policy details

10. Finalize profile required/optional fields and email-change
    verification behaviour.
11. Decide whether project-less activity description is separate from
    optional notes.
12. ~~Define overlap warning/review behaviour.~~ **Resolved 22 November
    2026 — definition of an overlap (§16.14, D-047).**
13. Define what assignment departure does to pending time entries and
    requests, beyond the already agreed historical-time rule.
14. ~~Define how active assignments are handled during archival, and
    whether archived projects can be restored.~~ **Resolved 18 November
    2026 — assignment effects (§16.9, D-042); restore (§16.10, D-043).**

### Priority 4 --- API contract and implementation

15. Choose authentication method/provider and whether authentication is
    managed or self-hosted.
16. Design the first-admin bootstrap process.
17. Finalize database schema and constraints.
18. Define endpoint names, HTTP methods, request/response DTOs,
    validation rules, and error codes.
19. Design offline sync operations, cursor/change tracking,
    retry/idempotency handling, and conflict responses.
20. Define API versioning, pagination, security controls, deployment,
    backups, and monitoring.

------------------------------------------------------------------------

## 14. Suggested next step

Continue with the outstanding project-lifecycle questions recorded in
§15.12.

**Superseded 18 November 2026:** the question recorded here --- whether coordinators
may archive projects they manage --- was answered in favour of coordinator
archival within the project remit, with organization-wide administrator
authority and no approval step (§16.6, D-041). The current next step is recorded
in the outstanding-decisions list at the head of §16.

Archival effects and restore are now decided (§16.9, D-042; §16.10, D-043).

Supplement: Project Assignments, Coordinator Permissions, and Notifications

Status: Supplementary design decisions
Scope: Decisions made after the previous version of the design decision record.
Important: This supplement records confirmed decisions separately from optional behavior, deferred enhancements, and unresolved questions. It does not finalize API endpoints, database schemas, or UI designs.

1. Project coordinator model

1.1 Multiple coordinators

Confirmed decision: A project may have multiple coordinators assigned simultaneously.

The system must support multiple coordinator-to-project assignments. No lead-coordinator role is required for the MVP.

**Storage confirmed 23 November 2026 (D-051, §16.18):** a grant is a row in `project_coordinators` with `granted_by`, `granted_at` and `ended_at`, never a field on `projects`. Membership roles are `volunteer` and `administrator`; coordinator is not a role. Ending a grant preserves the row, which is what makes §4.2.4's "a new assignment record is created" possible.

1.2 Projects without a coordinator

Confirmed decision: An active project may temporarily have no coordinator.

The system must warn users when an active project has no coordinator. This is an advisory warning, not a restriction on project activity.

The warning's presentation and interaction belong to UI design scope. The underlying project and assignment data must allow the application to determine whether an active project has any coordinators.

An organization administrator retains organization-wide authority, regardless of whether a project has an assigned coordinator.

1.3 Organization administrator authority

Confirmed decision: An organization administrator does not need an explicit coordinator assignment to manage a project.

Organization administrators may manage projects and their assignments throughout their organization. Their administrative permissions do not automatically create coordinator assignments or make them appear in the project's coordinator list.

Coordinators, by contrast, must be explicitly assigned to a project to exercise coordinator permissions on it.

2. Coordinator assignment permissions

2.1 Adding and removing coordinators

Confirmed decisions:

- Organization administrators always have permission to add and remove coordinators on any project in their organization.
- Coordinators already assigned to a project may add and remove coordinator assignments for that project.
- The MVP must provide an organization-wide setting controlling whether already-assigned coordinators may add and remove coordinators.
- This setting is enabled by default.
- Organization administrators' authority to manage coordinator assignments is not subject to this setting.

The setting affects coordinator-to-project assignment management. It does not grant coordinators organization-wide authority.

2.2 Coordinator self-assignment

Confirmed decision: Coordinators cannot assign themselves to projects.

Coordinator assignments must be created by an authorized organization administrator or an already-assigned coordinator acting within the permissions allowed by organization settings.

There is no self-service coordinator assignment request workflow in the MVP.

The volunteer self-assignment setting does not apply to coordinator assignments.

2.3 Removing the last coordinator

Confirmed decision: Removing the last coordinator from an active project requires confirmation.

This applies when an authorized person removes another coordinator or when a coordinator removes themselves.

After confirmation, the removal may proceed. The project remains active even though it has no coordinator.

The system must warn users when the project will have no coordinator. The confirmation and warning interactions belong to UI design scope.

A project with no coordinator is therefore valid, although the system should draw attention to that condition.

2.4 Coordinator self-removal

Confirmed decision: A coordinator may remove themselves from a project, subject to the last-coordinator confirmation rule.

Ending the assignment preserves its history. If the person is subsequently assigned to the project again, a new assignment record is created.

3. Volunteer assignment permissions

3.1 Direct assignment by authorized people

Confirmed decision: Organization administrators and coordinators assigned to the relevant project may add and remove volunteer assignments.

Organization administrators may do so for any project in their organization. Coordinators may do so only for projects to which they are assigned.

Direct assignment by an authorized coordinator or administrator is distinct from volunteer self-assignment. Direct assignment does not require the volunteer to submit a self-assignment request.

3.2 Volunteer self-assignment

Confirmed decision: Volunteers may request assignment to any active project, subject to the organization's self-assignment approval setting. Project-specific eligibility restrictions remain deferred.

The organization-wide setting determines whether self-assignment requires approval:

- Approval required: A volunteer submits an assignment request. The assignment remains pending until the request is approved, rejected, or withdrawn.
- Approval not required: The volunteer joins the project directly. No assignment request is created, and the assignment becomes active immediately, subject to the applicable rules.

A pending request does not authorize the volunteer to log valid project-based time.

Direct assignment by an authorized coordinator or administrator remains a separate operation from self-assignment.

3.3 Coordinator authority over volunteer assignments

An assigned coordinator may manage volunteer assignments for their project, including adding and removing volunteers. This authority is project-scoped and does not extend automatically to other projects on which the coordinator is not assigned.

Organization administrators retain organization-wide assignment authority.

4. Assignment request lifecycle

4.1 Pending requests

Confirmed MVP decision: A pending volunteer assignment request remains pending until one of the following occurs:

1. An authorized coordinator or organization administrator approves it.
2. An authorized coordinator or organization administrator rejects it.
3. The volunteer withdraws it.

There is no automatic expiry of pending requests in the MVP. Expiry may be reconsidered in a future update.

4.2 Duplicate requests

Confirmed decision: A volunteer may not have multiple pending requests for the same project.

The server must prevent duplicate pending requests from the same volunteer for the same project.

- A duplicate request must not create another pending record.
- A volunteer who already has an active assignment cannot submit another request to join the same project.
- After a request has been rejected or withdrawn, the volunteer may submit a new request.
- Repeated API calls or synchronization retries must not create duplicate records for the same operation.

4.3 Approval and rejection authority

Confirmed decision: Any coordinator assigned to a project may approve or reject volunteer assignment requests for that project.

Organization administrators may approve or reject requests for any project in their organization.

No lead-coordinator role is required. Coordinators may not approve or reject requests for projects to which they are not assigned.

4.4 Rejection reasons

Confirmed decision: A rejection reason is optional.

When rejecting a request, an authorized coordinator or administrator may provide a written reason. If a reason is provided, it must be included in the volunteer's rejection notification.

A reason is not required for rejection.

4.5 Withdrawal

Confirmed decision: Volunteers may withdraw their own pending assignment requests at any time before a decision is made.

Withdrawal ends the pending request but does not delete its historical record. The volunteer may subsequently submit a new request, subject to the usual rules.

An approved or rejected request cannot be withdrawn.

5. Project assignment history

5.1 Retention of assignment records

Confirmed decision: Assignment records must be retained after an assignment ends.

An assignment record should preserve at least:

- The person assigned.
- The project.
- The assignment type or role, distinguishing volunteer and coordinator assignments.
- The assignment start time.
- The assignment end time, when applicable.
- The assignment's current status.

Ending an assignment must not delete its historical record.

5.2 Reassignment

Confirmed decision: Reassigning someone to a project after their previous assignment ended creates a new assignment record.

The previous record must not be reactivated. Separate records preserve distinct periods of assignment and support historical reporting.

These rules apply to both volunteer and coordinator assignments.

5.3 Assignment audit details

Deferred enhancement: The MVP does not need to record which user created or ended an assignment as a separate audit detail.

Recording the actor responsible for each change, and potentially the reason for the change, remains on the table for future updates.

This deferral does not remove the requirement to retain the assignment's start and end times.

5.4 Historical time entries

Existing rules governing historical time submissions after an assignment ends remain in force. Ending an assignment must not erase historical time entries or automatically invalidate otherwise eligible work performed during the assignment.

The precise timestamp, timezone, and assignment-boundary rules remain governed by the existing design decisions.

6. In-app notifications

6.1 General notification requirements

Confirmed MVP decisions:

- Notifications are in-app only. Email notifications are out of scope for the MVP.
- Notifications are stored persistently on the server.
- Users can access their notifications across app restarts and devices.
- Users can mark notifications as read.
- Users can delete their own notifications.
- Deleting a notification must not delete the underlying assignment, request, or other business record.
- Notifications remain available until deleted or affected by a retention policy. The retention policy remains undecided.

The exact notification API, delivery mechanics, and UI presentation are not yet specified.

6.2 Volunteer assignment notifications

The following rules apply to volunteer assignment changes:

Event| Notification recipient
Volunteer added directly by a coordinator or administrator| Affected volunteer
Volunteer removed directly by a coordinator or administrator| Affected volunteer
Self-assignment request submitted when approval is required| All coordinators assigned to the project
Self-assignment request withdrawn while approval is required| All coordinators assigned to the project
Assignment request approved| Volunteer who requested assignment
Assignment request rejected| Volunteer who requested assignment; include the optional rejection reason if provided
Volunteer self-assigns when approval is not required| Coordinators may be notified
Volunteer removes themselves when approval is not required| Coordinators may be notified

For direct additions or removals made by a coordinator or administrator, other coordinators must not receive notifications about the change.

When approval is required, all coordinators assigned to the project must be notified of new requests and withdrawals. The affected volunteer must be notified of the approval or rejection outcome.

When approval is not required, self-assignment and self-removal create or end assignments directly rather than creating assignment requests. Coordinator notifications for these direct self-service changes are permitted, but have not been established as mandatory.

6.3 Coordinator assignment notifications

The following rules apply to coordinator assignment changes:

Event| Notification recipient
Coordinator added to a project| Newly assigned coordinator
Coordinator removed from a project| Removed coordinator

Other coordinators do not need to be notified about these changes under the current requirements.

6.4 Notification retention and administration

Users may delete their own notifications. Whether organization administrators can manage another user's notifications remains undecided.

The notification retention period and any automatic cleanup policy also remain undecided.

7. Organization settings introduced or clarified

The following settings and policies are relevant to this supplement:

Setting or policy| Status
Whether assigned coordinators may add and remove coordinators| Required for MVP; enabled by default
Whether volunteer self-assignment requires approval| Existing organization-wide setting; confirmed
Whether volunteers may leave projects without coordinator approval| Existing organization-wide setting; confirmed in the previous design record
Whether coordinators may resolve time-entry conflicts| Still unresolved
Whether coordinator notifications are sent for direct volunteer self-assignment and self-removal| Optional behavior; exact configuration not decided
Notification retention period| Undecided

The server must enforce authorization and applicable organization settings. UI controls alone are not sufficient to enforce permissions.

8. Deferred and unresolved matters

The following matters must remain open and must not be treated as accepted design decisions.

8.1 Project archiving — deliberately deferred

All project-archiving questions are set aside for later discussion.

**Resolved 18 November 2026:** every item below is answered — authority in §16.6 (D-041), assignment effects in §16.9 (D-042), restore in §16.10 (D-043). The list is kept as a record of what was deferred and when it closed.

This included:

- ~~Who may archive a project.~~ Resolved (§16.6, D-041).
- ~~Whether coordinator-initiated archival requires administrator approval.~~ Resolved: no approval step (§16.6, D-041).
- ~~What happens to existing assignments when a project is archived.~~ Resolved (§16.9, D-042).
- ~~Whether archival automatically ends assignments or changes their operational status.~~ Resolved: volunteer assignments end at the archival instant, coordinator assignments do not (§16.9, D-042).
- ~~Whether archived projects may be restored.~~ Resolved: yes, by the same authority, without reviving assignments (§16.10, D-043).

Previously agreed constraints remain: archived projects and activities preserve historical records and do not accept new time entries. No further archival behavior is settled by this supplement.

8.2 Assignment audit trail

Identifying who created or ended an assignment, and recording reasons for assignment changes, are deferred beyond the MVP.

8.3 Notifications

The following remain undecided:

- Notification retention period and automatic cleanup.
- Whether organization administrators may manage other users' notifications.
- Detailed notification settings and presentation.
- Whether coordinator notifications for direct volunteer self-assignment and self-removal should be mandatory or configurable.

8.4 API and database design

This supplement defines behavior and requirements, not a final implementation. The following remain to be designed:

- Whether volunteer and coordinator assignments use one generalized assignment resource or separate resource concepts.
- Exact assignment status values and transition rules.
- The API routes, request/response DTOs, and database constraints for assignments and requests.
- ~~Idempotency behavior for retries and offline synchronization.~~
  **Resolved 23 November 2026 — client-generated ids and version-guarded
  writes (§16.16, D-049).**
- Exact notification resource fields and API operations.
- The implementation of last-coordinator confirmation, including how the server validates the relevant state.

9. Implementation principles

The following principles apply to the decisions above:

1. Enforce permissions server-side. The API must validate the actor's role, organization membership, project scope, and applicable settings.
2. Separate requests from assignments. An approval-based request is not an active assignment. When approval is not required, self-assignment creates an assignment directly.
3. Preserve history. Ending an assignment or withdrawing a request must not erase its record.
4. Use new records for new assignment periods. Reassignment creates a new assignment record.
5. Keep notifications separate from business records. Notification deletion must not affect the underlying event or assignment.
6. Avoid unnecessary notifications. Direct volunteer assignment changes notify the affected volunteer only. Coordinator notifications follow the event-specific rules above.
7. Keep unresolved decisions open. Recommendations and optional behavior must not be converted into mandatory requirements without approval.


# 15. Supplementary Decision Record — Updates Since 25 October 2026

**Update date:** 28 October 2026  
**Purpose:** Record decisions, accepted recommendations, deferred features, and unresolved questions from subsequent design discussions. This section supplements the existing design decision record; it does not replace earlier sections.

## 15.1 Status conventions

The following distinctions apply throughout this section:

- **Confirmed decision:** The user explicitly selected or confirmed the behavior.
- **Accepted recommendation:** The user accepted a proposed design recommendation.
- **Deferred — not MVP:** The feature or decision is postponed; this does not necessarily mean it has been rejected permanently.
- **Under consideration:** A recommendation has been discussed but has not been adopted.
- **Open question:** The behavior remains undecided and must not be implemented as though it were settled.
- **Future enhancement:** A potential later feature that is not part of the MVP requirements.

Where this section adds detail to an existing decision, the more specific rule should be read alongside the original decision rather than as an independent replacement.

---

## 15.2 Membership suspension and revocation

### 15.2.1 Membership suspension

**Confirmed decision — Deferred from MVP.**

Membership suspension will not be implemented in the MVP. It may be considered for a future update.

### 15.2.2 Membership revocation

**Status: Under consideration.**

The following behavior has been proposed but has not been accepted:

- Revoking a volunteer's organization membership would immediately remove their access to protected organizational resources.
- Historical time entries, assignment records, and other historical records would be retained.
- The revoked membership could no longer be used to create time entries or make project-assignment changes.
- Data recorded offline would remain preserved on the device. The server would recheck authorization when the client subsequently synchronized that data.

The following issues remain open:

1. What happens to a running timer when membership is revoked? (Moot in the MVP: no server timer exists — D-048, §16.15.)
2. Can a revoked membership be restored, or must the user obtain a new membership?
3. How should offline changes created before revocation be handled when the server rejects them after revocation?
4. What happens to pending requests and approvals associated with the revoked membership?

No implementation requirements should be inferred from the proposed revocation rules until they are explicitly accepted.

---

## 15.3 Project assignments, coordinator authority, and notifications

This section records additional decisions about assignment management, request handling, and notifications.

### 15.3.1 Multiple coordinators and projects without coordinators

**Confirmed decisions:**

- A project may have multiple coordinators.
- The MVP does not require a designated lead coordinator.
- An active project may temporarily have no coordinator.
- The interface should warn when an active project has no coordinator. The precise warning and confirmation interaction belongs to UI design.
- Removing the last coordinator from an active project requires confirmation. If confirmed, the project remains active without a coordinator.
- A coordinator may remove themselves, subject to the same last-coordinator confirmation requirement.

**Archival authority resolved 18 November 2026 (§16.6, D-041):** a coordinator assigned to a project may archive that project or an activity within it, and an organization administrator may archive any project or activity in the organization. The same permission governs restore, whose mechanics are fixed in §16.10 (D-043).

### 15.3.2 Organization administrator authority

**Confirmed decisions:**

- Organization administrators may manage any project within their organization without being explicitly assigned as its coordinator.
- An administrator's organization-wide authority does not automatically create a coordinator assignment or cause the administrator to appear in the project's coordinator list.
- Organization administrators may add or remove coordinator assignments for any project in the organization.
- Restrictions on coordinator assignment-management privileges do not limit administrators.

### 15.3.3 Coordinator assignment-management permissions

**Accepted recommendation:**

An organization-level setting controls whether already-assigned coordinators may add or remove other coordinators from projects.

- The default is enabled.
- The permission applies only to coordinators already assigned to the relevant project.
- Organization administrators retain their organization-wide assignment-management authority.
- Coordinators cannot assign themselves to projects.
- No coordinator self-assignment request workflow is required for the MVP; authorized administrators or coordinators manage coordinator assignments.

### 15.3.4 Direct volunteer assignment changes

**Confirmed decisions and previously accepted recommendations:**

- Organization administrators may add or remove volunteers on any project.
- Assigned coordinators may add or remove volunteers only on projects they coordinate.
- Direct assignment by an authorized person is distinct from a volunteer's self-assignment request.
- Any approved volunteer may request assignment to any active project. Project-specific eligibility restrictions are deferred from the MVP.
- An organization-wide setting determines whether self-assignment takes effect immediately or requires coordinator/administrator approval.
- If approval is not required, the volunteer joins immediately and no assignment request is created.
- If approval is required, the request remains pending until approved, rejected, or withdrawn.
- A pending assignment request does not authorize project-based time logging.

### 15.3.5 Assignment request lifecycle

**Confirmed decisions:**

- Pending assignment requests do not expire automatically in the MVP.
- A volunteer cannot create duplicate pending requests for the same project.
- A volunteer who already has an active assignment cannot submit another request for that assignment.
- After rejection or withdrawal, the volunteer may submit a new request.
- Retried or repeated requests must not create duplicate records.
- Any coordinator assigned to a project may approve or reject volunteer assignment requests for that project. Organization administrators may do so for any project.
- Rejection reasons are optional. If provided, the reason should be included in the notification to the volunteer.
- A volunteer may withdraw their own pending request at any time before a decision is made.
- Withdrawal preserves the request's history. A withdrawn request may be followed by a new request.
- Approved or rejected requests cannot subsequently be withdrawn.

### 15.3.6 Assignment history

**Confirmed decisions:**

Assignment records are retained after an assignment ends. Records should preserve, at minimum:

- The person assigned.
- The project.
- The assignment type, distinguishing volunteer and coordinator assignments.
- The start time.
- The end time, if applicable.
- The current assignment status.

Reassignment after an earlier assignment has ended creates a new assignment record rather than reactivating the old record.

**Deferred consideration:** Recording who created or ended each assignment, and an associated reason, is not required as a finalized MVP requirement. This remains a potential enhancement.

### 15.3.7 Assignment departure and historical time

The existing rules for work performed before a volunteer leaves a project remain in force:

- Historical work may be submitted after the assignment ends if it falls within the permitted assignment period.
- Timestamp-based entries must end at or before the effective assignment end time.
- Duration-only entries may use the departure date as their work date or an earlier date.
- The departure date is inclusive.
- Entries for work after the effective departure boundary must not be accepted as valid project work.

The exact timestamp storage and timezone semantics remain to be specified.

### 15.3.8 Notifications

**Confirmed decisions:**

- Notifications are in-app only for the MVP.
- Notifications are persisted server-side.
- Users may mark their notifications as read or delete them.
- Deleting a notification must not delete the underlying business record.
- Direct volunteer assignment or removal by a coordinator or administrator notifies the affected volunteer, but does not notify other coordinators.
- When approval is required for a volunteer assignment request, all assigned coordinators are notified of the new request and its withdrawal.
- The volunteer is notified when their request is approved or rejected. A supplied rejection reason is included.
- A newly assigned coordinator is notified of their assignment.
- A removed coordinator is notified of their removal.
- Other coordinators are not notified about direct coordinator assignment changes.
- When volunteers join or leave a project without an approval requirement, notifying coordinators may be enabled, but it is not mandatory.

**Open questions:**

- Notification retention policy.
- Whether administrators may manage other users' notifications.
- Exact notification event names, payloads, and delivery guarantees.

---

## 15.4 Time-entry creation and submission

### 15.4.1 Timer-based entries

**Deferred 22 November 2026 (D-048, §16.15):** the timer described here
is a server-side running timer, which the MVP does not have. The section
is retained for a later release and does not describe MVP behaviour. In
the MVP the stopwatch runs on the device and pre-fills the manual
timestamp form; the hybrid rule below still holds, applied to that form —
finish the work, then choose Log time or Save as draft.

**Confirmed decision — Hybrid submission workflow.**

When a volunteer manually stops a running timer, the application presents an option to log the recorded time.

The form should be quick to complete because relevant fields are pre-filled where possible, including:

- Start time.
- End time.
- Calculated duration.
- Project and activity, where available.

The volunteer can choose either:

1. **Log time:** Submit the entry under the organization's approval policy.
2. **Save as draft:** Keep the entry on the device without sending it anywhere.

Drafts may be submitted later. Until then they exist only on that device (§16.11, D-044).

Stopping a timer and submitting a time entry are separate actions. The recorded time must not be lost merely because the volunteer does not submit the entry immediately.

### 15.4.2 Manual entries

**Confirmed decision:** Manual entries use the same hybrid workflow.

The volunteer completes the manual entry form and chooses either **Log time** or **Save as draft**. Drafts may be submitted later, and live only on the device until submitted (§16.11, D-044).

Manual entries continue to support both established formats:

- Exact start and end timestamps.
- Work date and total duration, without exact timestamps.

### 15.4.3 Submission and approval are separate concepts

The submission workflow does not replace the existing organization-wide approval policy.

- A submitted entry follows the current organizational approval policy.
- If approval is required, the entry enters the applicable approval workflow.
- If approval is not required, the entry is handled under the policy that applies to entries not requiring approval.
- Saving a draft does not constitute submission for approval.

The exact lifecycle state machine and approval transitions remain to be finalized. Submission is explicit rather than automatic (§16.11, D-044), and the approval policy applied to a submission is the one in force when it is received (§16.12, D-045).

---

## 15.5 Time-entry editing permissions and state handling

### 15.5.1 Editing in place

**Confirmed decision — Adopted recommendation.**

Authorized users may edit an existing time entry in place rather than having to create a replacement entry.

The existing record and its audit history must be preserved.

### 15.5.2 Editing permissions

**Accepted recommendation:**

| Actor | Editing authority |
|---|---|
| Volunteer | May edit their own entries. |
| Assigned coordinator | May edit entries belonging to volunteers assigned to a project they coordinate, but only when the entry relates to that project. |
| Organization administrator | May edit any time entry in the organization. |

These permissions do not automatically grant approval authority or conflict-resolution authority. Those are separate permissions governed by their respective rules.

### 15.5.3 Editing by entry state

**Confirmed decision — Adopted recommendation.**

The editing permissions above apply across all four entry states:

- **Draft:** Exists only on the volunteer's device (§16.11, D-044) and may be edited freely there. The server-side permissions below begin at submission.
- **Pending approval:** May be edited. The approval workflow must reflect the latest version of the entry.
- **Approved:** May be edited. Material changes may trigger renewed approval under the organization's policy. Previous approvals and changes remain in the audit history.
- **Rejected:** May be corrected and resubmitted. Rejection history is retained.

A coordinator editing a volunteer's pending entry does not require the volunteer to recreate it.

### 15.5.4 Material changes and reapproval

The existing direction remains that material changes to an approved entry may trigger reapproval when required by organizational policy.

**Open questions:**

- Which fields or changes are material?
- Does a material edit immediately change the approval status, or does the entry remain approved while reapproval is pending?
- What happens if an entry is edited repeatedly while awaiting renewed approval?
- How should concurrent edits by multiple authorized users be detected and resolved?

These details must be specified before the approval and concurrency contracts are finalized.

---

## 15.6 Time-entry deletion and voiding

**Status: Deferred decision.**

No deletion or voiding policy has been adopted.

The following proposals were discussed but remain undecided:

- ~~Whether drafts may be permanently deleted or must be retained as discarded records.~~ Resolved: unsubmitted drafts are device-local, so discarding one is a device action (§16.11, D-044).
- Whether submitted entries may be marked as void or erroneous.
- Whether voided approved entries must be excluded from valid reported hours.
- Who may delete, discard, or void entries.
- What reasons and audit records are required for these operations.

The previous recommendation against permanent deletion must not be treated as an accepted requirement. The user explicitly deferred this decision for later.

---

## 15.7 Time-entry retrieval model

### 15.7.1 A common filtered retrieval model

**Confirmed decision — Adopted recommendation.**

The MVP will use a single filtered, paginated time-entry retrieval model rather than separate list endpoints for each role or use case.

The retrieval model will support filters for:

- Volunteer.
- Project.
- Activity.
- Work-date range.
- Initial submission-time range.
- Lifecycle status.
- Approval status.
- Conflict status.

The exact endpoint paths, parameter names, request/response DTOs, and error envelope remain to be designed.

### 15.7.2 Default visibility

**Confirmed decision — Adopted recommendation.**

By default, the API returns all time entries the caller is authorized to see, including rejected entries and entries awaiting approval. Unsubmitted drafts are not included, because they never reach the server (§16.11, D-044).

- Volunteers see their own entries across all states.
- Coordinators see entries within their existing project-scoped authority.
- Organization administrators see all entries in their organization.

The client may organize results into tabs, sections, or views, but this is a UI concern rather than a requirement to create separate retrieval endpoints.

### 15.7.3 Explicit `volunteerId` filter

**Clarification to the retrieval model:**

The client will include `volunteerId` when retrieving entries for a volunteer, including when retrieving the active user's own entries. In that case, the requested ID matches the volunteer ID associated with the active account.

The server must independently enforce authorization. A client-supplied `volunteerId` is a filter, not proof of identity or permission.

### 15.7.4 Cursor-based pagination

**Confirmed decision — Adopted recommendation.**

The MVP will use cursor-based pagination.

- Default page size: **50 entries**.
- Maximum page size: **100 entries**.
- If the client requests a page size above 100, the server caps it at 100.
- The response includes a cursor when another page is available.
- The cursor format is specified in §16.2, and the list response field names are fixed in §16.5 (D-040).

### 15.7.5 Default ordering

**Confirmed decision:**

Time entries are ordered newest first by default, based on when the work occurred.

- Timestamp-based entries are ordered using their work timestamps.
- Duration-only entries are ordered using their work dates.
- A deterministic tie-breaker, such as entry ID, will be used to make ordering predictable for cursor-based pagination.

**Resolved 15 November 2026 (§16.3, D-038):** ordering is by work date, then effective start time, then entry ID; duration-only entries sort last within their date.

### 15.7.6 Cursor and query consistency

**Confirmed decision:**

A cursor is tied to the original query context, including its filters and sort order.

- The client must retain the same filters and sort order when requesting subsequent pages.
- Changing a filter or sort order requires a new query without the previous cursor.
- The API should reject a cursor used with an incompatible query rather than silently applying unexpected pagination behavior.

**Resolved 15 November 2026 (§16.2, D-037):** encoding, integrity protection, expiration, and query-context validation are specified as opaque signed tokens.

### 15.7.7 Results changing during pagination

**Open question — Not yet decided.**

Two approaches were discussed:

- **Live results:** Each page reflects data available when that page is requested. The server attempts to minimize duplicates and omissions but does not guarantee a frozen snapshot.
- **Snapshot results:** The initial request establishes a consistent snapshot used for all subsequent pages.

**Resolved 15 November 2026 (§16.1, D-035):** live results confirmed. The recommendation recorded here was accepted.

---

## 15.8 Time-entry filters and query semantics

### 15.8.1 Work-date filters

**Confirmed decision:**

Both timestamp-based and duration-only entries use the same work-date filter.

- Timestamp-based entries derive their work date using the organization's configured time zone.
- Duration-only entries use their stored work date.

This lets clients retrieve entries for a reporting period without needing different filter semantics for each entry format.

### 15.8.2 Inclusive date ranges

**Confirmed decision:**

Start and end dates are inclusive.

For example, requesting entries from `2026-10-01` through `2026-10-31` includes entries on both dates.

The server will translate these calendar-date boundaries into appropriate internal timestamp boundaries using the organization's configured time zone.

### 15.8.3 Submission-time filters

**Confirmed decision:**

The MVP will support filtering by submission time independently of work date.

The API must distinguish:

- **Work date/time:** When the work occurred.
- **Initial submission time:** When the entry was first submitted to the server.
- **Last-modified time:** When the entry was most recently changed.

Editing an entry must not overwrite its initial submission timestamp.

This distinction is especially important for offline operation, where work may be recorded well before the entry reaches the server.

### 15.8.4 Project and activity filters

**Confirmed decision — Adopted recommendation.**

Both `projectId` and `activityId` filters are supported.

- A project filter returns entries associated with that project, including entries linked to its activities.
- An activity filter returns entries associated with that activity.
- If both are supplied, an entry must satisfy both filters.
- If the specified activity does not belong to the specified project, the API returns a validation error.
- Project-less entries remain retrievable without a project filter.

### 15.8.5 Volunteer filter

**Confirmed decision — Adopted recommendation.**

The API supports filtering by `volunteerId`.

- Volunteers may query their own entries.
- Coordinators may query entries within their project-scoped authority.
- Organization administrators may query entries for any volunteer in their organization.
- The server enforces authorization regardless of the requested ID.

### 15.8.6 Independent status filters

**Confirmed decision — Adopted recommendation.**

The API exposes independent filters for:

1. **Lifecycle status**, such as submitted or voided. Unsubmitted drafts are not a server state (§16.11, D-044).
2. **Approval status**, such as pending, approved, rejected, or not requiring approval.
3. **Conflict status**, representing relevant synchronization or timer conflicts.

These are distinct concepts and must not be collapsed into one combined status field. The exact lifecycle and enum values remain to be finalized.

### 15.8.7 Combining filters

**Confirmed decision for MVP: AND semantics.**

Every supplied filter must match an entry for that entry to be returned.

For example, a request specifying a project, volunteer, and pending approval status returns only entries satisfying all three conditions.

Project/activity intersection semantics remain as specified above.

**Future enhancement:** Consider a user-selectable AND/OR mode. The future design must define whether OR applies across all filters or only within selected filter groups. OR behavior is not an MVP requirement.

### 15.8.8 Invalid filters

**Confirmed decision:**

Invalid filters and invalid filter combinations are rejected with a structured validation error.

Examples include:

- `startDate` occurring after `endDate`.
- An activity that does not belong to the specified project.
- Invalid parameter values or unsupported filter combinations.

The API must not silently ignore invalid filters and return results based on a broader query than the client intended.

**Response shape resolved 15 November 2026 (§16.4, D-039):** `400 VALIDATION_FAILED` with one `details.errors[]` entry per failing filter, all failures returned together.

### 15.8.9 Unauthorized filter values

**Confirmed decision:**

When a caller requests entries outside their authorization scope, the API returns a consistent, generic authorization error without disclosing protected information.

A valid but unauthorized volunteer ID must not reveal whether that volunteer or their entries exist outside the caller's permissions.

This behavior is distinct from a valid, authorized query that returns no matching entries.

**Resolved 15 November 2026 (§16.4, D-039):** a supplied but out-of-scope filter value returns `403 FORBIDDEN` with the same body as a nonexistent one, so the two cannot be distinguished. A valid authorized query with no matches returns `200` with an empty list.

---

## 15.9 Retrieval features deferred from MVP

### 15.9.1 Filtering by editor

**Confirmed decision — Deferred, with future consideration.**

The MVP will not support filtering time-entry lists by the person who last modified an entry, such as an `updatedBy` filter.

Audit history must still record changes and the actor responsible, according to the audit-history design. Deferring the filter does not mean deferring change tracking.

### 15.9.2 Filtering by time spent in a state

**Confirmed decision — Deferred, with future consideration.**

The MVP will not provide dedicated state-age filters such as:

- Unsubmitted drafts older than 30 days; these are device-local and outside the API's view (§16.11, D-044).
- Entries pending approval for more than 7 days.

The existing status, work-date, and submission-time filters remain available.

Future versions may introduce state-age filters if organizations need stale-draft reminders, approval-backlog reporting, or similar workflows.

---

## 15.10 Summary of newly established retrieval requirements

The following example is illustrative, not a finalized endpoint or parameter contract.

A request conceptually equivalent to:

```text
GET /v1/time-entries
    ?volunteerId={volunteerId}
    &projectId={projectId}
    &activityId={activityId}
    &startDate=2026-10-01
    &endDate=2026-10-31
    &approvalStatus=pending
    &pageSize=50
```

would request entries satisfying all supplied filters, provided that:

- The caller is authorized to access the requested entries.
- The activity belongs to the specified project.
- The date range is valid and inclusive.
- The requested page size is within the permitted limits.

The example does not establish the final route, query parameter names, enum values, cursor representation, or error schema.

---

## 15.11 Resource inventory additions and refinements

The existing conceptual resource inventory should account for the following concepts:

- **AssignmentRequest:** Represents a volunteer's pending, approved, rejected, or withdrawn request for project assignment when approval is required. No request is created for an immediately effective self-assignment.
- **Notification:** Represents a persistent in-app notification. Deleting a notification does not delete the underlying business record.
- **TimeEntry lifecycle:** The submission workflow must be represented separately from approval and conflict state. There is no server-side draft resource: drafts live on the device until submitted (§16.11, D-044).
- **Initial submission time:** Must be preserved independently of last-modified time.
- **Audit history:** Must preserve relevant edits and prior approval/rejection decisions.
- **Assignment history:** Ended assignments remain historical records; reassignment creates a new record.

The exact physical data model remains open. In particular, the design has not finalized whether volunteer and coordinator assignments share one generalized assignment resource, whether conflict information is stored as a separate resource, or how audit history is represented in the database.

---

## 15.12 Outstanding decisions after this update

The following items remain unresolved. They should be addressed before or during API contract design, according to their importance.

### Priority 1 — Time-entry lifecycle and approval

1. Define the complete lifecycle state machine for drafts, submitted entries, pending approval, approved entries, and rejected entries.
2. Define the exact behavior of approval when an entry is edited, including the meaning of a material change.
3. ~~Decide what happens to pending entries when organizational approval settings change.~~ **Resolved 22 November 2026 — the policy in force at submission governs; later changes affect only later submissions (§16.12, D-045).**
4. ~~Define approval authority, including the boundaries of coordinator authority for project-less entries and other entries outside their projects.~~ **Resolved 23 November 2026 (D-051, §16.18):** approval authority is an active coordinator grant on the entry's project, excluding the entry's author, or the administrator role; project-less entries are administrator-only. Which categories of entry require approval at all remains open.
5. Define the handling and reporting of invalid, out-of-period, or conflicting submissions that must be preserved rather than silently discarded.
6. Decide how edits made concurrently by multiple authorized users are detected and reconciled. **Detection resolved 23 November 2026 — optimistic concurrency on an integer `version`, with `409 VERSION_MISMATCH` carrying the current representation (§16.16, D-049). The reconciliation interface for a detected edit remains open.**

### Priority 2 — Retrieval and pagination

7. ~~Decide whether pagination uses live results or a consistent snapshot.~~ **Resolved 15 November 2026 — live results confirmed (§16.1, D-035).**
8. ~~Define the stable ordering of mixed timestamp-based and duration-only entries.~~ **Resolved 15 November 2026 — start-time anchor, duration-only entries last within their date (§16.3, D-038).**
9. ~~Specify cursor structure, validation, expiration, and response fields.~~ **Resolved — opaque signed tokens (§16.2, D-037), with the list response body fixed as `items` / `nextCursor` / `pageSize` (§16.5, D-040).**
10. ~~Define the exact validation and authorization error codes, HTTP status codes, and error envelope.~~ **Resolved 15 November 2026 — custom envelope with `code` as the contract, status and disclosure rules fixed (§16.4, D-039).**

### Priority 3 — Project lifecycle and permissions

11. ~~Decide who may archive projects and activities.~~ **Resolved 18 November 2026 — coordinators within their project remit, administrators organization-wide, no approval step (§16.6, D-041).**
12. ~~Decide how archival affects active assignments, pending requests, and historical time entry.~~ **Resolved 18 November 2026 — dated boundary: volunteer assignments end, pending requests cancel, pending entries stay reviewable, pre-archival work stays valid, running timers stop into pre-filled drafts on the volunteer's device (§16.9, D-042; §16.11, D-044).**
13. ~~Decide whether archived projects or activities can be restored.~~ **Resolved 18 November 2026 — reversible by the same authority, without reviving assignments (§16.10, D-043).**
14. Confirm whether coordinators may resolve conflicts for volunteers assigned to their projects and how project-less entries are treated.
15. Finalize whether volunteer and coordinator assignments use a generalized resource or separate resources.
16. Define the consequences of assignment departure for pending time entries and requests, beyond the established historical-work eligibility rule.
17. Finalize timestamp and timezone semantics for assignment boundaries.
18. Decide the membership-revocation rules and whether revoked memberships may be restored.

### Priority 4 — Entry deletion and operational details

19. ~~Decide whether drafts may be permanently deleted or must be retained as discarded records.~~ **Resolved 22 November 2026 — drafts never reach the server, so discarding one is a device action (§16.11, D-044).**
20. Define whether submitted entries may be voided and the associated permissions, audit requirements, and effect on reported hours.
21. Finalize overlap warning and review behavior.
22. Decide whether project-less activity descriptions are stored separately from optional notes.
23. Finalize required and optional profile fields and email-change verification behavior.
24. **Entry submissions settled:** an approval-policy change applies only to submissions received after its effective time (§16.12, D-045). Still open: the effects of policy changes on pending assignment requests and other pending operations.
25. Define notification retention and whether administrators can manage other users' notifications.

### Priority 5 — API contract and implementation

26. Choose the authentication method/provider and determine whether authentication is managed or self-hosted. **Hosting resolved 23 November 2026 — each organisation runs its own instance, so authentication is self-hosted per instance (§16.17, D-050). The session layer is settled 24 November 2026 (§16.23, D-056) — bearer tokens, a single-use rotating refresh token, and a mobile-only client, so no cookie and no CORS. The credential itself remains open (§3.1).**
27. Design the first-administrator bootstrap process. **Now a per-instance installation step (§16.17, D-050); the process is still undesigned.**
28. Finalize database schema, constraints, and transaction requirements.
29. Define endpoint paths, HTTP methods, request/response DTOs, validation rules, and error codes.
30. Design offline synchronization operations, change tracking, retry/idempotency behavior, and conflict responses. **Retry and idempotency resolved 23 November 2026 — the entry id is the deduplication record and `version` guards writes (§16.16, D-049). Change tracking and conflict responses remain open.**
31. Define API versioning, security controls, deployment, backups, and monitoring. **Deployment is per instance (§16.17, D-050), so API version skew between an installed app and an instance that upgrades on its own schedule is a supported state rather than a hypothetical. Versioning is contract-blocking, not operational polish.** **URL versioning settled 24 November 2026: every route is prefixed `/v1`, and every path in this record is written that way.** What remains open is the compatibility and deprecation policy — what an old client does against a `/v2` instance, and for how long `/v1` is served.

Items may be combined or deferred where appropriate. The list is a planning aid, not a requirement to settle every item before drafting any part of the API contract.

---

## 15.13 Recommended next step

Continue resolving the remaining lifecycle and permission questions one at a time.

**Superseded:** the immediate question recorded here — live results versus a consistent snapshot — was resolved on 15 November 2026 in favour of live results (§16.1, D-035). The current next step is recorded in the outstanding-decisions list at the head of §16.

Once the core lifecycle, authorization, and conflict-handling rules are sufficiently clear, begin drafting the API contract rather than attempting to resolve every implementation detail in advance.

The contract should explicitly identify which behaviors are finalized, which are implementation choices, and which remain deferred.

------------------------------------------------------------------------

# 16. Supplementary Decision Record — Updates Since 28 October 2026

**Update date:** 15 November 2026  
**Purpose:** Record decisions taken after §15, and register follow-up decisions that were explicitly deferred. Decision IDs continue from the §12 register; decisions recorded in §15 were not assigned IDs and remain unnumbered there.

**Numbering convention (18 November 2026):** the numbered sections here are append-only. A new decision takes the next unused number at the end of §16, so no existing section number, and no reference to one, changes when a decision is recorded. Numbers are never reused: §16.8 was the outstanding-decisions list before it became the unnumbered list below. That list is the only part of §16 rewritten as decisions land.

## Outstanding decisions (maintained in place)

Resolved so far: §15.12 item 3 (approval-setting changes, §16.12), item 7 (live results), item 8 (mixed ordering), item 9 (cursor structure, validation, and response fields), item 10 (error envelope), item 11 (archive authority), item 12 (effects of archival), item 13 (restore). Also resolved outside that sequence: §13 item 5 (explicit submission, §16.11), §15.12 item 4 (approval authority, §16.18), and backlog items B1 (time and duration model, §16.13), B2 (definition of an overlap, §16.14), B4 (mutation identity and concurrency, §16.16), B5 (organisation model, §16.17), B6 (role and permission matrix, §16.18), B7 (retention and erasure, §16.19), B8 (list contract for the other collections, §16.21), B12 (mutation response shapes, §16.22), B13 (request identity and load control, §16.20) and B14 (the session model, §16.23). Backlog item B3 (timer semantics) is deferred rather than resolved: it left the MVP with the server timer (D-048, §16.15), which is why the sequence below begins at B16.

Retrieval is specified end to end: live pages (§16.1), a total order (§16.3), an opaque cursor (§16.2), one response body (§16.5). The project lifecycle is closed out: authority (§16.6), effects (§16.9), restore (§16.10). Remaining, in the order they will be taken:

1. Import/export mechanism (§16.7, D-036) — deferred, to be taken up next.
2. **Counting for UI elements** — unread notifications and pending requests, among others. Deferred: figures are calculated in the API business layer and returned to the requests that need them, not derived from paginated list responses. No decision ID assigned yet.

All other items in §15.12 remain unchanged and unresolved. Gaps that never appeared in §§13–15.12 at all are tracked separately as a decision backlog in §17 (B1–B19), which also flags which of them block the API contract. That backlog is now the active sequence, beginning with B16 (the backdating window), with B3 deferred by scope (D-048, §16.15), B4–B7 settled (§16.16–§16.19), B8 settled (§16.21), B12 settled (§16.22), B13 settled (§16.20) and B14 settled (§16.23). The entry-lifecycle questions not queued above — the state machine (item 1), material change (item 2), preserved invalid submissions (item 5), concurrent edits (item 6) — are next in line once the two deferred items are settled.

## 16.1 Retrieval consistency: live results

**Confirmed decision (D-035) — 15 November 2026.**

Time-entry retrieval uses **live results**. Each page reflects server state at the time that page is requested. The server does not hold a snapshot, materialise a result set, or freeze membership across a client's scroll session.

**Guarantee the API provides:**

- Keyset ordering is total and deterministic, so entries inserted during a scroll do not cause an entry to appear on two pages.
- An entry may be **repeated or omitted** within a scroll session if its ordering key changes mid-session — for example, an edited work date moving the entry across the cursor frontier.
- An entry may **appear late** on a later page if it synchronises in with a work date older than the cursor frontier. This follows from offline capture (§7.1, §7.3) and is expected behaviour, not a defect.

**Client obligations:**

- Deduplicate displayed or acted-on entries by entry ID.
- Treat a scroll session as a view of current state; refresh rather than assume completeness.

**Considered and rejected:**

- **Consistent snapshot.** Requires per-session server state — materialised ID lists with TTL, cleanup, and a cap on concurrent sessions — and cannot hold a database transaction open across stateless HTTP requests. Freezing contents as well as membership would additionally require historical row versions.
- **Live results with an `asOf` submission-time watermark.** Cheap, and implementable from the initial-submission timestamp already required by §15.8.3, but it dampens only insert churn: in-place edits (§15.5.1) still change rows inside the window. The guarantee would be partial while appearing to be a snapshot.

**Forward compatibility:** cursors remain opaque and query-bound (§15.7.6), so an optional explicit-consistency parameter can be added later without breaking the contract.

**Rationale:** the reporting need that would justify snapshots is distinct from interactive listing, and is addressed by the deferred import/export decision in §16.7 rather than by adding snapshot semantics to list pagination.

## 16.2 Cursor encoding: opaque signed tokens

**Confirmed decision (D-037) — 15 November 2026.**

Time-entry cursors are opaque, stateless, signed tokens. A cursor is not stored server-side, has no expiry, and conveys only a position in a result set.

**Format:** `kid.payload.signature` — a key identifier, a base64url-encoded JSON payload, and a base64url HMAC-SHA256 signature over the exact payload bytes. The key identifier is emitted first so the server can select a verification key before parsing anything.

**Payload fields:**

- `v` — format version (integer), so the payload can change without breaking clients holding older cursors.
- `k` — the ordering tuple of the last row returned, fixed in §16.3: `[work date, effective time, entry ID]`. It is a total-order tuple ending in the entry ID tie-breaker.
- `q` — fingerprint of the normalised filter set and sort order, HMAC-SHA256 truncated to 16 bytes.

**Rules:**

- The fingerprint covers filters and sort order only. `pageSize` is excluded, so a client may change page size mid-scroll without an error.
- Tokens longer than 1 KiB are rejected before parsing.
- Cursors have no expiry. Because retrieval is live (§16.1) and a cursor is only a keyset position, an old cursor remains valid and resumes from that position after any length of time.
- Cursors are signed but not encrypted. Their contents — entry ID, sort value, and a fingerprint of filters the caller itself supplied — are not secret.
- Integrity is for diagnosability, not access control. A malformed or tampered token produces a clean error instead of a surprising page. Authorization is re-evaluated on every request (§4.5); a cursor never conveys or widens access.
- Key rotation uses the `kid` prefix: the previous key is accepted during rotation, and cursors minted before rotation fail cleanly as `INVALID_CURSOR`, after which the client restarts pagination. The signing key is a 32-byte secret from configuration, never from source.
- Implementation is a self-contained module — encode, decode, fingerprint — with no database or HTTP dependency, called from the HTTP layer. This follows the layering principle in §11.

**Error behaviour (codes fixed here; envelope deferred to the error-envelope decision):**

- `400 INVALID_CURSOR` — undecodable, bad signature, unknown version, or oversize. Remedy: restart pagination.
- `400 CURSOR_QUERY_MISMATCH` — fingerprint does not match the supplied filters or sort order (§15.7.6). Remedy: a client bug or a filter change without a reset; it must not be silently accepted.

**Considered and rejected:**

- **Transparent parameters** such as `afterId`, `afterSortValue`, and `sort=…`. Readable in transport and trivial to debug, but they expose ordering internals as public contract, prevent query-mismatch detection, and couple existing app versions to current sort semantics.
- **Encrypted cursors.** Hides non-secret contents at the cost of additional key management, with no confidentiality benefit.

**Resolved:** the representation of `k` is fixed by the ordering decision in §16.3.

## 16.3 Entry ordering: mixed timestamp and duration-only

**Confirmed decision (D-038) — 15 November 2026.**

Time-entry lists are ordered newest first by work date, then time within the day, then entry ID:

```sql
ORDER BY work_date DESC,
         COALESCE(local_start_time, '00:00:00') DESC,
         entry_id DESC
```

- `work_date` and `local_start_time` are derived from the entry's start instant in the organisation's configured time zone, using the same derivation §15.8.1 requires for filtering. Deriving both the same way is part of the decision: filtering and ordering must never disagree about which date an entry belongs to.
- Timestamped entries are anchored at their **start**, not their end.
- Duration-only entries sort **after** every timed entry on the same date, because they make the least precise claim about when the work happened. The server does not invent a time of day (§6.5).
- The entry ID terminates the ordering, making it total and stable — the property D-035's guarantee depends on.

**Cursor tuple.** D-037's `k` is therefore:

```
k = [ "YYYY-MM-DD", "HH:MM:SS.mmm", "<entry-id>" ]
```

Duration-only entries encode the start-of-day sentinel value used in the ordering expression, never a null, so cursor comparison stays a plain row comparison and cannot be tripped by NULL semantics.

**Consequences for schema and indexing (§15.12 item 28):** ordering and date filtering both need the derived date and effective time, so the schema must support generated columns or functional indexes over `COALESCE(work_date, (start_at AT TIME ZONE org_tz)::date)` and the matching time expression. This is a schema constraint, not a query-time detail.

**Accepted consequences:**

- "Newest first" means newest **started**. A session beginning at 16:00 and ending at 20:00 sorts below a ten-minute entry at 19:00.
- Duration-only entries cluster at the bottom of their date group.
- Ordering is derived at query time from the organisation's time zone, so a change of zone reinterprets history. Storing a derived local date was rejected: it duplicates the source of truth and can drift from the instant it came from.

**Considered and rejected:**

- **End-time anchor.** Requires a special case for running timers ("as if it ended now"), which makes an entry jump position the moment the timer stops — movement across the cursor frontier that D-035 exists to limit.
- **Work date only, with entry ID as the sole tie-break.** Cheapest to index and immune to time-of-day edits, but same-day entries would order arbitrarily, and "what happened today" is the common review case.
- **Submission-time ordering.** Decouples order from work time, so an entry syncing from an offline device a week late appears at the top; contradicts §15.7.5.

**Deferred:** client-selectable sort orders, including approval-age ordering ("oldest pending first"), which belongs with the state-age filters deferred in §15.9.

## 16.4 Error envelope

**Confirmed decision (D-039) — 15 November 2026.**

Errors use the envelope already illustrated in §10.5, now confirmed as the contract shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more filters are invalid.",
    "requestId": "b3f1c0de-…",
    "details": {
      "errors": [
        { "path": "startDate", "code": "DATE_RANGE_INVERTED", "message": "startDate must not be after endDate." }
      ]
    }
  }
}
```

**Envelope rules:**

- `code` is the contract. Clients branch on `code` and never parse `message`; `message` is human-facing and may change without notice.
- `requestId` appears on every error and is echoed in server logs and audit records.
- `details` is optional. For validation failures it carries `errors[]`, one level deep, each entry exactly `{path, code, message}`. Unconstrained `details` that differs per endpoint is rejected.
- Content type is `application/json`.
- `message` never echoes identifiers, internal exception text, or stack traces.

**Status and code mapping:**

| Status | Codes | Trigger |
|---|---|---|
| `400` | `VALIDATION_FAILED` (with field codes), `INVALID_CURSOR`, `CURSOR_QUERY_MISMATCH`, `MALFORMED_REQUEST` | Invalid filters or combinations (§15.8.8), cursor failures (D-037), unparseable body |
| `401` | `UNAUTHENTICATED` | Missing, malformed or expired credentials, a revoked or ended session, and a reused refresh token — all indistinguishable (§16.23, D-056) |
| `403` | `FORBIDDEN` (with field codes) | Authenticated, but a supplied **filter value** lies outside the caller's scope (§15.8.9) |
| `404` | `NOT_FOUND` | Addressed resource absent **or** outside scope — identical status and body either way |
| `409` | `CONFLICT`, `VERSION_MISMATCH` | State conflicts, including the in-place edit path of §15.5 |
| `413` | `PAYLOAD_TOO_LARGE` | Body over the 1 MiB cap, refused before it is parsed (D-053, §16.20) |
| `429` | `RATE_LIMITED` | Token bucket exhausted; carries `Retry-After` (D-053, §16.20) |
| `500`, `503` | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` | No internals, no identifiers |

**Disclosure rules:**

- Identifiers supplied as **filters** return `403 FORBIDDEN` whether the value does not exist or merely lies outside scope. A filter is a scope claim by the caller.
- Identifiers addressed in the **path** return `404 NOT_FOUND` in both cases. Addressing an object already asserts something about it.
- Both collapse existence, as §15.8.9 requires. The real reason goes to the server log and audit record under `requestId`, never into the response.
- A valid authorized query with no matches returns `200` with an empty item list. This is the distinction §15.8.9 insists on.

**Code governance:**

- One `code` has one meaning permanently. Retiring a code means deprecating it, never reusing it. The code inventory therefore depends on the API versioning decision (§15.12 item 31), and the full per-endpoint inventory belongs to contract drafting (§15.12 item 29).
- All failing fields are reported together, not first-failure-only: round trips are expensive for a device that has been offline for a week.
- Validation errors are raised only for fields the caller actually supplied.
- One validation status (`400`). A `400`/`422` split is rejected as a distinction clients routinely get wrong.
- No `retryable` flag yet. It belongs with retry semantics in the sync design (§15.12 item 30), where it can be defined per code. **Answered:** D-049 (§16.16) classifies by status rather than by a per-code flag, and D-053 (§16.20) puts `429` in the retry class while every other `4xx` is terminal for that request.

**Considered and rejected:**

- **RFC 9457 `application/problem+json`.** More conventional, and tooling exists, but its canonical dispatch key is a `type` URI that must be hosted and kept stable forever, it would require rewriting the §10.5 illustration, and sync-conflict detail would land in extension members at the least prescriptive part of the specification. Adopting it later is additive: `type` and `title` can be added alongside `code` without breaking clients.
- **Bare `{ "code": … }`.** Smallest response, but no room for field-level errors or correlation.
- **`403` for out-of-scope addressed resources.** Discloses existence, contradicting §15.8.9.
- **`200` with an empty list for out-of-scope filter values.** Indistinguishable from a legitimate no-match, which §15.8.9 explicitly rejects.

**Open:** the per-endpoint code inventory, and the status representation of an out-of-period submission (§10.5, §15.12 item 29).

## 16.5 Paginated list response body

**Confirmed decision (D-040) — 18 November 2026.**

Every paginated list endpoint returns a flat body with exactly three members:

```json
{
  "items": [ … ],
  "nextCursor": "<opaque token>",
  "pageSize": 50
}
```

**Field rules:**

- `items` — the array of resource representations. An empty array is a valid, successful result (§16.4); the member is never omitted.
- `nextCursor` — always present. `null` on the final page; otherwise the opaque token defined in §16.2, returned unchanged by the client as the `cursor` query parameter. No `hasMore` companion: `nextCursor !== null` means more rows exist, and a second flag could only ever disagree with it.
- `pageSize` — the **effective** page size applied to this page, not the requested one. It can be lower than the request because of the default of 50 or the 100-row cap (§15.7.4), so echoing the applied value tells the client how wide the page actually was.
- Flat shape, no nesting under `pagination`, `meta`, or `data`. These names become part of the contract: renaming them is a breaking change (API versioning, §15.12 item 31).

**Deliberately absent:**

- **No total count.** Counting — unread notifications, pending requests, and other badge figures — is computed in the API business layer and served by the endpoints that ask for it; it is not page metadata. Deferred rather than rejected (§16.7).
- **No page number, and therefore no "page 3 of 25".** A page label needs three things the contract does not provide: a total to divide, a page size fixed for the session, and a set that does not change between requests. "Of 25" is only honest under a stable snapshot, which D-035 rules out for interactive listing, so the denominator would drift mid-scroll and pages could overlap. Position is different and free: "rows 101–150" needs no server support, because the client already knows how many rows it has received.
- **No navigation links**, no per-page `requestId` (errors carry one, §16.4), no `meta` object.

**Considered and rejected:**

- **Namespaced `pagination: { nextCursor, pageSize, hasMore }`.** Groups related fields, but adds a level of nesting for three members and invites unrelated metadata to accumulate in a response that should be a page of data.
- **`hasMore` beside `nextCursor`.** Two representations of one fact, which can drift apart.
- **`data` or `results` instead of `items`.** `data` collides with payload naming used elsewhere, and `results` reads as a report or aggregate rather than a page.

**Accepted consequences:**

- One response shape for every paginated list, so a client writes one loop and reuses it.
- "How many pages are there?" is unanswerable from this response by design (§16.1). A UI that must show a denominator brings its own snapshot semantics through the deferred export/aggregate path (§16.7).

## 16.6 Project and activity archive authority

**Confirmed decision (D-041) — 18 November 2026.**

Archiving is part of managing a project, not a separate privilege, and it does not require administrator approval.

| Actor | May archive |
|---|---|
| Organization administrator | Any project or activity in the organization |
| Coordinator assigned to the project | That project, and any activity within it |
| Coordinator not assigned to the project | Nothing — the project is outside their scope (D-009) |
| Volunteer | Nothing |

**Rules:**

- Authorization is evaluated against the project assignment, not the role alone (§4.5). It is the same remit that lets a coordinator create and manage a project (§5.1) and remove its last coordinator (§15.3.1).
- Restore uses the same permission; its mechanics are fixed in §16.10 (D-043).
- A project outside the caller's scope returns `404 NOT_FOUND`, indistinguishable from one that does not exist (D-039, §15.8.9).
- Archival is idempotent: archiving an already-archived project leaves it archived rather than raising an error, because an offline client resends a queue the server may already have applied (§15.12 item 30).
- Archival writes an audit event recording actor, project, timestamp, and any reason supplied. A reason is optional in the MVP; the event is not.
- Archiving a project the coordinator is assigned to changes their own access in the same request. Like self-removal (§15.3.1) it is permitted, with a confirmation prompt.
- Administrators can reverse any coordinator's archival, so no coordinator action is final.

**Considered and rejected:**

- **Administrator-only archiving.** Tightest control, but makes administrators a bottleneck at the routine end of every project, leaves ended projects active and still accepting entries while approval waits, and contradicts coordinators managing the projects they run.
- **Coordinator initiates, administrator approves.** Would require a pending-archive state to design, notify, expire, and display, and two people to close one project.
- **An organization-level setting**, like the assignment-approval setting in §5.3. Additive later if an approval step is ever wanted above the default permission; rejected for the MVP as an unnecessary settings surface.

**Accepted consequences:**

- The actions requiring administrator sign-off stay few: roles, memberships, organization settings.
- The interface must confirm before archiving, because restoring does not bring back the assignments that archival ends (§16.10, D-043).
- A project with no coordinator can be archived only by an administrator.

## 16.7 Follow-up decision deferred: import/export mechanism

**Deferred — not designed (D-036). Status: open.**

A dedicated import/export mechanism is required for reporting and data portability, and is the proper home for consistent, reproducible totals. It is deliberately not part of MVP retrieval-pagination design.

The later decision must cover at least:

- Export scope and formats (for example CSV and/or JSON), including whether the output is stable enough to cite in external audit.
- Whether totals and detail rows come from a single consistent read, and how that consistency is achieved without snapshot pagination.
- Whether large ranges need job-style asynchronous exports, and how results are delivered, retained, and expired.
- Permission model: who may export whose data, and whether coordinator exports are restricted to their project scope.
- Whether an import path exists in the MVP at all; if so, how imported records are validated, attributed, and audited.
- Audit recording of who exported or imported what, and when.

Nothing in this section should be implemented before the decision is taken.

## 16.9 Effects of archival on assignments, requests, and timers

**Confirmed decision (D-042) — 18 November 2026.**

Archiving is a dated boundary, not a deletion. The project is stamped with an archival instant, and everything in flight is judged against that instant.

| Item | On archival |
|---|---|
| Volunteer assignments | End with an effective end time equal to the archival instant, using the existing assignment-end field (§5.5). Rows are retained, never deleted |
| Coordinator assignments | Not ended. They remain the project's management relationship, which is what lets the coordinator who archived it restore it (§16.6) |
| Pending assignment requests | Cancelled with outcome `cancelled: project archived`; the requester is notified; the request record is retained |
| Pending time entries | Unchanged, and still reviewable and approvable. Archival blocks new entries, not decisions about existing ones |
| Drafts and offline queues | Accepted when the work falls before the archival instant |
| Running timers | ~~Stopped server-side at the archival instant; the elapsed time is held and offered to the volunteer's device as a pre-filled draft awaiting confirmation (§16.11, D-044)~~ Superseded — there is no server timer in the MVP (D-048, §16.15). A device-local stopwatch is the volunteer's own state, untouched by archival |
| Activities | Archiving an activity blocks entries against that activity only; volunteer assignments belong to the project and are unaffected |

**Superseded in part 22 November 2026 (D-048, §16.15):** everything here about running timers — the row above, the timer count in the confirmation, and the server-held elapsed time offered to a device — describes a server-side timer, which the MVP does not have. The effects on assignments, requests, entries, activities and eligibility are unchanged. A device-local stopwatch is not server state and archival does not touch it; the entry it would produce is refused if its work falls after the archival instant, like any other submission.

**Rules:**

- Eligibility is judged by date, not by current status. An entry whose work time falls before the archival instant remains valid however late it is submitted or synced; work in the archival instant's future is refused (D-011).
- Archival is one transaction. A half-archived project — assignments ended, timers still running — is worse than either end state.
- The confirmation names what will happen: how many assignments end and how many pending requests will be cancelled. ~~How many running timers will be stopped~~ is dropped from the MVP's confirmation (D-048).
- ~~Stopped timers produce a pre-filled draft on the volunteer's device and a notification, never an auto-submitted entry. The server holds the stopped session's elapsed time until one of that volunteer's clients collects it, because unsubmitted drafts are not server objects (§16.11, D-044). The volunteer decides whether to keep the time.~~ Superseded (D-048, §16.15) — there is no server-held timer session to hand over.
- An entry submitted for work after the archival instant is refused as a validation failure with the submitted data preserved (D-039), not silently discarded.
- Administrators keep their organization-wide access. Archival removes assignment-based access, not administrative authority (§15.3.2).
- Archiving a project whose activities are all already archived is allowed with a warning, not blocked — the same posture as the no-coordinator warning (§15.3.1).

**Considered and rejected:**

- **Soft close** — block new assignments and entries but leave assignments active until their own end dates. Avoids a sudden change, but leaves assignments pointing at a dead project, still requires a project-status check on every entry, and pushes the cleanup onto someone who will forget it.
- **Hard close** — delete the assignments. Simple state, but destroys the eligibility record and contradicts D-011's retention of history.
- **Reject all in-flight work** — refuse pending entries and discard running timers. The cleanest boundary, and the worst outcome for trust: it destroys work volunteers actually did.
- **Auto-submit the stopped timer.** Saves the volunteer a decision, but creates an approval item they never reviewed.

**Accepted consequences:**

- Archival fans out across assignments, requests, timers, and notifications, so it must be implemented as a single transaction rather than a status write.
- Volunteers can be interrupted mid-session; the notification on their next sync is the mitigation and must name the project and the instant.
- Ended assignments stay in history, so "why did my assignment end?" has an answer tied to the audit event from §16.6.

**Open:** the volunteer's window for confirming a stopped timer, and what happens if they never answer. Notification delivery and retention remain with §6.1 and §15.12 item 25.

## 16.10 Restoring archived projects and activities

**Confirmed decision (D-043) — 18 November 2026.**

Archiving is reversible. Restoring reverses the project's status only; it does not reverse the passage of time, nor the access decision taken at the archival instant.

| Element | On restore |
|---|---|
| **Authority** | An assigned coordinator, or any administrator — the same rule as archival (§16.6) |
| **Project** | Returns to active; appears in pickers; accepts new entries |
| **Activities archived with the project** | Return to their previous state |
| **Activities archived separately** | Stay archived. Only activities archived as part of the project's archival follow it back |
| **Volunteer assignments** | Stay ended. Volunteers re-request, or a coordinator assigns them, under the normal approval setting (§5.3) |
| **Coordinator assignments** | Already intact, so there is nothing to restore (D-042) |
| **Requests cancelled at archival** | Stay cancelled |
| **Historical entries** | Untouched |
| **The archived interval** | Stays in the record; work dated inside it stays ineligible |

**Rules:**

- Each archive event records its cause — an activity archived by itself, or archived along with its project — because that cause decides what restore brings back. Without it, a cascade cannot be told from a deliberate individual archive.
- Eligibility stays date-based (D-042). A restored project has two active windows with an ineligible gap between them; an entry backdated into the gap is refused, not accepted.
- Restoring an already-active project returns the current state, matching archival's idempotency (D-042).
- Restoring an activity whose parent project is still archived returns `409 CONFLICT`. An active activity under an archived project is a state nobody can act on.
- The confirmation before restore names what returns and what does not: "The project and the activities archived with it will be active again. Volunteer assignments ended in December are not restored; volunteers will need to request access."
- Former assignees are notified once: the project is active again and they may request access.
- The restore is recorded in the audit trail with actor, timestamp, and the archived period it closed.

**Worked example:** Priya archives the Saturday Food Bank in December. The pantry restarts in March and she restores it. The project and the three activities archived with it return; Tom, whose timer was stopped at 14:20 in December, gets one notification and re-requests in a minute, because his assignment history is still visible to him and to Priya. Hours for a February shift — after the archive, before the restore — are still refused if he tries to backdate them, because the project was not running then.

**Considered and rejected:**

- **Archive as a terminal state.** Cleanest model, no restore path to guard, but a mistaken archive or a returning programme forces a duplicate project with a different ID, splitting history and every report that spans the two. Mistakes are certain.
- **Restore with assignment resurrection.** Volunteers are working again with no action, but access is silently re-granted after months, assignments can return for revoked or departed memberships, and a deliberate access decision is reversed by a status change.
- **Restore as a clone** — a new project copying the activities. Separates the two eras cleanly, but splits history across two project IDs, so "the same project" becomes two rows.
- **Restore requires an administrator.** A second pair of eyes on reopening, at the cost of contradicting D-041's same-authority rule and making a coordinator wait on someone else to undo their own mistake.

**Accepted consequences:**

- Archiving is no longer a one-way door, which is the intent: a cheap mistake to fix is a cheap decision to make, so stale projects get closed rather than left active.
- Reopening is not a time machine. The interruption, the cancelled requests and the archived gap all survive it.
- Reports must show the gap rather than presenting the two active windows as continuous. Totals by work date are unaffected, because entries carry their own dates.
- The archive event carries its cause for the lifetime of the record, which is extra state every archive path must populate.

**Deferred:** whether restore records a reason (archival's is optional); how long archived projects are kept and whether anything is ever purged; whether a volunteer whose assignment ended by archival may re-request without approval when the organization normally requires it.

## 16.11 Submission is explicit

**Confirmed decision (D-044) — 22 November 2026.**

Finishing work does not submit it. A volunteer completes an entry and submits it; until then it is a draft. Nothing enters an approval queue on the volunteer's behalf.

**Drafts live on the device (clarified 22 November 2026).** An unsubmitted draft is not a server object. It is stored on the volunteer's device, is never transmitted, and cannot be retrieved from the server.

**Rules:**

- Stopping a timer, or saving a manual entry with all its required fields, produces a draft on that device. The entry reaches the server only when the volunteer submits it.
- The server has no draft state, no draft identifier and no draft endpoint. A time entry's first server-side existence is its submission (§15.11).
- Drafts do not travel between a volunteer's devices, and losing the device loses the drafts. This is accepted rather than worked around with server-side draft storage.
- Clients validate drafts locally, because the server cannot reject a draft it never sees. An invalid submission is refused as a whole with structured errors (D-039), and the draft stays on the device for correction.
- The offline queue carries submissions only (§7.1). Drafts are not queued for transmission.
- Submission is an action taken by the entry's owner. Coordinators and administrators may approve, reject, or return entries, but they do not submit on a volunteer's behalf — that would attest to hours the volunteer has not claimed.
- A draft is invisible to approval queues, approval counts and coordinator workloads; it does not exist at all for those purposes.
- Bulk submission is allowed as a repeated explicit act, not as a background sweep.
- ~~A timer stopped by archival is server-side session state, not a server draft: the elapsed time is held by the server and offered to the volunteer's device as a pre-filled draft on its next sync (D-042).~~ Superseded 22 November 2026 (D-048, §16.15): the MVP has no server timer, and therefore no server-side timer session.
- Submission is a state transition on the entry, not a new record; the submission instant is stored with it (§15.11).

**Considered and rejected:**

- **Automatic submission when work is saved.** Fewer taps, but every mistake becomes an approval item, the volunteer never gets to review what they are claiming, and "submitted" stops meaning anything.
- **Submission implied by the first sync.** Convenient for offline clients, but it submits work the volunteer may still be editing and makes the offline and online paths behave differently.
- **Automatic submission only where approval is not required.** Removes a step in the easy case, at the cost of two different submission rules that users must learn.
- **Server-side drafts.** Syncing drafts so they survive a lost device and appear on every device is the obvious convenience, but it makes the server host hours nobody has claimed, duplicates the lifecycle in two places, and undercuts the rule that nothing is submitted on the volunteer's behalf.

**Accepted consequences:**

- Approval queues contain only entries someone deliberately sent, so a rejection is always a response to a claim.
- Work can sit unsubmitted indefinitely; the mitigation is visibility (device-side draft indicators and ageing), not auto-submission.
- Clients must distinguish "finished" from "submitted" in their UI, including offline, and only the submitted form is ever sent.
- The server never sees a draft, so it cannot support draft recovery, draft analytics, or a coordinator asking about an unsubmitted entry — by design. Device loss, reinstall and device switching all lose drafts.
- Every submitted entry arrives complete enough to validate in one request, because there is no earlier server-side copy to amend.

**Deferred:** how long a device keeps an unsubmitted draft and whether a device-side reminder is shown. Both are client policy; the server has no view of either.

## 16.12 Approval policy applies at submission

**Confirmed decision (D-045) — 22 November 2026.**

An approval-setting change governs submissions received after it takes effect. Anything already submitted keeps the handling it entered, and nothing already decided is reopened.

**Rules:**

- The policy in force when a submission is received decides whether that entry needs approval.
- A pending entry is not auto-approved or auto-rejected when the organization switches approval off or on. It continues under the rules it entered.
- An approved entry is not un-approved by a later change.
- A change effective at time T splits the queue by submission instant — not by work date, not by when the volunteer opened the app.
- The instant is when the server accepts the submission. A client that submitted while offline before the change but syncs afterwards is judged by the policy at sync — the server checks current policy on receipt (§8.2).
- This rule covers time entries only. Pending assignment requests and other pending operations still need their own per-policy answer (§15.12 item 24).

**Worked example:** approval is switched off on 1 March. An entry submitted 28 February stays in the approval queue and is decided by a coordinator; entries submitted 2 March are accepted directly. A volunteer who wrote their entry on 27 February but synced on 3 March is judged by the March policy, because that is when the submission arrived.

**Considered and rejected:**

- **Apply changes retroactively to everything pending.** Consistent with "the current policy" read literally, but it empties or floods a queue without anyone acting, and reverses decisions people already made.
- **Freeze the policy at draft creation.** Protects a volunteer's expectation, but lets a draft saved months ago bypass a restriction introduced since — a cached permission doing exactly what §8.2 forbids.
- **Grandfather approvals permanently.** Avoids surprises, but makes the policy history, rather than the current rule, determine today's behaviour.

**Accepted consequences:**

- Each entry stores the policy applied at its submission, so "why was this accepted without review?" is answerable later.
- Two entries with identical work dates can be handled differently; the submission instant, not the work date, is the explanation, and the API should expose it.
- Retiring an approval policy never strands existing items, because their handling is already fixed.

**Deferred:** what happens to a pending entry when the last available approver loses their role, and the per-policy answer for assignment requests and other pending operations (§15.12 item 24).

## 16.13 Time and duration model

**Confirmed decision (D-046) — 22 November 2026.**

An entry's length is stored as a **whole number of seconds**. A timestamp entry stores two absolute instants and the server derives the duration from them; a duration-only entry stores a work date and a duration, and has no instants at all. Nothing is stored in minutes, and nothing is stored as local wall-clock time.

**Rules:**

- **Instants.** `startedAt` and `endedAt` are absolute instants in UTC at second precision, with no fractional seconds. They are stored as given, never shifted into a zone.
- **Canonical duration.** `durationSeconds`, a positive integer, is the length of every entry. Totals, date filters, overlap checks and any export all measure in it.
- **Derived, not supplied.** A timestamp entry's client sends the two instants only. The server computes `durationSeconds = endedAt − startedAt` in the API business layer, at creation and again whenever either instant changes. The result is persisted, not recomputed on read.
- **Duration-only entries.** The client sends a work date and `durationMinutes`; the server stores the date and `durationMinutes × 60`. There are no instants to subtract, which is precisely why duration is a stored field rather than a computed one.
- **Consistency invariant.** Where both instants exist, `durationSeconds` must equal their difference. A check flags any row where the two diverge; divergence is a defect, not an accepted state.
- **Limits.** An entry must be at least 60 seconds and at most 86,400 seconds (24 hours). Below the minimum it is not work worth recording; above it, it is a timer left running. Out-of-range entries are rejected at validation, never truncated to fit.
- **Midnight.** An entry may cross midnight. It remains one entry and is attributed in full to the date of its start; it is never split into two.
- **Time zone.** One organisation time zone interprets local times — for work dates, display, the `local_start_time` ordering in D-038, and the date filters in §15.8. Elapsed time never depends on it.
- **Daylight saving.** Because length comes from the instants, a shift across a change is measured correctly. A local time that is ambiguous or does not exist is displayed as such and is not blocked.
- **Validation, not policy.** These are field-level rules. Whether a backdated entry is allowed, whether an edit needs reapproval (§13 item 2), and any daily cap are decided elsewhere.

**Worked examples:**

| Case | Client sends | Stored | Reported |
|---|---|---|---|
| Ordinary shift | `09:00:00`–`13:15:00`, same day | 15,300 s | 4 h 15 m |
| Overnight shift | `22:30`–`01:30`, ending the next morning | 10,800 s; work date is the first day | 3 h |
| Duration-only | work date plus `durationMinutes: 90` | 5,400 s | 1 h 30 m |
| Clock change | `22:00`–`06:00` across a spring-forward night | 25,200 s | 7 h, though the clock advanced 8 h |

**Considered and rejected:**

- **Store local wall-clock times.** Matches how a volunteer describes their day, but makes every duration depend on a zone and a daylight-saving lookup, and leaves ambiguity twice a year that no schema can resolve.
- **Minutes as the canonical unit.** Rounds on every entry, and rounding each entry before summing is not the same as summing first: small losses accumulate into totals nobody can account for.
- **Accept a client-supplied duration for timestamp entries.** Convenient, but it lets a client claim hours its own instants contradict, and an offline client may compute against a stale clock.
- **A per-project or per-volunteer time zone.** Allows distributed teams, but makes "the hours for this date" depend on which project the time is attributed to, and multiplies the daylight-saving edge cases.
- **Split every entry at midnight.** Simplifies daily totals, but doubles the records, breaks the entry as an object the volunteer recognises, and creates two rows that must stay in step through every edit.
- **A break field in the MVP.** A derived quantity that can disagree with the instants; a volunteer who takes a break records two entries instead.
- **Reject ambiguous or non-existent local times.** Enforces correctness at the cost of refusing an entry that happened. The instants are unambiguous even when the local label is not.

**Accepted consequences:**

- Clients format seconds for display, and any decimal-hour export rounds once, at the boundary (B19).
- A two-hour overnight entry is one row with one work date, so a per-day total is "hours attributed to that date", not "hours worked inside that calendar day".
- Duration is available to every read path without arithmetic, so totals over a range do not recompute subtraction per row.
- The stored duration is what was claimed at submission, so an approval, an audit entry and a dispute all refer to the same number.

**Deferred:** how far back an entry may be dated or submitted (B16), any daily or weekly maximum (B17), whether a break field is ever added (B18), and how exported hours are rounded (B19).

## 16.14 Definition of an overlap

**Confirmed decision (D-047) — 22 November 2026.**

A conflict is any **positive overlap in absolute time** between two **submitted timestamp entries belonging to the same volunteer**, regardless of project or activity. Touching endpoints do not overlap. A conflict is **advisory**: the entry is accepted, stored and flagged, never rejected.

**Rules:**

- **Scope.** One volunteer, across every project and activity. Time is one person's resource; dividing it between two projects does not create a second hour.
- **Membership.** Only submitted entries participate. Device-local drafts never reach the server (D-044), and rejected entries are out.
- **Definition.** Intervals are half-open: an overlap exists when `a.startedAt < b.endedAt` and `b.startedAt < a.endedAt`. Equality at either end is not an overlap.
- **Tolerance.** None. Any shared instant of one second or more is a conflict.
- **Duration-only entries.** Excluded. They carry a date and a length but no position within the day, so there is nothing to compare.
- **Timing of the check.** At submission, against the entries that exist at that moment (D-045's boundary). An edit that changes either instant re-runs it. The earlier entry is never retroactively re-judged.
- **Across volunteers.** Never.
- **Response.** A conflict is not an error. The submission succeeds with its normal status and carries `conflicts: [{ entryId, startedAt, endedAt }]`, naming the other entry so both can be shown. Duration is not adjusted.
- **Resolution.** A volunteer or coordinator resolves it by editing or discarding one of the two entries. Conflict status stays separate from approval status: resolving a conflict does not approve hours (§15.5.4).

**Why advisory rather than blocking.** The cases that produce overlaps are the cases where blocking does damage: two devices capture the same shift offline and sync without seeing each other; a timer is left running and the shift is logged again; a shared device is left signed in. A rejection in an offline queue is a dead end — the client cannot resolve it without the volunteer, who may not return — so the entry is lost rather than corrected. Accepting with a flag keeps the record and puts the question where a human already is: D-045's review queue. The decision becomes "which of these two is wrong" instead of "nothing was recorded".

**Worked examples:**

| Case | Result |
|---|---|
| 09:00–12:00 and 10:00–14:00, same project | Conflict |
| 09:00–12:00 community and 10:00–14:00 admin | Conflict — different projects, same person |
| 09:00–12:00 then 12:00–14:00 | No conflict |
| 09:00–12:00 then 12:00:01–14:00 | No conflict |
| Volunteer A 09:00–12:00, volunteer B 09:00–12:00 | No conflict |
| "90 minutes on 25 October" against a 09:00–12:00 shift that day | No conflict detectable — the duration-only entry has no position |

**Considered and rejected:**

- **Per-project scope.** Would allow a volunteer to be in two places at once whenever the projects differ, which is the commonest way hours are double-counted.
- **Blocking rejection (409).** Keeps contradictory time out of the record but strands offline submissions and treats a stuck-timer duplicate as the volunteer's fault to fix.
- **A tolerance window.** Hides genuine short overlaps behind a constant that must be justified; exact comparison is free at second precision. If clock skew ever produces phantom conflicts, B3 settles it there, not silently here.
- **Treating touching endpoints as an overlap.** Flags the ordinary stop-then-start pattern of a timer and teaches reviewers to ignore the flag.
- **Cross-volunteer or team-wide detection.** Constant, meaningless flags; several volunteers legitimately work the same hours.
- **Detecting overlaps from the work date and a total.** Wrong in both directions: two entries on one date with no shared instant are not a conflict, and a shared instant cannot fall on two dates.

**Accepted consequences:**

- Duration-only entries are invisible to detection, so a volunteer who records only totals can never be flagged. The aggregate case belongs to a daily maximum (B17), which does not pretend to know clock times.
- A conflict is a **pair**, so the API must answer "what does this entry conflict with", not merely "is this entry conflicted"; a bare flag cannot be resolved.
- Because the earlier entry is not re-judged, the two sides of a conflict can reach different approval outcomes, each correct on the evidence at its own arrival.
- Conflicts are information, not a gate; nothing waits on resolution unless a later decision makes approval depend on it.

**Deferred:** whether an unresolved conflict should block final approval, whether a resubmission shortly after a timer stop is merged instead of flagged — the duplicate itself no longer needs an answer, since a repeat of one draft replays into one entry (§16.16, D-049) — and whether clock skew needs a grace window (B3).

## 16.15 Stopwatch instead of a server timer

**Confirmed decision (D-048) — 22 November 2026.**

The MVP has **no server-side timer**. Timing happens on the volunteer's
device in a stopwatch, and the stopwatch's only output is a pre-filled
manual timestamp entry. There is no timer resource, no timer state on the
server, and no timer route.

**Rules:**

- **Manual only.** Every entry the server holds is a manual submission:
exact start and end instants, or a work date plus a duration (D-046).
- **The stopwatch is client state.** Starting, running and stopping happen
entirely on the device. Elapsed time is measured against the device's own
clock, and nothing about it is transmitted while it runs.
- **Output is a draft.** Stopping the stopwatch opens the manual timestamp
form with `startedAt`, `endedAt` and the duration pre-filled: `endedAt` is
the instant the volunteer stopped it, and `startedAt` is that instant minus
the elapsed time. The result is a draft on that device (D-044), not a
submission.
- **Submission is unchanged.** The volunteer edits if needed, then chooses
Log time or Save as draft exactly as for a hand-typed entry (§15.4.2).
Nothing is submitted on their behalf.
- **No server surface.** No timer row, no running-timer flag, no start,
stop or current-timer endpoint, no idle timeout, no server-authoritative
start. A client that has never used a stopwatch calls exactly the same API
as one that only types entries.
- **Clock skew is an ordinary entry problem.** The instants are the
device's claim, like any typed range, and are validated as one. A wrong
device clock produces a wrong entry the volunteer can correct; it is not a
timer-specific risk.
- **Long-running stopwatch.** A stopwatch left running past 24 hours
produces a range above the per-entry maximum (D-046). The client warns and
caps the form; the server refuses an over-length submission with the data
preserved, like any other validation failure.
- **Two devices.** Two stopwatches may run for the same volunteer at once.
Nothing detects it, because there is nothing to detect it against; if both
are submitted, they overlap and D-047 flags the pair as advisory. No merge
or deduplication is attempted.
- **Archival does not reach it.** Archival has no timer to stop (§16.9, as
amended). The entry the stopwatch produces is refused if its work falls
after the archival instant, exactly like any other entry about archived
work.

**Why a stopwatch and not simply dropping the timer.** A volunteer who
wants to time work needs a start button; without one they use a phone
stopwatch and type the range from memory. Keeping that convenience inside
the app costs the contract nothing: no new resource, no second entry
lifecycle, no concurrency, no server state to reconcile, and no trust in
a clock beyond what manual entries already concede. The whole feature is
client work against the manual entry the API already has, which is why it
fits a tight MVP deadline.

**Considered and rejected:**

- **Duration-only MVP** (a date and a number of minutes, no instants).
Smallest possible server surface, but it forfeits the overlap model
(D-047), the `local_start_time` ordering (D-038), and any ability to
reconstruct what was recorded when hours are disputed — and instants that
were never captured cannot be recovered later, so the loss is permanent
rather than deferred.
- **A timer resource with start and stop routes.** The design already
written in §§6.3, 7.4 and 15.4.1, at the cost of a second entry lifecycle,
server-held running state, a uniqueness constraint with concurrency
handling, a clock-skew policy, and a stopped-timer handover that only
archival ever uses.
- **A stopwatch that submits on stop.** Removes the confirmation step, and
with it the volunteer's chance to cut off a forgotten stopwatch before it
becomes a claim (D-044).
- **Reusing a manual entry as the running-timer record.** Saves a table,
but writes a server row for work nobody has claimed, which is the
server-side draft D-044 rejects.

**Accepted consequences:**

- Elapsed time is only as good as the device clock, and the server cannot
distinguish a corrected entry from an invented one. Manual entries already
conceded this.
- An unsubmitted stopwatch result lives and dies with the device; it does
not follow the volunteer to another phone.
- No coordinator can see who is working right now. That view was never in
the MVP scope, and it is the first thing a server timer would restore.
- §§6.3, 7.4 and 15.4.1 remain in the record as written, marked deferred:
they are the starting point if the timer returns, not contradictions of
this decision.

**Supersedes:** D-012 (§6.1) in part — entry creation is manual only;
D-014 (§6.3) entirely — no server timer exists to constrain; the
running-timer branch of D-042 (§16.9) and the matching bullet in D-044
(§16.11); §7.4 and §15.4.1, deferred rather than decided. §2.1's MVP scope
is amended.

**Deferred:** B3 is deferred with the feature rather than decided; each
sub-question it lists — one running timer or several, a timer spanning
midnight, server-authoritative start, clock skew, idle timeout, start and
stop payloads — re-opens only if a server timer returns. Whether a
submission shortly after a stopwatch stop is merged rather than flagged
remains open, but only as a merge-UI question: a repeat of the same draft
cannot duplicate anything (§16.16, D-049).

## 16.16 Mutation identity and concurrency

**Confirmed decision (D-049) — 23 November 2026.**

A client-created record is born with an **id the client chooses**, before
its first request, and every time entry carries an **integer `version`**
the server increments. The id prevents a repeated request from creating a
second record; the version prevents a stale request from overwriting a
newer one. There is no `Idempotency-Key` in the MVP.

Two failures are being separated. A request can commit and still fail to
reach the client, so the client retries work the server has already done —
that is **repetition**. A client can hold a copy that another person has
since changed and write over it — that is a **lost update**. One mechanism
cannot answer both, which is why this decision has two parts and no third.

**Identity.**

- **Minted offline, once.** The client generates the `id` when the draft is
  created, persists it with the draft, and reuses it for every attempt,
  including a retry after a restart. An id generated at send time is a new
  id on every attempt and defeats the mechanism completely.
- **Format.** A canonical lowercase hyphenated UUID (RFC 9562), 36
  characters. UUIDv4 is accepted; UUIDv7 is preferred because a
  time-ordered key indexes better. The server validates the shape and
  rejects anything else as `400 VALIDATION_FAILED` with
  `{ "path": "id", "code": "INVALID_ID" }`.
- **Placement.** A top-level `id` in the create body, not in the path.
  Creation is a collection action, and the id is the client's claim about
  the record it is creating, not an address the server resolved.
- **Scope.** Globally unique, client-owned, never sequential and never
  scoped to an organisation. The server does not assign ids to time
  entries at all.
- **The row is the deduplication record.** Creation is
  `INSERT … ON CONFLICT (id) DO NOTHING RETURNING *`. Zero rows returned
  means the id already exists and the request is a replay. There is no key
  table, no request fingerprint, no cleanup job and **no expiry window** —
  the interval in which a late retry could duplicate does not exist, which
  is the property a time-limited key cannot offer.
- **Replay is decided by id alone.** The server never compares bodies to
  decide whether a request is a repeat. Identity is the fact; comparing
  payloads would need a canonical hash and normalisation rules to answer a
  question the primary key already answers.
- **Replay response.**   `201 Created` with `Location: /v1/time-entries/{id}` on
  first application; `200 OK` with `Idempotency-Replay: true` and the
  identical body shape on every later attempt. The status distinguishes
  them in a log without a header; the header names it for clients and
  tests. Either response may be adopted as truth, including its `version`.
- **Ids are never regenerated.** Not on edit, not on resubmission after
  rejection (D-024), not on a new device taken over from a sync. A
  corrected entry is the same entry under optimistic concurrency, so the
  id is what carries its history.

**Create request and first response.**

```http
POST /v1/time-entries
Content-Type: application/json
```

```json
{
  "id": "6f1c9a3e-1b77-4b0e-9a2c-5d0f6c1e8b41",
  "projectId": "…",
  "activityId": "…",
  "startedAt": "2026-11-21T14:00:00Z",
  "endedAt": "2026-11-21T17:00:00Z",
  "note": "Sorting donations"
}
```

```http
HTTP/1.1 201 Created
Location: /v1/time-entries/6f1c9a3e-1b77-4b0e-9a2c-5d0f6c1e8b41
```

```json
{
  "id": "6f1c9a3e-1b77-4b0e-9a2c-5d0f6c1e8b41",
  "version": 1,
  "volunteerId": "…",
  "projectId": "…",
  "activityId": "…",
  "startedAt": "2026-11-21T14:00:00Z",
  "endedAt": "2026-11-21T17:00:00Z",
  "durationSeconds": 10800,
  "approvalStatus": "pending",
  "submittedAt": "2026-11-21T12:00:08Z",
  "conflicts": []
}
```

A repeat of that request answers `200 OK`, `Idempotency-Replay: true`, and
the same body — with `version` at whatever it is now, not necessarily `1`.

**Id reuse.** Two cases, deliberately different:

- **The id exists but the caller cannot see it** returns `404 NOT_FOUND`,
  byte-identical to an entry that does not exist, so a reused or colliding
  id cannot be used to probe for another volunteer's records (§16.4,
  §15.8.9).
- **The id exists and the caller owns it** is a replay by definition,
  whatever the body says: the stored entry is returned and the incoming
  values are not applied. If a client has genuinely reused an id for a
  different draft, the second draft's values are silently dropped.

The second case is accepted rather than detected. Detecting it requires a
stored payload hash and a definition of "the same request" that survives
normalisation, and it protects against none of the failures this decision
exists for — a real repeat sends the same bytes. Clients must treat the id
as an identity, not a request label.

**Version.**

- `version` is a positive integer, `1` at creation, incremented by the
  server on every accepted mutation of the entry: an edit, approval,
  rejection, return, conflict resolution. It is never supplied by the
  client on create.
- Every request that mutates an existing entry sends the `version` it
  read, as a body field beside the changed fields. A header (`If-Match` /
  `ETag`) was considered and rejected below.
- The comparison is inside the write —
  `UPDATE … WHERE id = $1 AND version = $2 RETURNING *` — so there is no
  read-then-write window and no transaction held across requests.
- Zero rows updated sends the server back to the row to distinguish
  `404 NOT_FOUND` (absent, or outside the caller's scope) from
  `409 VERSION_MISMATCH`.
- A `409 VERSION_MISMATCH` carries a fixed `details` object for that code:
  `{ "currentVersion": 2, "updatedAt": "…", "current": { …entry… } }`.
  `details` varies by code, not by endpoint (§16.4), and `current` saves a
  second round trip for a device that has been offline for hours.
- A client must not retry a `409` unchanged. It reapplies the change to
  `currentVersion`, or shows the conflict to the person who is editing.
- The version is entry-wide, not per field. Per-field merging is a
  reconciliation feature; detecting that two writers diverged is the
  contract's job, and this is it.

**State-setting operations are idempotent by outcome.** `approve`,
`reject`, `return`, `archive` and `restore` are idempotent by outcome
rather than by key: if the target state already holds, the call returns
`200` with the current representation, the `version` unchanged, no error
and no second audit event. This is the rule D-042 and D-043 already apply
to archival and restore, extended to the rest of the write surface.
Server-created resources — notifications, audit events — have no
client-chosen id and therefore no replay problem of their own; they rely on
this rule and on never being created implicitly by a retried request.

**Retry classification.**

| Outcome | Client action |
|---|---|
| Network error, timeout, `500`, `503` | Retry with the **same** id and version. A create replays; a repeated transition is a no-op |
| `201`, `200` | Commit locally and adopt the returned `version` |
| `409 VERSION_MISMATCH` | Do not retry. Reapply against `currentVersion`, or surface `details.current` |
| `409 CONFLICT` | Resolve the named state conflict; the same request fails again |
| `400`, `403`, `404` | Do not retry. The queued item is invalid, out of scope, or already invisible |

**Worked example.** Marisol records a food-bank shift with no signal in
the basement, and every attempt to record that one shift follows.

| Event | Server |
|---|---|
| Draft created offline; `id` minted and stored with it | — |
| First submit at 12:00:08 reaches the server and commits as `version: 1`; the response is lost when the connection resets | Row exists; the client believes nothing happened |
| Retry at 12:00:38, same body, same id | `200`, `Idempotency-Replay: true`; nothing new written |
| The app is killed before its "job done" marker is flushed; on relaunch the outbox re-enqueues the draft at 14:02 | `200` replay again; still one row |
| She fixes the note: `PATCH` with `version: 1` | `200`, `version: 2` |
| The pre-restart edit flushes at 18:10 with `version: 1` | `409 VERSION_MISMATCH` carrying `current`; the typo fix is not reverted |

Five requests, one row, no lost correction. Nothing downstream catches
this instead: an overlap is advisory (D-047), so a duplicate submission
does not fail — it lands in the approval queue as two pending entries that
conflict with each other, and if both are approved the hours are counted
twice. D-047 explains a duplicate after the fact; the id is what stops it
from existing.

**Why not `Idempotency-Key`.**

- **It duplicates a durable record the client already keeps.** The key has
  to be minted at enqueue time and persisted with the draft, because a key
  generated at send time differs on every retry. The entry id has that
  requirement anyway.
- **It needs an expiry, and expiry is where it fails.** The retention
  window must outlive the longest offline queue — a phone in a drawer for a
  week — or duplicates return exactly when the queue is oldest. Row
  identity has no window.
- **It cannot answer the second failure.** A key stops a repeated create
  and does nothing about an edit derived from a stale copy. `version` is
  not an optional companion to a key; it answers a different question.
- **Two queued jobs for one draft produce two requests.** With a shared
  stored key they collapse, but the key store is a second durable record
  that can desync from the outbox in the same way the job marker did. The
  id cannot desync, because the row itself is the record.

**Considered and rejected.**

- **`Idempotency-Key` plus `updatedAt` concurrency.** Conventional and
  well understood, but the key needs a table, a retention decision, a
  cleanup job and a documented duplicate window, and a timestamp
  comparison treats two writes in the same second as concurrent when they
  are merely close.
- **Both an id and an idempotency key.** Belt and braces: two mechanisms
  to implement and two to explain, where the id alone covers create, and
  covers it without expiry.
- **Last-write-wins.** Smallest surface, but silently discards a
  coordinator's correction when a volunteer's stale device syncs, and
  nobody ever learns it happened.
- **`PUT /v1/time-entries/{id}` for creation.** Naturally idempotent and
  arguably more honest about the client-chosen identity, but `PUT` implies
  a full replacement of an existing resource, which is not what submission
  is, and it would make partial edits a second verb and a second set of
  rules.
- **`If-Match` / `ETag` instead of a body field.** Splits the contract
  across transport and body, needs strong-versus-weak comparison semantics,
  and reports worse field-level errors than `details` already does. The
  version is in every representation, so an `ETag` mapping is additive
  later.
- **Comparing request bodies to detect a repeated create.** Needs a
  canonical hash, a normalisation rule and a column, and it makes a
  legitimate retry of the same draft with a corrected typo look like a
  different request — which is exactly the case the id handles by returning
  the stored row and letting the client `PATCH`.

**Accepted consequences.**

- Client ids appear in URLs and audit records and are chosen by a client.
  They carry no meaning and grant nothing: authorization is re-evaluated
  per request (§4.5).
- The server never assigns a time-entry id, so it cannot mint entries for a
  volunteer — consistent with D-044, where the server holds no draft.
- An accidental id reuse is silent. The rule that prevents it is a client
  obligation, stated here because the server deliberately does not check.
- Every mutating request carries a version, so a client that has not read
  the entry cannot write to it. That is the intent, and it makes "read,
  then write" the only path — which offline clients already follow.
- A genuine conflict costs one extra response body (`details.current`) in
  exchange for avoiding a second round trip on a bad connection.
- Recording the same work twice on purpose, for two activities, requires
  two ids. The id distinguishes them; no field of the payload does.

**Resolves:** §7.2 and the D-027 register row, which were established
direction and this fixes into a mechanism. §15.12 item 6's detection half
and item 30's retry/idempotency half. Backlog item B4 (§17). It also
constrains B12: a create returns the created representation.

**Deferred:** the reconciliation interface for a detected concurrent edit
(item 6's other half), and whether a submission shortly after a stopwatch
stop is merged rather than flagged — a repeated submission of one draft can
no longer duplicate anything, so that is now a merge-UI question alone.
Also deferred: whether `version` is exposed as `If-Match`, and idempotent
creation for resources whose ids the server assigns.

## 16.17 Identity is scoped to the organisation's own instance

**Confirmed decision (D-050) — 23 November 2026.**

Each organisation runs its own instance of Hourly, on its own server with
its own database (§2.2). Identity is scoped to that instance: Ann's account
*is* her account at the food bank, and it exists nowhere else.

**Onboarding.**

- The app ships with no server address and no directory of servers.
- A new installation asks for two things: the person's email address, and
  the web address of the organisation's Hourly instance.
- The app contacts that address to establish the connection, and stores the
  address with the account. The address is how the connection is
  established and maintained, for the life of the account.
- Everything afterwards is addressed to that instance: every request, every
  token, every notification. There is no fallback address, no discovery by
  email domain, and no central service in the path.

**Siloing.**

- Instances share no data, no configuration and no trust. One instance
  cannot see, address, or be made to answer for another's records.
- A token minted by one instance is meaningless to another; sessions never
  cross instances.
- The same person at two organisations holds two accounts, two sets of
  credentials and two histories, with no link between them (§2.3).
- Because identity is tied to the instance, no organisation identifier
  appears anywhere in the API. No route, body field or query parameter
  names an organisation: the instance is the organisation, and the caller's
  token already says which one.
- There is consequently no tenancy predicate to forget. One organisation
  row per instance, no `organisation_id` columns on scoped tables, and no
  cross-instance authorization check anywhere.

**What follows for the contract.**

- B5's first question is answered in its strongest form: not "single tenant
  by default" but "the deployment is the tenant".
- The organisation row holds the settings that D-046 and D-045 already
  require — the time zone and the submission approval policy — and nothing
  else needs to carry an organisation reference.
- Errors cannot disclose across instances, because there is no second
  instance to disclose.
- This also settles the "what attaches to the organisation" half of B5: the
  one row carries the settings already decided, plus the display name and
  the membership-approval setting.

**Consequences for the client.**

- The address is a trust anchor, not a preference. The app must show the
  host it is about to contact before any credentials are sent, use HTTPS
  only (with an explicit `http://localhost` exception for development),
  refuse to follow a redirect to a different host on authenticated
  requests, and keep the address in the same protected store as the token.
  Without that, an instance can be swapped underneath a stored session and
  the token goes to a host the person never typed.
- An address that does not answer, or answers but is not Hourly, is an
  onboarding failure, not an authentication failure. "We could not reach
  that address" and "that password is wrong" are different facts and must
  not be conflated, in the interface or in logs.
- More than one account on a device is possible in principle, and accounts
  must be keyed by address rather than by person. Their offline queues are
  separate (D-049): signing in to a second instance must never strand,
  merge, or discard the first instance's queued submissions.
- The person cannot discover the address from inside the app. The
  organisation communicates it out of band — its website, an invitation, a
  QR code — which makes the address a piece of onboarding copy the
  organisation owns.

**Consequences for the instance.**

- Each instance has its own first administrator, created by its own
  installation step. The bootstrap issue in §3.2 and §15.12 item 27 is a
  per-instance problem, not a single global one.
- Each instance upgrades on its own schedule, while the app updates through
  an app store on another. **Version skew between client and instance is
  therefore normal**, not exceptional: the app must fail cleanly against an
  instance whose API it does not speak, and say so plainly rather than
  surfacing a parse error.
- Backups, monitoring and recovery are per instance (§2.2). An instance's
  disappearance is that organisation's data loss, not a platform incident.

**Considered and rejected.**

- **One hosted, multi-tenant service with the organisation chosen inside
  the app.** The usual way to run software for many organisations from one
  deployment, and it would remove the address field entirely, but it pools
  every organisation's hours in one operator's database and puts the
  tenancy predicate back on every query.
- **Discovery from the email domain** (`ann@foodbank.org` →
  `hourly.foodbank.org`). Saves a field where the domain happens to match,
  and fails for every organisation using a shared mailbox domain, a
  different subdomain, or a hosted address. The address stays explicit.
- **A central directory of instances.** Turns a self-hosted product into a
  federated one, with a registry to operate, a privacy question about who
  is listed, and an availability dependency inside the sign-in path.
- **An organisation picker in an app pointed at one shared server.** Only
  coherent if the servers are not the organisations' own, which is the
  thing being rejected.

**Accepted consequences.**

- Nobody can use Hourly without knowing their organisation's address.
  Losing it means asking the organisation, not resetting an account.
- A person who moves between organisations starts again on the new
  instance: new account, new membership approval, no history carried over.
- There is no cross-instance reporting, no pooled volunteer list, and no
  way for one organisation to learn that a volunteer also records hours
  somewhere else.
- The app carries a first-run flow that the API contract does not
  participate in beyond the address it is handed.
- No part of the API may assume a stable hostname. Every instance is a
  different origin, so any absolute URL the server emits must be built from
  its own configuration, never from a constant.

**Open, to be taken next — not decided here.**

- **The handshake.** Whether the app confirms an address before asking for
  credentials, and what an unauthenticated request to that address returns
  — organisation name, API version, minimum client version — so that a
  typo and an incompatible instance are distinguishable before a password
  is typed.
- **Version negotiation.** What the app does with an instance older or
  newer than it understands, and what an instance does with a client too
  old to serve.
- **Address changes.** How an account follows its instance to a new host
  without losing its queued submissions.
- **Registration scope.** Whether an address at that instance may register
  itself, given §3.2's self-registration and administrator approval.

**Resolves:** backlog item B5 (§17) — single versus multi-tenant, whether
one volunteer belongs to several organisations, and what organisation-level
settings attach to. It confirms §2.2 from the client's side, clarifies
§2.3, and narrows §15.12 items 26, 27 and 31 without closing them.

## 16.18 Roles are membership-level; coordination is a project grant

**Confirmed decision (D-051) — 23 November 2026.**

A membership holds exactly one role: `volunteer` or `administrator`.
Coordination is not a role. It is a grant on a project, held as a row in
`project_coordinators`, and it confers authority over that project and
nothing else. Roles are fixed in code and are not configurable; the only
organisation-wide authority setting remains the one §4.2.1 already defines.

This replaces the shape proposed for B6 — coordinator as a third role with
assignment-scoped powers. That proposal was never recorded, so no
supersession note is needed; the §17 row records the change of shape.

**Roles.**

- `volunteer` — the role of an approved membership by default. Records and
  submits own time; reads own entries, assignments and notifications.
- `administrator` — organisation-wide authority within the instance (§4.4).
  An administrator does not acquire coordinator grants by virtue of the
  role, and does not appear in a project's coordinator list because of it
  (§4.1.3).
- Promotion and demotion are administrator operations. A role change takes
  effect on the next request and never revisits a decision already taken
  under the previous role.
- No role is inferred from work. Coordinating a project is not a promotion,
  and losing a grant is not a demotion.
- The last administrator cannot be demoted or removed by another
  administrator. Without that guard an instance can be left with no one able
  to administer it.

**Grants.**

```
project_coordinators
  id          uuid        primary key
  project_id  uuid        not null → projects(id)
  user_id     uuid        not null → users(id)
  granted_by  uuid        not null → users(id)
  granted_at  timestamptz not null
  ended_at    timestamptz null      -- null means active
  ended_by    uuid        null
unique (project_id, user_id) where ended_at is null
```

- A grant requires an active membership when it is made, and §4.2.2 still
  forbids a coordinator adding themselves to a project that already exists.
- Ending a grant sets `ended_at` and `ended_by`; the row is never deleted
  (§4.2.4). Re-granting inserts a new row, which the partial unique index
  permits because the old row is no longer active.
- A grant ends at once when the membership itself ends. Reinstatement
  requires a new grant; nothing is restored implicitly.
- `granted_by` is the authenticated caller, never a field the client sends.
- Removing the last active grant from an active project requires the
  confirmation §4.2.3 already defines. A project may still end up with no
  coordinator (§4.1.2).
- A project may hold any number of active grants, and the record requires no
  lead or primary coordinator (§4.1.1).

**Effective permission.**

    capabilities(member, project) = role(member) ∪ active grant on that project

Every project-scoped check uses one predicate, and no endpoint reads a
coordinator field from `projects`:

```sql
SELECT 1 FROM project_coordinators
WHERE project_id = $1 AND user_id = $2 AND ended_at IS NULL
```

The supporting index is `(project_id, user_id) WHERE ended_at IS NULL`.

**Permission matrix.** "Coordinator" means an active grant on the project in
question, not a status the person holds generally.

| Capability | Volunteer | Coordinator | Administrator |
|---|---|---|---|
| Create, edit and submit own entries | yes | yes | yes |
| Read own entries, assignments and notifications | yes | yes | yes |
| Create a project | yes | yes | yes |
| Read entries on that project | no | yes | yes |
| Read entries of volunteers assigned to that project | no | yes | yes |
| Approve, reject or return an entry on that project | no | yes, except their own | yes, including their own (amended 23 November 2026) |
| Edit that project and manage its activities | no | yes | yes |
| Add and remove volunteer assignments on that project | no | yes | yes |
| Add and remove coordinator grants on that project | no | yes, if the §4.2.1 setting is enabled, never for themselves | yes |
| Archive and restore that project and its activities (D-041) | no | yes | yes |
| Read or approve project-less entries | own only | no | yes |
| Manage memberships, roles and organisation settings | no | no | yes |
| Read the audit trail | no | no | yes (B11 may widen) |

**Self-approval.** A coordinator may not approve their own entry: on a
coordinated project the reviewer is another active coordinator of that
project or an administrator. Where neither exists the entry stays pending,
the project's no-coordinator warning (§4.1.2) is the signal, and the remedy
is a second grant or an administrator — not a self-approval flag.

**Amended 23 November 2026:** for the MVP, an administrator *may* approve
their own work. The coordinator rule stands, because a coordinator's own
entries are exactly the case where a second pair of eyes exists cheaply
(another coordinator, or an administrator). An administrator has no reviewer
above them short of another administrator, so forbidding self-approval would
leave a single-administrator organisation with unreviewable hours and no
remedy but staffing. The exception is narrow and explicit: it applies to the
administrator role only, it does not extend to coordinators, and the audit
trail records the reviewer either way, so a self-approved entry is visible as
one.

**Project-less entries.** Administrator only, for reading and for approving;
the author reads their own. A grant is scoped to a project object and these
entries have none, so this is exclusion rather than a separate rule. It
answers §15.12 item 4's question about the boundaries of coordinator
authority over project-less entries, and repeats the answer already given in
§15.3.2's neighbourhood: a coordinator who needs them needs the
administrator role.

**Project creation.** Any member with an active membership may create a
project. In the same transaction the creator is granted as its first
coordinator, unless the creator is an administrator — an administrator's
authority needs no grant, and §4.1.3 keeps them out of the coordinator list
unless granted through the ordinary path. This is not a breach of §4.2.2:
that rule forbids adding oneself to a project that already exists, whereas
this grant is part of creating a new one, recorded with `granted_by` set to
the creator so the audit trail shows it for what it is.

**Project-creation approval.** An organisation-wide setting,
`projectCreationRequiresApproval`, default off. When it is on:

- the project is created in a `pending` state, visible to its creator and to
  administrators only;
- the creator's grant is recorded but exercises no authority over
  assignments, entries or other members until the project is active;
- the creator may edit the project or withdraw it; withdrawal retains the
  record rather than deleting it;
- an administrator approves it, making it `active`, or rejects it;
- a pending project accepts no assignments, assignment requests or time
  entries.

This is the first project state beyond active and archived. The naming and
the full transition set belong to the state machine (§15.12 item 1); this
decision fixes only that creation may require approval and what stays shut
until it is given.

**Accepted costs.**

- Two sources of authority instead of one, so every project-scoped check
  joins the grant table rather than reading a column.
- Coordinator status is derived. The API never returns "coordinator" as a
  role value, and the client cannot label someone a coordinator without
  asking which projects.
- A one-coordinator project cannot approve that coordinator's own hours
  without an administrator or a second grant; an administrator can, and the
  audit trail shows that they did.
- Administrators may approve their own entries, so an organisation that wants
  independent review of an administrator's hours needs a second administrator.
  The setting is visibility, not prevention: the reviewer field makes a
  self-approved entry obvious after the fact.
- An administrator is not automatically in a coordinator list, so "who runs
  this project?" is answered by grants, never by roles.
- Creation approval adds a project state the client must render and the
  state machine must incorporate.

**Rejected alternatives.**

- **Coordinator as a third role** (the withdrawn B6 proposal). It cannot
  express "volunteer everywhere, coordinator on one project" without
  granting instance-wide coordinator affordances, and it invents a
  coordinator who coordinates nothing.
- **A single `coordinator_id` column on `projects`.** One coordinator per
  project contradicts §4.1.1; overwriting the column destroys the history
  §4.2.4 preserves; and the last-coordinator confirmation in §4.2.3 becomes
  meaningless. A coordinator's own entries would have no reviewer but an
  administrator, permanently.
- **Role sets** (a membership holding several roles). Every check becomes a
  union, the common case needs two roles kept in step, and "may this person
  approve this entry?" stops having one answer.
- **Per-permission grants.** Every permission becomes data to seed,
  migrate and audit; a small organisation administers a permission system
  instead of its projects.
- **Self-approval for coordinators.** It removes review where review is
  cheapest to arrange (another coordinator, or an administrator). The
  administrator case is the only exception, adopted 23 November 2026 and
  limited to that role.

**Resolves:** backlog item B6 (§17), and §15.12 item 4. It supplies the
representation the §4 supplement describes: §4.1–§4.3 keep their confirmed
behaviour, now backed by one table rather than a role. It leaves open the
project state machine (item 1), the categories of entry that require
approval at all, and who besides an administrator may read the audit trail
(B11).

## 16.19 Retention and erasure: keep the record, anonymise the person

**Confirmed decision (D-052) — 23 November 2026.**

Deleting hours and honouring an erasure request pull in opposite directions
until the objects are separated. The hours are the organisation's record of
work performed. The identity is the person's. Retaining one and destroying
the other answers both.

**The case this protects.** Marisol volunteered 340 hours across two years,
coordinated the Saturday Pantry for six months and approved 61 entries. She
moves away and asks the organisation to delete everything about her, three
weeks before a funder's audit samples the Saturday Pantry hours. Deleting her
entries would destroy reported hours; deleting her user row would orphan
`createdBy`, `reviewedBy` and `grantedBy` on every one of those records;
doing neither would ignore her request. Anonymising her row settles all
three: the hours still count, the approval trail still points at a stable
principal, and nothing left in the instance says who Marisol was.

**Rules.**

1. **A membership ends; the account persists.** The role closes, every
   `project_coordinators` grant ends at that instant (D-051), and pending
   assignment requests cancel under the existing departure rules. The person
   can no longer authenticate into anything operational. Re-joining creates a
   new membership and needs a new grant.
2. **Erasure anonymises the user row in place.** `email` is replaced with a
   placeholder that no longer satisfies the uniqueness rule for real
   addresses, `displayName` becomes "Former volunteer", credentials, tokens
   and profile fields are destroyed, and `anonymisedAt` is set. The `id`
   survives, so entries, reviews and grants keep a coherent but
   unidentifiable author.
3. **Entries are never deleted as part of erasure.** The work they record
   belongs to the organisation, not to the person who performed it. This has
   to be said plainly in whatever the organisation tells its volunteers,
   because it is the part people are surprised by.
4. **Archived projects have no expiry.** They are restorable by design
   (D-043), and an audit three years later is exactly when restore matters.
   No automatic purge and no retention timer in the MVP.
5. **Personal export is synchronous and self-service.** `GET /v1/me/export`
   returns the caller's own profile, membership, entries, grants and
   notifications as one document, built from the same scoped queries the
   lists already use. No job queue and no email delivery.
6. **There is no organisation-purge endpoint.** With one instance per
   organisation (D-050), decommissioning is an operational act: whoever can
   drop the database already holds the credentials to do it. A button that
   erases every hour the organisation ever recorded is a worse hazard than a
   missing feature. If one is demanded later it needs an export-first step
   and a typed confirmation, never a normal administrator action.
7. **The API never promises deletion of hours.** Nothing in a consent flow,
   an export response or an error message may imply that an erasure request
   removes the organisation's time records.

```json
{
  "exportedAt": "2026-11-23T10:02:11Z",
  "apiVersion": "v1",
  "profile": { "id": "9c21…", "displayName": "Marisol Vega", "email": "m.vega@…" },
  "membership": { "role": "volunteer", "status": "active", "joinedAt": "2024-02-11T09:00:00Z" },
  "entries": [
    { "id": "…", "startedAt": "2026-03-07T14:00:00Z", "durationSeconds": 14400,
      "approvalStatus": "approved", "projectId": "a3f1…" }
  ],
  "coordinatorOf": [
    { "projectId": "a3f1…", "grantedAt": "2025-10-04T08:12:00Z", "endedAt": "2026-04-30T17:00:00Z" }
  ],
  "notifications": [ { "id": "…", "createdAt": "2026-03-08T09:15:00Z", "readAt": null } ]
}
```

| Option | What it does for Marisol | What it costs |
|---|---|---|
| **Retain the record, anonymise the person (recommended)** | Identity gone, hours and approval trail intact | Not a complete erasure: hours remain, attributable to an anonymous id |
| **Hard delete the user and cascade her entries** | Complete removal | Reported hours vanish, the funder's sample no longer reconciles, other people's reviews point at nothing |
| **Hard delete the user, keep entries with `createdBy` nulled** | Complete removal of the person | The record can no longer say who submitted or approved it, which is the guarantee D-041 and §16.16 exist to give |
| **Refuse erasure until a retention period expires** | Nothing | Defensible only with a stated period and a legal basis, and the MVP has neither |

**Accepted costs.**

- Email uniqueness must be enforced only among non-anonymised accounts, or
  the placeholder must live outside the unique column; otherwise the
  anonymised row blocks the address forever.
- The export endpoint must be kept in step with every field the other
  endpoints later gain, or it silently becomes a partial answer to a
  legal-flavoured request.
- The organisation's own terms have to carry a sentence the API cannot
  enforce: hours are retained, identity is not.
- An anonymised person may re-register with the same address and be treated
  as new, with no link to the old record. That linkage is a feature, not a
  leak, and it is also an accepted loss of continuity.

**Rejected alternatives.** Hard deletion of the person with their entries
(destroys reported hours and the audit trail), hard deletion with nulled
authors (breaks attribution, which is the point of the audit trail), a
configurable retention period in the MVP (funding audits want records kept,
not purged, and a period nobody sets is machinery nobody maintains), and a
whole-instance purge button (a destructive operation with no undo, offered
to the least supervised administrator).

**Left open.** Whether an organisation may configure retention at all
(deferred); whether the audit trail shows that a record was anonymised and
when (it should — the fact of erasure is itself auditable); whether
notifications age out, which is §15.12 item 25's business; and the legal
wording the organisation gives its volunteers, which is outside the API.

**Resolves:** backlog item B7 (§17). It also constrains B11: the audit trail
must survive anonymisation and must record the erasure itself.



## 16.20 Request identity and load control: server ids, token buckets, size caps

**Confirmed decision (D-053) — 23 November 2026.**

Every response already carries a `requestId` (D-039), and nothing said where
that id comes from. Three questions sit in that gap: who names a request, how
fast a caller may repeat one, and how large one request may be. They are
answered together because all three protect the same thing — the instance's
ability to answer the next volunteer correctly.

**The case this protects.** Saturday, 09:05. Twenty volunteers arrive for the
pantry shift and sign in over the pantry's single wi-fi connection. Dee has
fourteen entries queued from a week offline and her phone releases them the
moment it sees the network. One phone, still on an old build, has a retry bug
that fires the same submission every 400 milliseconds. Without a convention
the third event is indistinguishable from the first two: the instance spends
its morning absorbing retries, and when someone reports "it didn't save at
09:05" the only available answer is that it was slow around nine. With one,
each request has a name, the runaway phone is told to wait, and the report is
answered from a log line.

**Rules.**

1. **The server mints the request id.** Every response — success or failure —
   carries `X-Request-Id`: a UUIDv7 generated on arrival, before the body is
   parsed. Version 7 rather than 4 because its leading bytes are a millisecond
   timestamp, so log entries sort and range-query by id with no second index
   and two requests in the same second still order deterministically.
2. **An inbound `X-Request-Id` is never adopted.** If a caller sends one it is
   ignored — not merged, not echoed. Otherwise any client could write
   arbitrary text into the log, reuse another request's identity, or make
   eleven different attempts share one name and destroy its only use.
3. **A client may attach its own reference.** `X-Client-Request-Id` is
   optional, matched against `^[A-Za-z0-9._:-]{1,64}$`, written to the request
   log line and echoed in the response under the same name. A value that does
   not match is dropped silently, never rejected: a tracing nicety must not
   fail a legitimate write. It is a second identifier, never a replacement,
   and it is what the app sends when it wants to recognise its own queue item.
4. **Signed-in traffic is limited per user.** A token bucket of 300 requests
   per minute with a burst of 60, keyed by the authenticated user id. Dee's
   fourteen queued entries are fourteen tokens from a bucket that starts full;
   a runaway loop is eventually stopped; and neither can touch anyone else's
   allowance.
5. **Unauthenticated traffic is limited per address.** 60 per minute, burst
   10, keyed by the address the connection came from. Only sign-in,
   registration and token refresh live here. The bucket's purpose is to make
   password guessing slow, not to ration a room: twenty sign-ins in a minute
   fit inside 60.
6. **The bucket is a token bucket, not a fixed window.** Tokens refill
   continuously and a caller that idles accumulates up to the burst. A fixed
   window would allow 60 requests at 11:59:59 and another 60 at 12:00:00 —
   exactly the double burst the limit exists to prevent.
7. **Every response reports the bucket state**, on `429` as well as on success:
   `RateLimit-Limit` (the bucket's capacity), `RateLimit-Remaining` (tokens
   left, floored at zero) and `RateLimit-Reset` (seconds until at least one
   token is available again). A client that reads them can slow down before it
   is refused rather than after.
8. **Exhaustion is a `429 RATE_LIMITED`, never a dropped connection and never
   a silent delay.** `Retry-After` carries the wait in seconds, and
   `details.retryAfterSeconds` repeats the same number for clients that read
   only the envelope. Nothing about the request is stored or half-applied.
9. **A request body over 1 MiB is refused with `413 PAYLOAD_TOO_LARGE`**,
   before parsing and without buffering the whole body: a declared
   `Content-Length` over the cap is rejected on the header alone, and a chunked
   body is counted and cut at the limit. Authentication is decided from
   headers, so an unauthenticated oversized body gets `401` and is never read.
   A single entry is a few hundred bytes; 1 MiB is roughly four thousand of
   them. Batch submission is not in the MVP, which is the cost of the cap.
10. **`details.errors` is capped at 100 entries**, in discovery order, with
    `truncated: true` when more were found. Silently returning the first
    hundred would let a client fix everything listed and still fail with no
    explanation; the flag is what makes the cap honest.
11. **Strings are never truncated at write time.** An over-length field is
    rejected with its own field code. Cutting a value to fit stores something
    the person did not write, and nothing downstream can detect it.
12. **A query string over 8 KiB is `400 MALFORMED_REQUEST`**, using the code
    D-039 already assigns to an unparseable request: at that size the request
    is malformed rather than merely large. `pageSize` stays capped at 100
    (D-040); list bodies are server-shaped and need no separate ceiling.

```http
HTTP/1.1 201 Created
Location: /v1/time-entries/0f6a…
X-Request-Id: 0193a0f4-6b1e-7c2d-8f3a-5d9e7b1c4a20
X-Client-Request-Id: dee-queue-14
RateLimit-Limit: 300
RateLimit-Remaining: 287
RateLimit-Reset: 1
```

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 12
RateLimit-Limit: 300
RateLimit-Remaining: 0
RateLimit-Reset: 12
X-Request-Id: 0193a0f4-6b1e-7c2d-8f3a-5d9e7b1c4a20
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Retry after 12 seconds.",
    "requestId": "0193a0f4-6b1e-7c2d-8f3a-5d9e7b1c4a20",
    "details": { "retryAfterSeconds": 12 }
  }
}
```

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Request body exceeds the 1 MiB limit.",
    "requestId": "0193a0f4-6b1e-7c2d-8f3a-5d9e7b1c4a21",
    "details": { "limitBytes": 1048576 }
  }
}
```

| Option | What happens on the support call | What it costs |
|---|---|---|
| **Server-minted UUIDv7, with an optional client reference (recommended)** | The reported id resolves to one log line; the client's own reference is there beside it | Two headers to explain, though the second is optional |
| Adopt a client-supplied `X-Request-Id` when present | One id end to end, when clients cooperate | The log becomes caller-controlled: duplicate and invented ids make it untrustworthy exactly when it matters |
| Require the client to send the id | Strong correlation for well-behaved clients | A client that crashes before generating one cannot be traced at all, and the server cannot refuse the request on that basis |
| No id on successful responses | Nothing to explain | A report about a reply that *looked* successful has nothing to search for; D-039's promise becomes half true |

| Bucket key | Effect on the Saturday rush | Cost |
|---|---|---|
| **Per user when signed in, per address when not (recommended)** | Twenty sign-ins and one large queue are both accommodated; only the runaway phone is stopped | Two rules and two sets of numbers |
| Per address for every route | One rule | Twenty volunteers on one connection share 60 requests a minute; the twelfth person is locked out by the first eleven and reads it as an outage |
| Per user and per address combined, signed-in included | Tightest | A shared pantry connection throttles people who did nothing wrong, and the bucket that binds is never the one the error message describes |

**Accepted costs.**

- `Retry-After` and `details.retryAfterSeconds` are two renderings of one
  number, so they can disagree. A test asserts equality; the duplication buys
  generic HTTP clients and envelope-only clients each the field they read.
- Buckets live in process memory, so a restart forgives an exhausted caller
  and two processes mean two allowances. Correct for the single-process
  deployment the MVP ships; a shared store is the fix if the instance is ever
  scaled out, and `Remaining` is approximate until then.
- The address bucket treats a household, a pantry and a carrier-grade NAT as
  one caller. Sixty a minute is chosen to sit above a room full of sign-ins;
  a room of sixty arriving in the same seconds will see `429`, and the message
  has to be phrased so that reads as "wait a moment" rather than "broken".
- The address is taken from the connection, not from `X-Forwarded-For`. Behind
  a reverse proxy every request shares the proxy's address until the proxy is
  configured, which is an operator step the deployment notes must carry.
- Limits are deployment configuration, not an administrator setting. Whoever
  deploys the instance can change the numbers through environment
  configuration; there is no in-app control, and no supported state in which
  the buckets are switched off — a disabled limit is protection whose absence
  nobody notices. An organisation that needs a different ceiling needs
  whoever deployed the instance.
- Three extra headers on every response, including list responses where they
  are least interesting.

**Rejected alternatives.** A fixed per-minute window (double burst at the
boundary), a per-address limit on authenticated routes (punishes shared
connections), a `429` without `Retry-After` (the client guesses), dropping the
connection instead of answering (indistinguishable from a network fault, and
invisible in the log), truncating over-length strings (stores data the person
did not enter), returning every validation error without a cap (a response
larger than the request), and making `X-Request-Id` client-supplied (a log any
caller can forge).

**Left open.** Whether the three `RateLimit-*` headers should later add the
IETF combined `RateLimit` field — additive, and a client that reads either
keeps working; whether the audit trail stores `X-Client-Request-Id` (it does
not in the MVP: the request log does, which keeps audit rows small); whether
an in-app administrator control over the numbers should ever exist
(deployment configuration is enough for the MVP), the buckets themselves
never being switchable off, for the reason given under accepted costs; and whether `429` timing on sign-in needs to be made uniform with
`401` to avoid revealing which addresses are real — **answered in D-056 (§16.23):** the per-address bucket
is applied before the credential is examined, so a blocked address receives
`429` with `Retry-After` whether or not the account exists.

**Resolves:** backlog item B13 (§17). It also closes D-039's "no `retryable`
flag yet" note: `429` is the one retryable status, by D-049's classification
(§16.16), and every other `4xx` is terminal for that request.

## 16.21 One list contract for every collection

**Confirmed decision (D-054) — 24 November 2026.**

D-037 and D-040 fixed what a page looks like and how time entries are ordered.
Four other collections exist as soon as the interface does — notifications,
assignment requests, users and the audit log — and each has its own natural
order. Undecided, they diverge, and every client learns the same lesson four
more times.

**The case this protects.** Nadia coordinates the Saturday Pantry. Monday at
08:50 she opens the dashboard: 43 pending assignment requests, 212 unread
notifications, and an auditor asking what happened to eleven entries in
October. Without a shared contract the app carries four pagers, four empty
states and four retry rules; pasting a notifications cursor into the requests
list returns a plausible page of the wrong rows, and nobody notices until a
request goes unanswered. With one contract the app carries one pager, and the
mistake is a refused cursor instead of a silent misreading.

**Rules.**

1. **One envelope, no exceptions.** Every list endpoint returns exactly
   `items`, `nextCursor` and `pageSize` (D-040). `nextCursor` is `null` on the
   last page. Nothing else appears at the top level — no per-collection key,
   no wrapper object, no bare array.
2. **Each collection has one fixed total order**, ended by the row `id` so the
   order is total and two rows sharing a timestamp cannot swap between pages.
   There is no `sort` parameter in the MVP.
3. **Live results, as for entries.** Each page reflects current state (D-035):
   deduplicate by `id`, and refresh rather than assuming a scroll was
   complete. A row whose sort key changes mid-scroll may repeat or be skipped.
4. **A cursor belongs to one collection and one filter set.** D-037's token,
   with one payload field added: `c`, the collection, alongside the existing
   `v`, `k` and `q` (D-037's `v` is the format version, which is exactly how
   its payload is allowed to grow). `q` still fingerprints the normalised
   filter set; `k` becomes each collection's ordering tuple, still ending in
   the row `id`. Presenting a cursor to another collection, or after changing
   a filter, is a `400 CURSOR_QUERY_MISMATCH` rather than a page of the wrong
   rows — the collection is compared before the fingerprint, so the two
   mistakes produce the same code. Changing `pageSize` mid-scroll is
   permitted, because `q` excludes it and the frontier does not move.
5. **Filters narrow; they never reorder.** The filter sets below are the whole
   of the MVP's, and an unknown parameter is a `400 VALIDATION_FAILED` rather
   than being ignored.
6. **No list returns a total.** A count on every page of the audit log is a
   scan of everything the organisation has ever done, and it implies the
   frozen view D-035 rejected. Unread and pending figures come from dedicated
   counting endpoints, deferred in §16.7 and not settled here.
7. **The users list is administrator-only and hides what it need not show.**
   `q` matches a display name by prefix and an email address exactly — no
   free-text search in the MVP. An anonymised person appears under their
   stable `id` with `anonymisedAt` set and the email withheld (D-052), so
   history stays coherent without inventing a status value D-052 does not
   define. Coordinators reach people through their project's
   assignments; a coordinator-facing directory would be a filter on this same
   route, not a fifth shape.
8. **The audit list's shape is fixed here; its contents and its readers are
   not.** B11 still decides what is recorded and who may read it. B8 fixes only
   that it is a page of immutable rows in the envelope, newest first.

| Collection | Fixed order | Notable filters |
|---|---|---|
| **Notifications** | `createdAt` desc, `id` desc | `unreadOnly`, `since`, `until` |
| **Assignment requests** | pending group first (`requestedAt` asc, `id` asc), then resolved group (`requestedAt` desc, `id` desc) | `status`, `projectId`, `volunteerId` |
| **Users** | `displayName` asc (case-insensitive), `id` asc | `role`, `status`, `projectId`, `q` |
| **Audit log** | `occurredAt` desc, `id` desc | `actorId`, `entityType` + `entityId`, `action`, `from`, `to` |

The assignment-request order needs its reason stated, because it is the one
that is not simply "newest first": the pending group is a queue, so the person
who has waited longest is served first, while resolved rows are history and
read newest-first. It is one total order, not two: `(group, requestedAt, id)`,
where `group` is `0` for pending and `1` otherwise.

```json
{
  "items": [
    { "id": "5b7c…", "type": "ENTRY_APPROVED", "createdAt": "2026-11-22T18:04:00Z",
      "readAt": null, "entryId": "0f6a…", "projectId": "a3f1…",
      "message": "Your entry for 22 Nov was approved." }
  ],
  "nextCursor": "eyJjIjoibm90aWZpY2F0aW9ucyIsImYiOiJ1bnJlYWQiLCJrIjpbIjIwMjYtMTEtMjJUMTg6MDQ6MDBaIiwiNWI3YyJdfQ",
  "pageSize": 50
}
```

```json
{
  "items": [
    { "id": "c19e…", "status": "pending", "requestedAt": "2026-11-20T07:12:00Z",
      "volunteerId": "9c21…", "projectId": "a3f1…", "decidedAt": null,
      "decidedBy": null, "note": "Can cover the early shift." }
  ],
  "nextCursor": null,
  "pageSize": 50
}
```

```json
{
  "items": [
    { "id": "e004…", "occurredAt": "2026-10-04T08:12:00Z", "action": "COORDINATOR_GRANTED",
      "actorId": "77bd…", "entityType": "project", "entityId": "a3f1…",
      "requestId": "0193a0f4-…", "before": null, "after": { "grantedTo": "9c21…" } }
  ],
  "nextCursor": "eyJjIjoiYXVkaXQiLCJrIjpbIjIwMjYtMTAtMDRUMDg6MTI6MDBaIiwiZTAwNCJdfQ",
  "pageSize": 50
}
```

| Option | What Nadia's app gets | What it costs |
|---|---|---|
| **One envelope, fixed order per collection, collection-bound cursors (recommended)** | One pager for five lists; a mismatched cursor fails loudly | Four order rules and four filter sets to document, and no way to ask for "newest pending" |
| One envelope, but `offset`/`limit` for the three small collections | Marginally simpler cursors | Rows shift while scrolling, producing duplicates and silent omissions — the failure D-035 exists to prevent |
| A bespoke body per collection (`{notifications, unreadCount}`, bare arrays) | Each screen fits perfectly | Four shapes, four clients, four ways to break, and a fifth on the next collection |
| One envelope plus `total` on every list | "43 pending" straight from the response | A count on every scroll page of the audit log, and a frozen-view promise the design does not make |

**Accepted costs.**

- Four order rules and four filter sets must be written down and tested, and
  the two-direction assignment-request order needs its one sentence wherever
  client authors look.
- No `total` in any list means the unread badge needs its own small endpoint —
  the counting item deferred in §16.7, not something B8 quietly settles.
- The audit list's shape is fixed before B11 decides what it contains and who
  may read it, so B11 inherits a shape rather than choosing one.
- The users list is administrator-only in the MVP; a coordinator who wants to
  browse people is served by their project's assignments instead. That is a
  smaller MVP surface and a visible gap if coordinators ask for it.
- `q` is a prefix match on names and an exact match on addresses. Anything
  resembling search is deferred, and someone will ask for it.
- Five collections to keep in step as fields are added, where four divergent
  shapes would each drift on their own.

**Rejected alternatives.** Offset pagination for the smaller collections
(unstable under inserts), bespoke bodies per collection (four shapes to keep
in step and four client pagers), `total` in list bodies (cost on every page,
and it implies a snapshot), a `sort`/`order` parameter in the MVP (it
multiplies the cursor's fingerprint means "same list" across every collection
for a preference nobody has asked for yet), ignoring unknown query parameters
(a typo becomes silently unfiltered data), and returning a bare array (no room
for `nextCursor`, so no way to continue).

**Left open.** Whether an `order` parameter ever arrives, and on which
collections; free-text search over users; notification retention, which is
B10 and §15.12 item 25; the audit list's contents and access, which is B11;
the counting endpoints, already deferred; and whether a coordinator-facing
directory is wanted, which would be a filter rather than a new shape.

**Resolves:** backlog item B8 (§17). It constrains B10 (notification filters
now exist, so transport must not invent a second list) and B11 (the audit
list's shape is fixed; its contents, immutability rules and readers are not).

## 16.22 What a write returns: the resource, and the counts that come before it

**Confirmed decision (D-055) — 24 November 2026.**

D-049 fixed the shape of a create and its replay for time entries. D-042 fixed
that an archive confirmation names its impact **before** the act. Every other
mutation — submit, approve, reject, archive, restore, grant, revoke, cancel,
mark read — sat between those two answers with none of its own. This section
generalises the first and keeps the second.

**The case this protects.** Nadia opens the pantry's archive dialog. It says
twelve assignments will end and three pending requests will be cancelled. She
confirms, and three things have to be true at once, without a refresh:

- her screen shows the project archived, because the response is the new state
  rather than a bare acknowledgement;
- Dee's phone, replaying the same approval out of last night's queue, shows no
  error, because the second attempt is recognised as the same act;
- the audit trail later shows what actually happened, not the count Nadia
  approved — a volunteer asked for access while the dialog was open, so four
  requests were cancelled, not three.

**Rules.**

1. **Every successful mutation returns the full current representation of the
   resource it changed**, in the shape its read already uses. Not a
   `{ "success": true }`, not a patch of the changed fields, not an empty body.
2. **Creation is `201 Created`** with `Location: /v1/<collection>/<id>` — paths
   carry the `/v1` prefix settled under §15.12 item 31 — and the new resource as
   its body, including `version: 1` where the resource is versioned.
3. **Everything else is `200 OK`** with the resource in its new state. A
   mutation's answer and a read's answer are the same representation, so a
   client that just wrote something does not have to fetch it back to render it.
4. **A replay is `200 OK` with `Idempotency-Replay: true` and the same body
   shape**, with `version` at whatever it is now rather than at the value the
   first attempt returned (D-049, §16.16). Two sources of identity are used,
   chosen by what the record already guarantees:
   - where the client supplies the `id` (entries, projects, activities), the
     insert-on-conflict rule of D-049 decides;
   - where the business rule already makes the row unique (one active grant per
     project and person; one pending request per project and person), the
     constraint decides, and a retried create returns the **existing row** as a
     replay rather than a `409`. A constraint that already says "this can exist
     once" is the idempotency key; a second mechanism beside it could only
     disagree with it.
5. **State-setting operations are idempotent by outcome, not by header.**
   Archiving an archived project returns `200` with the original `archivedAt`;
   restoring an active project returns its current state (D-042, D-043).
   Nothing about repetition has to be signalled, because the body already says
   the state was already the requested one.
6. **`409 VERSION_MISMATCH` keeps the shape D-049 fixed** —
   `{ "currentVersion", "updatedAt", "current": { …resource… } }` — for every
   versioned resource, not only entries. The `current` copy saves the round
   trip; a client replaces its copy wholesale rather than merging two versions
   field by field, which is how a stale field survives unnoticed.
7. **No mutation returns counts.** What the act affected is named by the
   confirmation read before it, not by the act afterwards. Archival's impact is
   read from `GET /v1/projects/{id}/archival-impact`, which uses the same
   authority as the act itself (D-041):

```json
{
  "assignmentsEnding": 12,
  "pendingRequestsCancelling": 3,
  "activitiesArchiving": 2,
  "computedAt": "2026-11-24T09:08:00Z"
}
```

   The figures are **advisory**: the interval between reading them and acting is
   real, someone may submit in it, and the act must not be refused because its
   consequences moved. A confirmation that says "three" and a trail that says
   "four" is the honest pair; a confirmation and a response that both say three
   while four were cancelled is the dishonest one.

8. **Deletion is the one `204 No Content`.** A user may delete their own
   notification (§6.1), and there is no representation left to return. Entries
   are never deleted (D-052), so no other route needs it.
9. **A bulk endpoint, if one is ever added, returns `{ "updated": <n> }` and no
   rows**, because the client already holds them. Whether bulk mark-read exists
   is B10's.
10. **The server's own fields come from the server, in every response.**
    `createdAt`, `updatedAt`, `submittedAt`, `approvedAt`, `version` and
    `durationSeconds` are computed on the server; a value the client sent is
    never echoed back as though the server had confirmed it.

**The shapes.** The paths and verbs below are illustrative — item 29 settles
those — but the status codes and bodies are what this decision fixes.

```http
HTTP/1.1 201 Created
Location: /v1/projects/a3f1…/coordinators/c19e…
X-Request-Id: 0193a0f4-6b1e-7c2d-8f3a-5d9e7b1c4a52
```

```json
{
  "id": "c19e…",
  "projectId": "a3f1…",
  "userId": "9c21…",
  "grantedBy": "77bd…",
  "grantedAt": "2026-11-24T09:02:41Z",
  "endedAt": null
}
```

A second identical grant request, from a coordinator who did not see the first
answer, returns `200 OK`, `Idempotency-Replay: true`, and that same row.

```json
{
  "id": "6f1c9a3e-…",
  "version": 4,
  "approvalStatus": "approved",
  "approvedAt": "2026-11-24T09:12:41Z",
  "reviewedBy": "77bd…",
  "updatedAt": "2026-11-24T09:12:41Z",
  "durationSeconds": 10800
}
```

and when someone else got there first:

```http
HTTP/1.1 409 Conflict
```

```json
{
  "error": {
    "code": "VERSION_MISMATCH",
    "message": "This entry has changed since you loaded it.",
    "requestId": "0193a0f4-6b1e-7c2d-8f3a-5d9e7b1c4a53",
    "details": {
      "currentVersion": 7,
      "updatedAt": "2026-11-24T09:12:02Z",
      "current": { "id": "6f1c9a3e-…", "version": 7, "approvalStatus": "approved" }
    }
  }
}
```

| Option | What Nadia's screen does | What it costs |
|---|---|---|
| **Full representation on every mutation, counts only in the confirmation read (recommended)** | Renders the new state from the reply; no refetch, no stale card | Larger responses — a project's forty fields come back on every status change |
| `204 No Content` on every write, client re-fetches | Nothing to design | Two requests per action, a race between them, and an offline client that cannot refresh at all |
| Return only the fields that changed | Smallest responses | Every client merges, and a merge bug looks exactly like a server bug |
| Counts in the archive response as well as before it | Confirms the impact afterwards | Restores the after-the-fact count D-042 removed, and it can disagree with the confirmation the person actually approved |

**Accepted costs.**

- Mutation bodies are larger, and each is a snapshot that can go stale the
  moment someone else writes — which is why `version` travels with it.
- The impact read duplicates arithmetic the mutation performs, so one
  implementation must serve both, and the two must be allowed to differ.
- Constraint-based replay means every create route has to say which rule makes
  its rows unique; a route that cannot name one has no replay protection.
- `current` in a `409` is a whole resource in an error body, which is the
  largest error the API can produce.
- `204` survives as one special case that client libraries each handle their
  own way.
- The confirmation read is a route that exists only to fill a dialog, and it
  must not become a second, richer project view.

**Rejected alternatives.** `204` for all writes (forces a refetch and a race),
changed-fields-only patches (merge logic in every client), `{ "ok": true }`
(tells a client nothing it can render), counts in the archive response
(contradicts D-042's before-only confirmation), `currentVersion`-only `409`
(removes a round trip D-049 deliberately kept), and `Idempotency-Key` headers
(already rejected in D-049: the record's identity is the key).

**Left open.** Whether `updatedAt` is contract or convenience; the exact field
names in the impact payload; whether an `ETag`/`If-Match` pair ever replaces the
body `version` (it would be additive); and bulk shapes, which belong to B10 if a
bulk endpoint ever exists.

**Resolves:** backlog item B12 (§17). It settles the shape every mutation and
every route consumes, and it constrains B10 (a bulk mark-read, if it exists,
returns a count and no rows) and B11 (the audit trail records what the act did,
not what the confirmation predicted).

## 16.23 The session: a bearer token, a rotating refresh token, and no browser

**Confirmed decision (D-056) — 24 November 2026.**

D-050 fixed that each organisation runs its own instance, so authentication is self-hosted and there is no shared identity provider to inherit a token policy from. §3.1 left the credential itself open, and B14 (§17) carried everything about a sign-in that shapes the client: how long it lasts, how it is renewed, how it ends, and what a cookie would have required. The MVP has **one client, and it is the native mobile app** (§2.1); that single fact removes half of the question and changes one of its numbers.

**The case this protects.** A season at the Saturday Pantry: nine volunteers, one coordinator, and one basement with no signal.

- Dee works four hours in that basement. Four entries are recorded on the phone and sit in the queue.
- Sunday afternoon her phone finds a bar of signal on a bus. The queue starts to drain, the access token has expired, the app refreshes — and the bus enters a tunnel before the answer arrives. Server-side the refresh succeeded and the old token is spent; client-side the app still holds the old one and retries it. A rotation rule without a grace window reads that retry as a stolen token and ends the session. Dee is signed out with two entries still queued, looking at a password field she cannot reliably fill in on a moving bus.
- Priya volunteers only in tax season. Her last shift was 12 March; she opens the app on 8 June. A 30-day idle limit died on 11 April. Signing in again is survivable, but the same clock applied to a *device* rather than a person is what keeps a sold phone authenticated for weeks.
- Marcus loses his old phone in October. He signs in on the new one, opens the device list, and ends the old session. It has to stop on its next request, not thirty minutes later.
- A browser tab on the pantry's shared laptop must never be able to act as Nadia just because she once signed in on it. There is no browser client in the MVP (§2.1), so that case is removed rather than defended against.

Each of those is a different failure of the same design, and each is cheap to prevent with a rule here.

**Rules.**

1. **One credential type, one header.** Every route except `POST /v1/auth/sign-in` and `POST /v1/auth/refresh` requires `Authorization: Bearer <access token>`. No route accepts a token in a query parameter, a body field or a cookie. The two unauthenticated routes are the ones that mint a token, so there is no third case to remember — including the session routes themselves, which are refreshed and then called like any other.
2. **No cookie, therefore no CSRF, and no CORS.** The MVP has no browser client (§2.1). No response sets `Set-Cookie`, no route reads a cookie, and the API sends no `Access-Control-Allow-*` headers. A browser cannot use this API and is not meant to: without CORS headers, a page's scripted request is refused by the browser itself. A future web client is its own decision — cookie refresh, CSRF protection, an origin allowlist — additive to this one, not a dormant branch of it.
3. **The access token is a signed JWT lasting 30 minutes**, carrying `sub` (user id), `sid` (session id), `iat` and `exp`, and **nothing about permission**: no role, no grant list, no projects. Authorization is re-evaluated per request from the database (§4.5), so a revoked grant or a changed role takes effect on the next call rather than whenever a token happens to expire.
4. **The refresh token is opaque, single-use and rotating.** 32 random bytes, base64url, stored only as a SHA-256 hash. Every successful refresh mints a new access token *and* a new refresh token, and spends the old one. A refresh response is the only place a refresh token is ever issued.
5. **The session is bounded twice.** An **idle limit of 90 days**: 90 consecutive days without a successful refresh ends it. An **absolute limit of 180 days** from creation: no amount of use extends it. Either limit ends the session with `401 UNAUTHENTICATED`. Both are deployment configuration with these defaults; an instance may shorten either, and may not raise the absolute ceiling above 180 days.
6. **A spent refresh token is replayed for 120 seconds, not punished.** After a rotation the previous hash and the pair it produced are kept for 120 seconds. A refresh arriving with the previous token inside that window returns **that same pair** — identical tokens, identical expiry — with `200 OK` and `Idempotency-Replay: true` (D-055's signal, reused rather than reinvented). No new rotation, no new session. Outside 120 seconds, presenting a spent token is treated as theft: the session is revoked and every token descended from it dies. The honest client sees one `401` and signs in; the thief's copy is already dead.
7. **`sid` is checked on every request.** A correctly signed, unexpired access token is not sufficient: the row named by `sid` must exist, must not be revoked, and must be inside both limits. Otherwise `401`. This is what makes Marcus's lost phone stop within one request instead of within 30 minutes, and it is why a short access token does not have to be the only defence.
8. **Every authentication failure looks identical.** Unknown address, wrong password, expired access token, revoked session and reused refresh token all return `401 UNAUTHENTICATED` with the same envelope and no further detail; `WWW-Authenticate: Bearer` is present for standards compliance. Sign-in compares against a dummy hash when the address has no account, so the answer does not arrive measurably faster for an address that does not exist. This also answers the question §16.20 left open about `429` on sign-in: D-053's per-address bucket is applied *before* the credential is examined, so a blocked address receives `429` with `Retry-After` whether or not the account exists.
9. **Sessions are a resource the person can see and end.** `GET /v1/auth/sessions` lists them in a D-054 list body (`items`, `nextCursor`, `pageSize`) with `id`, `deviceLabel`, `createdAt`, `lastRefreshedAt` and `current`; `DELETE /v1/auth/sessions/{id}` ends one and returns `204 No Content` under D-055's deletion rule. **Signing out is that same route.** There is no separate sign-out verb, because a sign-out and a remote revocation do exactly the same thing to the same row.
10. **Changing the credential ends the other sessions.** A successful credential change — whose route §3.1 still owns — revokes every session of that user except the one that performed it, and the response says nothing about how many. An account compromised through its password does not stay compromised on devices its owner no longer holds.
11. **The tokens live in the operating system's secure store.** iOS Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`; Android Keystore-backed storage. Not `NSUserDefaults`, not `SharedPreferences`, not a log line, not a crash report, not a URL. Sign-out deletes the item explicitly: on iOS the Keychain otherwise survives app deletion, and a reinstall would silently resume a session the person believes they ended.
12. **A rejected refresh pauses the queue; it never clears it.** A `401` during sync leaves the outbox intact and asks for sign-in (§7.1). The access token is refreshed on app foreground rather than on a timer, and the client keeps at most one refresh in flight: five parallel `401`s must produce one refresh, not five, or the client revokes itself through rule 6.

**The shapes.** Sign-in creates a session, so D-055 makes it `201` with `Location`, and the body carries the two tokens — the only moment either is returned for that session.

```http
POST /v1/auth/sign-in HTTP/1.1
Content-Type: application/json

{ "email": "dee@example.org", "password": "…", "deviceLabel": "Pixel 8 — Dee" }
```

```http
HTTP/1.1 201 Created
Location: /v1/auth/sessions/8a41c2d7-…
Content-Type: application/json
X-Request-Id: 0193a0f4-6b1e-7c2d-8f3a-5d9e7b1c4a60
```

```json
{
  "session": {
    "id": "8a41c2d7-…",
    "deviceLabel": "Pixel 8 — Dee",
    "createdAt": "2026-11-24T09:12:00Z",
    "lastRefreshedAt": "2026-11-24T09:12:00Z",
    "current": true
  },
  "accessToken": "eyJhbGciOi…",
  "accessTokenExpiresAt": "2026-11-24T09:42:00Z",
  "refreshToken": "rt_9f2c7a1e5b…",
  "refreshTokenExpiresAt": "2027-05-23T09:12:00Z"
}
```

A refresh, then the same refresh replayed because the first answer was lost forty seconds earlier:

```http
POST /v1/auth/refresh HTTP/1.1
Content-Type: application/json

{ "refreshToken": "rt_9f2c7a1e5b…" }
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "accessToken": "eyJhbGciOi…",
  "accessTokenExpiresAt": "2026-11-24T10:12:00Z",
  "refreshToken": "rt_4b8d0f6a2c…",
  "refreshTokenExpiresAt": "2027-05-23T09:12:00Z"
}
```

```http
HTTP/1.1 200 OK
Idempotency-Replay: true
Content-Type: application/json
```

```json
{
  "accessToken": "eyJhbGciOi…",
  "accessTokenExpiresAt": "2026-11-24T10:12:00Z",
  "refreshToken": "rt_4b8d0f6a2c…",
  "refreshTokenExpiresAt": "2027-05-23T09:12:00Z"
}
```

Ending a session — signing out is the same call:

```http
DELETE /v1/auth/sessions/8a41c2d7-… HTTP/1.1
Authorization: Bearer eyJhbGciOi…

HTTP/1.1 204 No Content
```

The session table (a sketch; the schema is §15.12 item 28):

```sql
sessions (
  id                uuid primary key,
  user_id           uuid not null,
  refresh_hash      bytea not null,   -- sha256 of the current refresh token
  previous_hash     bytea,            -- sha256 of the spent one, grace window only
  previous_issued   jsonb,            -- the pair it produced, returned on replay
  created_at        timestamptz not null,
  last_refreshed_at timestamptz not null,  -- the idle clock
  rotated_at        timestamptz,
  revoked_at        timestamptz,
  device_label      text
)
```

There is no `access_hash`: the access token is a stateless JWT and the `sid` lookup is the check that matters. Revoked rows are tombstoned (`revoked_at`), never deleted, so a presentation of an old token is a recordable event rather than an absent row.

| Option | Dee on the bus | What it costs |
|---|---|---|
| **Bearer access token, rotating refresh, 120-second replay grace, `sid` checked per request (recommended)** | The retry is answered from the stored pair; the queue drains; nobody is signed out by a tunnel | One extra session lookup per request, a stored pair for two minutes, and a client rule about single-flight refreshes |
| A long-lived access token (say 30 days), no refresh at all | Nothing to refresh, so nothing to lose | A stolen token is a 30-day credential nobody can shorten; revocation waits for expiry; roles in the token or a lookup on every call either way |
| A short access token and a non-rotating refresh token | The retry works | A stolen refresh token stays valid for its whole lifetime and theft is invisible — no reuse to detect |
| Cookie session, as a browser would have it | Same as recommended | Needs CSRF tokens, `SameSite` reasoning, an origin allowlist and a CORS contract — for a client that does not exist |
| Access token only, re-sign-in on expiry | No refresh surface at all | A volunteer re-enters a password mid-shift, on a phone, in a basement; the queue stalls whenever it happens |

**Deferred: multi-factor authentication.** No second factor, no enrolment flow, no recovery codes in the MVP. A password is therefore the whole credential, and the mitigations that remain are D-053's per-address bucket on sign-in, rule 8's uniform answer, rule 9's device list, and rule 10's unreviewable revocation on a credential change. Passkeys and TOTP are additive later; neither changes the session model above, because both end in the same sign-in response.

**Accepted costs.**

- Every authenticated request costs one indexed session lookup, so authentication is two checks rather than one. Rule 7 is the reason, and it is the price of revocation that lands immediately.
- No in-process cache of session validity in the MVP: a cache would reintroduce exactly the revocation delay rule 7 removes.
- A 30-minute access token means a device that stays open all day refreshes roughly a few dozen times a day, each a small request on a phone radio that is already awake.
- A 90-day idle window leaves an unattended, unlocked phone signed in for months if nobody ends the session, so the device lock is doing real work rather than a decorative one.
- Retention of `previous_hash` and `previous_issued` for 120 seconds means a live refresh token exists in a second column for two minutes, and therefore that the pair is encrypted at rest or the column is treated as a secret.
- Sending no CORS headers means a future web client cannot be bolted on without a decision — and someone will try to bolt it on.
- The absolute limit still forces a re-authentication twice a year for the most active users, at a moment of the server's choosing rather than theirs.

**Rejected alternatives.** Cookie sessions with CSRF tokens (no browser client to protect, so the machinery would defend nothing), a non-rotating refresh token (theft is silent and permanent), rotation with no replay grace (a lost response logs the volunteer out, which is the tunnel test above), access-token expiry as the only revocation control (a 30-minute window for a lost phone), roles and grants baked into the access token (authorization would lag a revocation by up to 30 minutes, contradicting §4.5), a separate `POST /v1/auth/sign-out` (a second name for `DELETE` on the same row), and a token in the query string (it lands in logs and browser history).

**Left open.** Whether 30/90/180 are contract or configuration once the contract is drafted (configuration with documented defaults here); whether "sign out everywhere" is a route of its own or a client loop over the list; whether the session list should carry a coarse last-seen address so a person can recognise a device; whether `previous_issued` is encrypted at rest or stored as a hash plus a re-derivation (it cannot be re-derived — it holds a live token for 120 seconds, so encryption is the answer and the key management belongs to deployment); whether refresh should also be attempted on a background sync trigger as well as on foreground; MFA and passkeys; and the credential route itself, which remains §3.1's.

**Boundary with §3.1.** Nothing above says whether the credential is a password, a one-time code or an external provider. The examples show a password because that is the working assumption; rules 1–9 and 11–12 are unchanged if it becomes a code, and rule 10 becomes "changing the credential ends the other sessions" with whatever the credential's change route turns out to be.

**Resolves:** backlog item B14 (§17). It closes §16.20's open note on `429` versus `401` at sign-in, gives every business route in §16 its authentication requirement, and makes the client's session behaviour — foreground refresh, single-flight, a queue that survives `401` — part of the contract rather than an implementation detail. It constrains the authentication section of the contract draft (§15.12 items 26, 29) and the sync design (§15.12 item 30): a sync that meets an ended session pauses, it does not fail the queued records.

------------------------------------------------------------------------

# 17. Decision backlog: gaps not yet raised

**Status:** planning register, 22 November 2026. Not decisions.

These nineteen gaps were found by reviewing the record against what an API contract and an implementation will actually need. They are not listed in §13 or §15.12. None has been decided; B16–B19 were surfaced while taking up B1 and left open with it. They are recorded here so they are not discovered later, during build, when the cost is a schema migration or a breaking change.

Backlog items carry **B** identifiers, not **D** identifiers, because nothing has been decided. When one is taken up it becomes a numbered decision in §16 and the row records the decision ID and section. Rows are never deleted: a closed item stays, marked resolved, so the backlog also shows what was nearly missed.

**Reading the flag.** *Contract* — the API contract cannot be written consistently without it, because it fixes a field type, route shape, enum or validation rule other parts depend on. *Feature* — contract-blocking only if that feature ships in the MVP. *Launch* — does not shape the contract, but must be settled before real data exists. *Implementation* — internal choice with no contract surface.

| ID | Gap | Flag | Why it matters |
|---|---|---|---|
| **B1** | Time and duration model: storage precision, rounding, minimum and maximum length, breaks, entries spanning midnight, daylight-saving handling, which time zone interprets local times | **Contract** | **Resolved — D-046 (§16.13).** Decides column types, validation, ordering derived in D-038, date filters in §15.8 and every total |
| **B2** | Definition of an overlap: same volunteer across all projects or one, tolerance in minutes, blocking or advisory | **Contract** | **Resolved — D-047 (§16.14).** Entry validation, conflict fields and approval rules all reference it; §15.12 item 21 assumes it |
| **B3** | Timer semantics: one running timer or several, timer spanning midnight, server-authoritative start, clock skew, idle timeout, start/stop payloads | **Contract** — deferred | **Deferred — not decided (D-048, §16.15).** The MVP has no server timer, so no timer route, constraint or payload needs specifying; this row re-opens if that feature returns in a later release |
| **B4** | Concurrency and idempotency for mutations: client-generated ids on create, timer start/stop (only if server timers return, D-048) and archival; optimistic concurrency by version or `updatedAt` | **Contract** | **Resolved — D-049 (§16.16).** A client-generated UUID per record plus an integer `version`; no `Idempotency-Key`; state-setting operations idempotent by outcome. Offline replay (§15.12 item 30) depends on it |
| **B5** | Organisation model: single organisation per deployment or multi-tenant; can one volunteer belong to several; what organisation-level settings attach to | **Contract** | **Resolved — D-050 (§16.17).** The deployment is the tenant: each organisation runs its own instance, identity is scoped to it, and no organisation identifier appears in the API. One organisation row carries the time zone, approval policy and membership setting; no `organisation_id` columns |
| **B6** | Role and permission matrix: roles as membership attributes, whether admin/coordinator/volunteer overlap, who may read whose hours, who reads the audit trail | **Contract** | **Resolved — D-051 (§16.18).** Two membership roles, `volunteer` and `administrator`, with coordination held as `project_coordinators` rows (`granted_by`, `granted_at`, `ended_at`). Effective permission is the role union an active grant on the project; nobody approves their own entries; project-less entries are administrator-only; a non-administrator who creates a project becomes its first coordinator |
| **B7** | Retention and erasure: member offboarding, organisation deletion, personal-data export and erasure versus audit retention, archived-project lifetime | **Launch** | **Resolved — D-052 (§16.19).** The record is retained, the person is anonymised: entries and grants are never deleted on erasure, the user row is anonymised in place, archived projects never expire, `GET /v1/me/export` is self-service, and there is no organisation-purge endpoint |
| **B8** | List contract for every other collection: notifications, assignment requests, users, audit log — same `items`/`nextCursor`/`pageSize` shape, their filters and sorts | **Contract** | **Resolved — D-054 (§16.21).** Every collection uses the D-040 envelope with one fixed total order each, cursors bound to their collection and filter set (`CURSOR_QUERY_MISMATCH` otherwise), no `total` in any list body, and prefix-only `q` on users |
| **B9** | Reporting and totals: which statuses count as hours, period boundaries and week start, reports as endpoints or client aggregation | **Feature** | The record discusses totals throughout but never defines a reported hour |
| **B10** | Notification transport: in-app only or also email; delivery on timer stop, request cancellation and restore; read/unread and bulk mark-read semantics | **Feature** | §6.1 covers retention, not delivery |
| **B11** | Audit trail contract: what is recorded, who may read it, immutability, how it is exposed | **Feature** | Four decisions already name it as an output without specifying it |
| **B12** | Mutation response shapes: whether writes return the updated resource, and whether archival returns counts of what it affected | **Contract** | **Resolved — D-055 (§16.22).** Every mutation returns the changed resource in its read shape; creates are `201` + `Location`, replays `200` + `Idempotency-Replay` (by client id or by the uniqueness constraint), `409` keeps D-049's `current` copy, no mutation returns counts, and archival's impact comes from a confirmation read. Deletion is the only `204` |
| **B13** | Rate limits, payload caps and `requestId` propagation: limits, `details.errors` array caps, where the request ID originates and how it reaches logs | **Contract** | **Resolved — D-053 (§16.20).** Every response carries a server-minted UUIDv7 `X-Request-Id`; an inbound id is never adopted; an optional `X-Client-Request-Id` is logged and echoed only; token buckets of 300/min (burst 60) per user and 60/min (burst 10) per address; a 1 MiB body cap with `413`; `details.errors` capped at 100 with `truncated` |
| **B14** | Session model: token lifetime, refresh, revocation, MFA, lockout, CSRF for cookie sessions, CORS for a browser client | **Contract** | **Resolved — D-056 (§16.23).** Bearer tokens on every business route and no cookie, because the MVP has no browser client; a 30-minute access token, a single-use rotating refresh token with a 120-second replay grace, a 90-day idle and a 180-day absolute limit, and `sid` checked on every request so a revocation lands on the next call. Sessions are listed and ended from the phone, every authentication failure is the same `401 UNAUTHENTICATED`, and MFA is deferred |
| **B15** | Database engine, migrations and index strategy, including the composite index D-038's keyset ordering requires | **Implementation** | §15.12 item 28 names the schema; the operational half is unlisted |
| **B16** | Backdating window: how far in the past an entry may be dated or submitted | **Contract** | Surfaced while taking up B1 and set aside; §16.9 only forbids work after an archived instant |
| **B17** | Daily or weekly maximum hours, separate from the per-entry ceiling | **Feature** | Surfaced while taking up B1 and set aside; affects validation and reporting, not the record shape |
| **B18** | Break deduction: whether a shift records a break that is subtracted, rather than net time as two entries | **Feature** | Surfaced while taking up B1 and set aside; a break field is a derived quantity that can disagree with the timestamps |
| **B19** | Payroll rounding: whether exported hours are decimal, and the rule applied at the boundary | **Feature** | Surfaced while taking up B1 and set aside; the API stays exact and any rounding happens once, at export |

**Set aside while taking up B1.** B16–B19 above are the sub-questions that surfaced during the time-and-duration discussion and were deliberately not settled with it. They are open decisions, not rejected ones. The alternatives rejected during that discussion — local wall-clock times as storage, whole minutes as the canonical unit, per-project time zones, and splitting every entry at midnight — are not backlog items: they are recorded with the decision itself, with their reasons, so they are not re-litigated once it is confirmed. Break handling appears in both places on purpose: the MVP rule is net time through two entries, while whether a break field is ever added is B18.

**Dependencies between them.** B1 feeds B2, B3 (deferred) and B9, and B16–B19 surfaced from B1: an overlap is measured in the time model, and totals are summed in it. B5 is settled (§16.17) and fed B6 and B14; B6 is settled (§16.18), so every endpoint's authorization rule now has its shape. B7 is settled (§16.19) and constrains B11: an audit trail must survive anonymisation and record the erasure itself. B4 is now the convention every later endpoint inherits (§16.16); B13 is settled (§16.20) and every route inherits it too; B8 is settled (§16.21) and every other collection inherits its list shape, which leaves B11 as its main downstream: the audit list's contents and access are B11's, not B8's. B12 is settled (§16.22), so B16 inherits a mutation shape rather than choosing one; B14 is settled (§16.23), so every route's authentication requirement now has its shape too. Nothing here depends on the remaining §13 or §15.12 items, so these can be taken in any order the work allows.

**What must land before contract drafting.** B1, B2 and B16 are unavoidable. B3 was on that list and has left it with the server timer (D-048); it returns if that feature does. B14 has left it too (§16.23): the session model is the whole of what the authentication routes needed. B8 has left that list (§16.21), the other collection routes now having a shape to be drafted against, and B13 has left it too (§16.20); B12 has left it as well (§16.22), every mutation now having a shape. B9, B10, B11 and B15 do not hold up the contract, but every one of them is cheaper to decide before code exists than after. B7 has left that list (§16.19).

**Order proposed:** B16 next (the backdating window) — with B1, B2, B4, B5, B6, B7, B8, B12, B13 and B14 already closed and B3 deferred by scope (D-048), followed by the feature-conditional items as each feature is scheduled.