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

## Searchable dropdowns — 23 October 2026

All 14 existing dropdowns across Tracking, Employee Tracking, Attendance, Customers, Customer Listings, Users and Super Admin now share a searchable combobox. Queries match option text and location groups, support multiple words and ignore case/accents. Typing never changes the applied filter until an option is selected. Existing values, numeric stop thresholds, disabled fields/options, location groups and required form validation are preserved.

The popup supports Arrow Up/Down, Home/End, Enter, Escape, Tab, outside dismissal and an explicit toggle. It opens above or below the field as space allows, resizes with the viewport and renders outside scroll-clipped cards/modals. There are selected-state indicators, result counts, no-results messaging and mobile touch-sized options. No additional dependency or backend permission change was needed.

Verification: all four frontend tests and the production build pass. Regression coverage includes committing numeric values, multi-word/group filtering, no-results protection, preserving selection on cancel/reopen, disabled-option keyboard skipping and viewport resize handling. Real browser checks additionally confirmed native required validation, successful form submission, mouse selection, long-list keyboard navigation, toggle behavior and popup boundaries at 390px. Browser fixtures used dummy records only and were removed after verification.
# Smartstaff plus attendance update — 23 October 2026

- Reference photos now use canonical upload paths, including legacy photo objects and expiring signed URLs. Cached face signatures require three to five finite 128-number vectors.
- Enrollment and reset responses wait for PostgreSQL persistence. Repeating the same save is safe; the phone refreshes its cached enrollment only after server confirmation and checks the status again before continuing.
- A reset while recognition is running cannot restore old registration or issue a stale attendance pass. Profile changes during inference are preserved.
- Saved-but-invalid registration is reported separately from missing registration, with a recovery message. Mobile displays the actual face verification error and offers retaking reference photos.
- Invalid/out-of-range check-in and check-out coordinates are rejected. Attendance writes persist before success; duplicate submissions are guarded in the phone UI. India business days are used in attendance reports; UTC timestamps are displayed in the phone's local timezone. Active shifts up to 20 hours can be checked out across midnight.
- Website, console, mobile app labels/icons, developer guide, and default company branding use Smartstaff plus. Existing original-tenant payslips are migrated; unrelated companies and installed Android package identities remain compatible.
- HTTP tests use an isolated database adapter and deterministic face inference. Physical camera/lighting/recognition accuracy still needs an installed-phone smoke test after deployment; automated tests do not establish real-world biometric accuracy.

## Smartstaff plus visual upgrade — 23 October 2026

The public homepage now presents attendance, field routes, customer workflows, calls, people and developer access, with an interactive perspective product preview. Preview records are explicitly illustrative. The console uses a shared responsive visual system, SVG dashboard metrics and a redesigned welcome area. Public pages, login and all console roles share a persistent light/dark preference. Reduced-motion preferences disable decorative animation; pay slips retain a white print palette.

Local browser verification used isolated fictional records: dashboard in both themes, Super Admin, tracking, attendance, mobile navigation, public preview tabs and developer guide. Homepage widths of 320, 390 and 1440 pixels and mobile developer guide were checked for horizontal overflow. No production users or biometric records were changed.

Deployment now publishes the public homepage atomically and patches the active Nginx homepage/developer guide HTML routes with no-store headers while retaining API, TLS and upload configuration. The homepage release marker is `smartstaff-ui-20261023`. These changes require running the production updater; local screenshots do not confirm a live deployment.
