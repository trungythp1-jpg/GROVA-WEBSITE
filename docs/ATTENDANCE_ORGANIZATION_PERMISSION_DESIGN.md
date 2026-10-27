# GROVA ATTENDANCE — Organization and Task Permission Design

## Status

Approved design baseline for implementation planning. This document does not deploy Firestore Rules, write Firebase data, or change the production application. The implementation must be reviewed separately before merge or deployment.

## 1. Organization scope

One company, with these fixed initial departments:

| Department ID | Display name | Sort order |
| --- | --- | ---: |
| `marketing` | Marketing | 1 |
| `sales` | Kinh doanh | 2 |
| `technical` | Kỹ thuật | 3 |
| `finance_accounting` | Tài chính – Kế toán | 4 |
| `administration_hr` | Hành chính – Nhân sự | 5 |
| `legal` | Pháp chế | 6 |
| `procurement_supply` | Mua hàng – Cung ứng | 7 |

Department IDs are stable machine identifiers. Display names are labels and may be changed by Admin without changing IDs. Employee-facing forms must select from this catalog; free-text department input must not be used for authorization.

## 2. Existing role hierarchy

Keep the six existing role values:

| Level | Role | Default scope |
| ---: | --- | --- |
| 1 | `employee` | Own profile and assigned tasks |
| 2 | `team_lead` | Assigned team, when team structure exists |
| 3 | `manager` | Own managed department |
| 4 | `department_head` | Explicitly assigned department scope |
| 5 | `executive_director` | Explicitly assigned management scope |
| 6 | `admin` | Whole company; may grant and revoke delegation |

A higher role level alone does not grant cross-department task assignment or unrestricted access to another department's HR or attendance data.

## 3. Firestore schema proposal

### `attendance_users/{uid}`

Retain existing fields used by the current application and add:

- `departmentId: string` — required for new or migrated active profiles.
- `teamId: string | null` — optional until teams are introduced.
- `managerUid: string | null` — direct manager reference; informational and not sufficient by itself to grant authorization.
- `active: boolean` — existing account activation flag.
- `role: string` — existing six role values.

Existing `department` should remain readable during a compatibility period. Do not remove it or mass-rewrite profiles until every reader/writer and existing document has been audited. A migration must map known legacy labels to department IDs and place ambiguous/unrecognized values in an explicit exception report for Admin review.

### `attendance_departments/{departmentId}`

Fields:

- `name: string`
- `active: boolean`
- `sortOrder: number`

The seven IDs in Section 1 are seeded by a separately reviewed migration. Only Admin may maintain this catalog. Inactive departments cannot be selected for new assignments; historical references remain intact.

### `attendance_delegations/{delegationId}`

Fields:

- `granteeUid: string`
- `sourceDepartmentIds: string[]`
- `targetDepartmentIds: string[]`
- `permissions: string[]` — initially allow only `task_assign`
- `grantedByUid: string`
- `active: boolean`
- `validFrom: timestamp`
- `validUntil: timestamp | null`
- `reason: string`
- `createdAt: timestamp`
- `updatedAt: timestamp`

Only Admin can create, update, or revoke delegations. A grantee cannot grant or extend their own permissions. Authorization must check current time, active status, source department, target department, action, and the grantee's active profile. Cross-department task delegation does not imply permission to read attendance records, employee profiles, or unrelated tasks.

### `workspace_tasks/{taskId}`

Preserve existing fields and add for new tasks:

- `sourceDepartmentId: string`
- `targetDepartmentId: string`
- `delegationId: string | null` — reference to the delegation used for cross-department assignments, when applicable.

Keep existing task fields such as `createdBy`, `assigneeUid`, `status`, `priority`, `dueDate`, `createdAt`, and `updatedAt`. Do not require new fields on legacy tasks immediately; define a compatibility path in Rules and application queries before rollout. For old tasks, do not infer missing department history from current profiles.

### Audit trail

Before creating a separate audit collection, inspect existing audit/log patterns in the repository and Firebase project. If implemented, record delegation grant, update, revoke, actor UID, target UID, affected departments, timestamp, and reason. Do not log credentials or sensitive authentication data.

## 4. Task assignment authorization

A task assignment is allowed only when all relevant checks pass:

1. The actor is signed in and has an active `attendance_users` profile.
2. The assignee profile exists, is active, and is not the actor.
3. The actor's role is allowed to assign tasks.
4. The actor's role level is higher than the assignee's level, unless a separately approved business policy changes this rule.
5. For same-department assignment, the actor has management scope over the target employee or team. Department membership alone is not sufficient for a team lead to assign tasks outside their team.
6. For cross-department assignment, the actor is Admin or has a current Admin-granted delegation whose source department, target department, and `task_assign` permission match the operation. Executive rank alone is not sufficient.
7. The client cannot choose or spoof the actor UID, source department, target department, role, delegation ID, or authorization scope to bypass server-side validation.

The UI may filter selectable employees for usability, but Firestore Security Rules must independently enforce authorization. Rules must not trust department or role values supplied only in the incoming task document; they must read the actor and assignee profiles and validate delegation data.

## 5. Permission matrix

| Role | View assigned tasks | Assign within scope | Cross-department assignment | Grant/revoke delegation |
| --- | --- | --- | --- | --- |
| Employee | Yes | No | No | No |
| Team lead | Yes | Managed team only | Only with valid delegation | No |
| Manager | Yes | Managed department | Only with valid delegation | No |
| Department head | Yes | Explicit managed scope | Only with valid delegation or explicit managed scope | No by default |
| Executive director | Yes | Explicit executive scope | Only with valid delegation or explicit managed scope | No by default |
| Admin | Company-wide task administration, subject to task policy | Yes | Yes | Yes |

Assignment permission and data-reading permission must be separate. A role that can assign a task does not automatically gain access to all attendance records or HR profiles in the destination department.

## 6. Read/update boundaries

- Employees can read their own profile and assigned tasks as permitted by current rules.
- Task creators can read tasks they created, subject to approved visibility policy.
- Assignees can update only the task fields permitted for assignees, such as status and update timestamp.
- Editing title, assignee, department scope, or delegation metadata requires a separate explicit authorization rule.
- Managers' attendance and adjustment-request access must be reviewed independently; do not broaden it merely because task assignment scopes are added.
- Admin-only employee management remains Admin-only unless a later approved policy explicitly grants narrower HR permissions.

## 7. Migration and rollout

1. Audit all reads/writes of `attendance_users.department` and every task query before changing the schema.
2. Produce a read-only report of existing department labels and counts; do not write or normalize live data during the audit.
3. Map only unambiguous legacy labels to the seven stable IDs. Keep unresolved rows in an exception list for manual Admin review.
4. Add backward-compatible reads first; do not require `departmentId` for legacy records until migration completion has been verified.
5. Prepare a new Rules candidate and emulator/test plan. Do not replace the active Firebase Rules until the candidate passes tests and receives approval.
6. Roll out catalog and profile migration before enabling cross-department authorization.
7. Enable delegation writes only after Admin-only Rules and revocation/expiry tests pass.
8. Monitor permission-denied events and retain a rollback path. Do not delete old fields or legacy tasks during rollout.

## 8. Required tests before deployment

- Same department: authorized manager assigns to a lower-level active employee.
- Same department: employee cannot assign tasks.
- Cross department: manager without delegation is denied.
- Cross department: delegation with matching source, target, permission, and active time is allowed.
- Cross department: wrong source, wrong target, wrong permission, expired, inactive, or revoked delegation is denied.
- Self-assignment and inactive/missing assignee are denied.
- Non-Admin cannot create, edit, or revoke delegation documents.
- Client-spoofed `createdBy`, `sourceDepartmentId`, `targetDepartmentId`, or `delegationId` cannot bypass Rules.
- Existing tasks without the new fields remain accessible under the approved compatibility policy.
- Attendance record and HR profile access do not expand as a side effect of task delegation.
- Existing clock-in/out, leave requests, adjustment requests, sites, and employee administration continue to pass regression tests.

## 9. Deployment boundaries

This document is a design artifact only. It does not modify live Firebase data, deploy Firestore Rules, or authorize merging application code to `main`. The implementation and Firebase Rules must be proposed in separate reviewable changes.
