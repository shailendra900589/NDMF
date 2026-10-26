# Team operations update · MyStaff Smart 1.4.0

Deploy with `cd /home/ubuntu/NDMF && git pull --ff-only origin main && bash deploy/update-production.sh`.
Install the newly published Android APK after deploying the backend; old mobile versions do not capture a checkout selfie and will be asked to upgrade/verify before checkout.

## Attendance

Attendance → Attendance timing settings contains company-scoped same-day IST settings. Suggested defaults are 06:00 opening, 09:00 start, 15 minute grace, 12:00 last check-in, 18:00 end. The check-in window is initially disabled to avoid silently blocking existing shifts; an administrator can review, enable and save it. Overnight timing policies are not supported by this editor. Existing open shifts may still be checked out.

Late minutes and early departure are informational, not automatic salary deductions. Existing payroll rules (four paid Sundays, attendance and approved leave) remain unchanged. Raw timestamps remain UTC; attendance displays use IST. Missing checkout stays missing and is labelled “Checkout not recorded”. No invented checkout time is written.

Employees and branch managers must pass a fresh, one-use face check before checkout, including when the optional check-in face policy is disabled. Failed/cancelled selfies never submit checkout. Administrators can still correct attendance with a reason.

## Administrator password recovery

There is deliberately no public password-reset endpoint. On the server, reset one exact existing administrator account without changing any other employee:

```bash
cd /home/ubuntu/NDMF/backend
RESET_LOGIN='administrator-mobile-or-employee-id' RESET_PASSWORD='choose-a-new-strong-password' node src/scripts/reset-admin-password.js
```

The command only updates that exact login when it is an existing company administrator. It refuses to create accounts or reset other demo users.

## Customer re-verification

Customers → Re-verify requires an administrator and a reason. The existing customer and old proofs are retained; a new draft is shown in Customer Listing. Capture a new listing using the same mobile number and branch to submit fresh photos, shop GPS and neighbor verification into that request. It then follows branch and final admin approval. Draft requests cannot be approved without fresh submission. Previous loan history and proofs are retained after approval.

## Notices and visits

Separate Notice & Announcement and Visit schedules permissions are controlled by Super Admin. Admin can publish notices to a company, branch or individual. Read acknowledgement is explicit and timestamped; opening a notice does not acknowledge it automatically. The admin page shows recipient-level pending/acknowledged state.

Admin and branch managers can schedule visits. Branch managers are restricted to their branch. Employees see assigned visits, record completion notes, and managers can cancel with a reason or schedule another visit while retaining history.

The mobile home screen includes notices, visits and released salary slips. Notice polling runs every 60 seconds while the home screen is mounted and on resume; local phone notifications are permission-dependent. This is **not background push delivery**. Closed-app push requires a configured Firebase/FCM project, Android configuration and server credentials, which are not present in this repository.

## Payroll

Manual salary/slip editing remains in Payroll. “Record salary payment” records an already completed payment reference; it does not initiate a bank transfer. “Release salary slip” publishes the slip to that employee's mobile salary inbox. These are separate actions. Either release locks the amounts against edits, deletion and bulk payroll refresh, with actor/time/reference recorded. Released slips retain the existing web print format. Subsequent changes need a documented adjustment in another month.

## Android support and verification

Minimum Android version is 7.0 (API 24), with ARMv7 and ARM64 in the release APK. This does not guarantee every vendor device; verify camera/face, notification permission, GPS, background battery policy and checkout on representative physical phones. Automated HTTP tests use isolated data and deterministic face-inference fixtures, not production biometric data.
