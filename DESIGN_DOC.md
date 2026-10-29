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

The MVP supports: - Timer-based time entries. - Manual time entries. -
Project and activity categorization. - Project-less time entries under a
description requirement. - Offline recording and later
synchronization. - Volunteer, coordinator, and
organization-administrator roles. - Configurable organization-level
policies for selected workflows.

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

### 2.4 Client/server boundary

**Established design direction:** The mobile app must not connect
directly to PostgreSQL. It communicates with the organization's API, and
the API performs authorization, validation, business logic, and database
operations.

The exact backend stack for this specific project has not been
reconfirmed as part of this decision record. TypeScript, Express, and
PostgreSQL have been discussed in the user's broader development
context, but the final implementation stack for this app remains **not
explicitly confirmed here**.

------------------------------------------------------------------------

## 3. Authentication, registration, and membership

### 3.1 Authentication method

**Deferred:** The authentication method is intentionally undecided.

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

**Not finalized:** Whether every coordinator can archive a project they
manage; the project owner has not yet answered that question.

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

The exact lifecycle statuses and archive/restore rules remain to be
designed.

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

**Provisional proposal:** Archiving a project should prevent new
assignments, close or deactivate existing assignments, and preserve
historical entries. This is consistent with the stated archival
direction but the exact transition rules have not been formally
approved.

**Open question:** May a coordinator archive projects they manage, or
must project archival require organization-administrator approval? The
recommendation was to allow coordinators to archive projects within
their remit, while administrators retain organization-wide control. This
recommendation is **not yet accepted or rejected**.

### 5.7 Project-less time entries

**Confirmed decision:** Project-less time is permitted, but a written
description of the activity is mandatory.

Implications: - A project-less entry has no project/activity
association. - The server validates that the required description is
present and meaningful according to a validation rule still to be
defined. - The entry remains identifiable as project-less in reports. -
A coordinator does not automatically gain authority over a project-less
entry; organization administrators retain organization-wide access. -
Offline clients may preserve a local draft, but the server must not
accept an invalid project-less entry as a valid completed submission. -
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

**Open questions:** - Must volunteers explicitly submit completed
entries for approval, or are they submitted automatically? - What
precisely counts as a material change? - What happens to pending entries
when the organization approval policy changes? - Who may approve which
categories of entries, and can coordinators approve entries for work
that is not associated with their project?

------------------------------------------------------------------------

## 7. Offline synchronization

### 7.1 Offline support is a requirement

**Confirmed decision:** The mobile app must be able to record time while
offline and synchronize it later.

The client should use local persistence and a durable sync queue. The
server remains authoritative for accepted state.

The client must also download server-side changes; synchronization is
not only uploading local changes.

### 7.2 Stable identifiers and idempotency

**Established design direction:** Client-created records should use
stable client-generated UUIDs. The API should make retrying a sync
operation idempotent so that a network retry does not create duplicate
entries.

This is especially important because mobile requests can fail after the
server has committed a change but before the client receives the
response.

The exact idempotency mechanism, retention window, and request contract
remain open.

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

A giant all-purpose `/sync` endpoint has not been selected.
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

**Open question:** For a policy change, should it apply only to new
actions, or also alter the handling of already-pending entries,
assignment requests, or approval requests? This needs to be decided per
policy.

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

The exact error envelope, status code, and whether an out-of-period
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

  D-027                   Stable client-generated    Established design
                          IDs and idempotent retries direction

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

## 13. Outstanding decisions and recommended order

The following items remain unresolved. They should be handled one at a
time rather than filled in by assumption.

### Priority 1 --- Finish project lifecycle and authority

1.  **Project archival authority:** Can coordinators archive their own
    projects, or does this require administrator approval?
    Recommendation made: coordinators can archive projects within their
    remit; administrators retain organization-wide authority. Not yet
    accepted.
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

5.  Decide whether completed entries are automatically submitted for
    approval or require explicit volunteer submission.
6.  Define entry lifecycle, approval status, and conflict status as
    separate state models.
7.  Define the exact conditions that trigger reapproval after editing an
    approved entry.
8.  Define what happens to pending entries and requests when
    organization settings change.
9.  Define how invalid but preserved submissions are surfaced,
    corrected, reviewed, or excluded from totals.

### Priority 3 --- Resource and policy details

10. Finalize profile required/optional fields and email-change
    verification behaviour.
11. Decide whether project-less activity description is separate from
    optional notes.
12. Define overlap warning/review behaviour.
13. Define what assignment departure does to pending time entries and
    requests, beyond the already agreed historical-time rule.
14. Define whether archived projects can ever be restored and how active
    assignments are handled during archival.

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

Continue with the outstanding project-lifecycle question already raised
in the design discussion:

**Should coordinators be allowed to archive projects they manage, while
organization administrators retain organization-wide archival
authority?**

Once that is settled, this document can be updated with the answer and
the remaining structural decisions can be resolved before drafting the
final API contract.

Supplement: Project Assignments, Coordinator Permissions, and Notifications

Status: Supplementary design decisions
Scope: Decisions made after the previous version of the design decision record.
Important: This supplement records confirmed decisions separately from optional behavior, deferred enhancements, and unresolved questions. It does not finalize API endpoints, database schemas, or UI designs.

1. Project coordinator model

1.1 Multiple coordinators

Confirmed decision: A project may have multiple coordinators assigned simultaneously.

The system must support multiple coordinator-to-project assignments. No lead-coordinator role is required for the MVP.

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

This includes:

- Who may archive a project.
- Whether coordinator-initiated archival requires administrator approval.
- What happens to existing assignments when a project is archived.
- Whether archival automatically ends assignments or changes their operational status.
- Whether archived projects may be restored.

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
- Idempotency behavior for retries and offline synchronization.
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

1. What happens to a running timer when membership is revoked?
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

These rules do not settle who may archive a project; archival permissions remain an open question.

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

**Confirmed decision — Hybrid submission workflow.**

When a volunteer manually stops a running timer, the application presents an option to log the recorded time.

The form should be quick to complete because relevant fields are pre-filled where possible, including:

- Start time.
- End time.
- Calculated duration.
- Project and activity, where available.

The volunteer can choose either:

1. **Log time:** Submit the entry under the organization's approval policy.
2. **Save as draft:** Preserve the entry without submitting it for approval.

Drafts may be submitted later.

Stopping a timer and submitting a time entry are separate actions. The recorded time must not be lost merely because the volunteer does not submit the entry immediately.

### 15.4.2 Manual entries

**Confirmed decision:** Manual entries use the same hybrid workflow.

The volunteer completes the manual entry form and chooses either **Log time** or **Save as draft**. Drafts may be submitted later.

Manual entries continue to support both established formats:

- Exact start and end timestamps.
- Work date and total duration, without exact timestamps.

### 15.4.3 Submission and approval are separate concepts

The submission workflow does not replace the existing organization-wide approval policy.

- A submitted entry follows the current organizational approval policy.
- If approval is required, the entry enters the applicable approval workflow.
- If approval is not required, the entry is handled under the policy that applies to entries not requiring approval.
- Saving a draft does not constitute submission for approval.

The exact lifecycle state machine, approval transitions, and handling of policy changes remain to be finalized.

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

- **Draft:** May be edited freely.
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

- Whether drafts may be permanently deleted or must be retained as discarded records.
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

By default, the API returns all time entries the caller is authorized to see, including drafts and entries awaiting approval.

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
- The cursor format and exact response fields remain to be specified.

### 15.7.5 Default ordering

**Confirmed decision:**

Time entries are ordered newest first by default, based on when the work occurred.

- Timestamp-based entries are ordered using their work timestamps.
- Duration-only entries are ordered using their work dates.
- A deterministic tie-breaker, such as entry ID, will be used to make ordering predictable for cursor-based pagination.

**Open detail:** The exact ordering semantics when timestamp-based and duration-only entries appear in the same result set remain to be specified.

### 15.7.6 Cursor and query consistency

**Confirmed decision:**

A cursor is tied to the original query context, including its filters and sort order.

- The client must retain the same filters and sort order when requesting subsequent pages.
- Changing a filter or sort order requires a new query without the previous cursor.
- The API should reject a cursor used with an incompatible query rather than silently applying unexpected pagination behavior.

The cursor's encoding, integrity protection, expiration, and query-context validation remain contract-design details.

### 15.7.7 Results changing during pagination

**Open question — Not yet decided.**

Two approaches were discussed:

- **Live results:** Each page reflects data available when that page is requested. The server attempts to minimize duplicates and omissions but does not guarantee a frozen snapshot.
- **Snapshot results:** The initial request establishes a consistent snapshot used for all subsequent pages.

The recommendation was to use live results for the MVP, but the user has not yet accepted or rejected it. This must remain an open question.

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

1. **Lifecycle status**, such as draft or submitted.
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

### 15.8.9 Unauthorized filter values

**Confirmed decision:**

When a caller requests entries outside their authorization scope, the API returns a consistent, generic authorization error without disclosing protected information.

A valid but unauthorized volunteer ID must not reveal whether that volunteer or their entries exist outside the caller's permissions.

This behavior is distinct from a valid, authorized query that returns no matching entries.

The exact HTTP status code, error code, and response body remain to be specified.

---

## 15.9 Retrieval features deferred from MVP

### 15.9.1 Filtering by editor

**Confirmed decision — Deferred, with future consideration.**

The MVP will not support filtering time-entry lists by the person who last modified an entry, such as an `updatedBy` filter.

Audit history must still record changes and the actor responsible, according to the audit-history design. Deferring the filter does not mean deferring change tracking.

### 15.9.2 Filtering by time spent in a state

**Confirmed decision — Deferred, with future consideration.**

The MVP will not provide dedicated state-age filters such as:

- Drafts older than 30 days.
- Entries pending approval for more than 7 days.

The existing status, work-date, and submission-time filters remain available.

Future versions may introduce state-age filters if organizations need stale-draft reminders, approval-backlog reporting, or similar workflows.

---

## 15.10 Summary of newly established retrieval requirements

The following example is illustrative, not a finalized endpoint or parameter contract.

A request conceptually equivalent to:

```text
GET /time-entries
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
- **TimeEntry lifecycle:** Draft and submission workflow must be represented separately from approval and conflict state.
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
3. Decide what happens to pending entries when organizational approval settings change.
4. Define approval authority, including the boundaries of coordinator authority for project-less entries and other entries outside their projects.
5. Define the handling and reporting of invalid, out-of-period, or conflicting submissions that must be preserved rather than silently discarded.
6. Decide how edits made concurrently by multiple authorized users are detected and reconciled.

### Priority 2 — Retrieval and pagination

7. Decide whether pagination uses live results or a consistent snapshot. The live-results approach is recommended but not yet accepted.
8. Define the stable ordering of mixed timestamp-based and duration-only entries.
9. Specify cursor structure, validation, expiration, and response fields.
10. Define the exact validation and authorization error codes, HTTP status codes, and error envelope.

### Priority 3 — Project lifecycle and permissions

11. Decide who may archive projects and activities. The earlier recommendation that coordinators may archive their own projects while administrators retain organization-wide authority remains unaccepted.
12. Decide how archival affects active assignments, pending requests, and historical time entry.
13. Decide whether archived projects or activities can be restored.
14. Confirm whether coordinators may resolve conflicts for volunteers assigned to their projects and how project-less entries are treated.
15. Finalize whether volunteer and coordinator assignments use a generalized resource or separate resources.
16. Define the consequences of assignment departure for pending time entries and requests, beyond the established historical-work eligibility rule.
17. Finalize timestamp and timezone semantics for assignment boundaries.
18. Decide the membership-revocation rules and whether revoked memberships may be restored.

### Priority 4 — Entry deletion and operational details

19. Decide whether drafts may be permanently deleted or must be retained as discarded records.
20. Define whether submitted entries may be voided and the associated permissions, audit requirements, and effect on reported hours.
21. Finalize overlap warning and review behavior.
22. Decide whether project-less activity descriptions are stored separately from optional notes.
23. Finalize required and optional profile fields and email-change verification behavior.
24. Decide the effects of policy changes on pending assignment requests and other pending operations.
25. Define notification retention and whether administrators can manage other users' notifications.

### Priority 5 — API contract and implementation

26. Choose the authentication method/provider and determine whether authentication is managed or self-hosted.
27. Design the first-administrator bootstrap process.
28. Finalize database schema, constraints, and transaction requirements.
29. Define endpoint paths, HTTP methods, request/response DTOs, validation rules, and error codes.
30. Design offline synchronization operations, change tracking, retry/idempotency behavior, and conflict responses.
31. Define API versioning, security controls, deployment, backups, and monitoring.

Items may be combined or deferred where appropriate. The list is a planning aid, not a requirement to settle every item before drafting any part of the API contract.

---

## 15.13 Recommended next step

Continue resolving the remaining lifecycle and permission questions one at a time. The immediate outstanding question from the most recent discussion is whether paginated retrieval should use live results or a consistent snapshot.

Once the core lifecycle, authorization, and conflict-handling rules are sufficiently clear, begin drafting the API contract rather than attempting to resolve every implementation detail in advance.

The contract should explicitly identify which behaviors are finalized, which are implementation choices, and which remain deferred.