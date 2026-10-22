# Company panel verification — 22 October 2026

Automated verification uses a temporary in-memory PostgreSQL adapter with the real Express HTTP routes. It creates a company, administrator, two locations, a manager, employees and a disabled account. The adapter is cleared after the suite; temporary document files are removed. Production records are not used or modified.

| Area | Verified |
| --- | --- |
| Company onboarding | Company creation, administrator email login, duplicate login rejection |
| Admin panels | Dashboard, listings, customers, attendance history/monthly reports, tracking/live/history/people, call logs, users/schema, locations, pay slips return successful authenticated responses |
| Manager and Employee panels | Their enabled read APIs succeed; restricted company administration, pay slips and platform access are denied |
| Scope | Company isolation, concurrent tenant requests, manager branch visibility, personal employee call totals, company-wide admin totals |
| Listing workflow | Submit, branch approval, admin rework, resubmit, final approval, customer creation, immutable final state on offline retries |
| Account management | Invalid locations rejected, failed updates leave the user unchanged, invalid reset password rejected, disabled login/session rejected |
| Super Admin policies | Live module/action revocation, individual restrictions, company suspension/reactivation, reserved platform role protection |
| Documents and payroll | Signed document access, company ownership, revoked document access, payroll create/update policies and company name |
| React regression checks | Verified session redirects, shared role refresh, disabled-account sign-out, dashboard tracking restrictions, dashboard failure/retry |
| Live read-only checks | Health endpoint responds successfully; Super Admin HTML returns HTTP 200 with `Cache-Control: no-cache, no-store, must-revalidate` |

Fixes include branch checks for call-log updates and listing submission, review-stage validation for rejection/rework, safe listing retries, validated active user locations, account status handling, atomic validation of employee edits, personal employee dashboard activity, permission-aware dashboard maps and a dashboard retry state. New companies receive location setup guidance in Users.

Validation passed: backend suite (13 tests including the expanded role-panel scenario), frontend suite (3 tests), deployment configuration suite (3 tests), and production frontend build. The build was run with a reduced Node heap/worker count because this workstation was short of virtual memory; no application build settings were changed.

Verification now includes an authenticated local browser walkthrough using temporary company records, alongside HTTP and React component tests. Production account changes, physical GPS/face capture, phone recording capture and a real PostgreSQL persistence/restart smoke test remain outside this run. The new code requires deployment before these changes affect production.

```bash
cd ~/NDMF &&
git pull --ff-only origin main &&
bash deploy/update-production.sh
```

## Admin workspace upgrade

- Dashboard: company overview, permission-aware shortcuts and manual refresh.
- Shared shell: navigation grouped by workflow, current page title, consistent cards/tables/spacing and a mobile navigation drawer.
- Tracking: employee dropdown includes off-duty staff, inline profile/contact details, date selection, retained duty history, date-wise shift table, distance, stops, replay and route timeline. The default retention remains 90 days; existing server retention settings continue to apply. Rapid employee/date changes discard stale responses.
- Attendance: selected employee's registered reference photos, registration status/date, loading/error/empty states and an accessible native image-preview dialog.
- Photo access: an authenticated attendance endpoint returns signed local-upload links without face descriptors or verification secrets. Administrators can view company employees; managers can view their branch employees; staff can view themselves. Cross-company and unauthorized branch requests are rejected. Attendance entitlement is required.

Browser checks passed for the dashboard, tracking employee selection (including an off-duty user), attendance photo loading and enlarge/close, customer listings, customers, call logs, users, locations and pay slips. Mobile tracking was checked at 390px, including drawer navigation and document overflow. Preview images use fictional staff and a synthetic registration reference, never production face photos. Temporary preview data and image files are removed when the preview server is stopped.
