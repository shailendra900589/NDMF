# Super Admin and companies

Sign in through the existing `/login` page with `ajitndfa@ndclients.co.in` and the initial password supplied for this account. The application redirects this role to `/super-admin`. The password is stored as a bcrypt hash; its plaintext is not in the application. Password changes in My Profile survive restarts.

## Company workflow

1. Select **Add company** and provide a unique company code and the first administrator's email/password.
2. Configure **Pages & functions** to choose the modules and supported operations available to that entire company.
3. Open **People** to create administrators/managers/employees, restrict individual access, reset passwords, or disable accounts. Managers/employees require an existing company location; the company administrator creates locations in their console.
4. Use **Company settings** to rename, update the contact email, or suspend/reactivate the company. Suspension immediately blocks its existing tokens as well as new sign-ins.
5. Review recent platform changes in **Activity**.

Company policy is the maximum entitlement. Individual access restrictions apply underneath it, and existing role/branch rules continue to apply. Company administrators cannot override the Super Admin's entitlements. Page/function policies are only editable in the Super Admin console. Profile access remains available when all operational pages are disabled.

## Upgrade on AWS

Use the existing database backup procedure before the first upgrade. From the existing deployment:

```bash
cd ~/NDMF &&
git pull --ff-only origin main &&
bash deploy/update-production.sh
```

At backend startup an idempotent migration creates the Nirmaldhara company (`CO_NDFA`), assigns existing business records/users to it, migrates attendance settings, and provisions the reserved Super Admin once. No existing employee password is changed. **Do not run `npm run seed` during an upgrade**; it is for an empty development database and now refuses an existing database.

Ensure Nginx proxies `/uploads/` to the backend, as in the supplied deployment configurations. Photos/documents now use signed links from API responses, valid for 24 hours; reload their source page to refresh an expired link. Unsigned direct file requests are denied. Company suspension or module revocation also invalidates the corresponding file access. Recording streaming checks authentication and company ownership.

Demo OTP authentication is off unless `ENABLE_DEMO_OTP=true` is explicitly set for a demo environment. It can never sign in a Super Admin. Password sign-in is throttled after repeated attempts. Continue to use a private `JWT_SECRET` in the server environment.

The field app continues to use the same login API and effective module permissions. Super Admin is a website-only account; the updated mobile client explicitly rejects that role. Backend restrictions apply to all clients, including older installed apps. Browser controls refresh on focus and at one-minute intervals; API restrictions apply on every request.

## Verification

```bash
cd backend && npm test
cd ../admin-frontend && npm run build
```

The HTTP tests use an isolated PostgreSQL adapter and never connect to production. They cover existing-data migration, bootstrap idempotency, email sign-in, tenant reads/writes and concurrent requests, company/user entitlements, privilege escalation attempts, private documents, company-specific settings, suspension/reactivation and the OTP restriction. This does not replace a deployment smoke test against the production PostgreSQL service.
