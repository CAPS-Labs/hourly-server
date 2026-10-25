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
