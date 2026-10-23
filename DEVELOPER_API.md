# Developer API — easy setup and administration

Public guide and onboarding: **https://ndclients.co.in/brand/developers.html** after deployment.

## Super Admin: kisi developer ko API kaise dein

**Direct creation:** Super Admin → Developer API access → **Create directly**. Developer name, contact email, organization aur purpose enter karein; company, read scopes, expiry aur request limit choose karke **Create access & generate key** click karein. Is route mein public onboarding request zaroori nahi hai. API access record banta hai, staff/Super Admin login account nahi.

**Test preset:** **Fill test account details** se `developer@example.test`, 1 day, 10 requests/minute aur `locations:read` select hota hai. Dummy company select karein; production company ko test ke liye select na karein. Key copy karke `/api/v1/developer/data/locations` call karein; testing ke baad Issued access se revoke karein. Preset khud koi account/key create nahi karta.

**Public onboarding:**

1. Developer ko public guide bhejein. Woh contact, organization, purpose, required resources aur days ke saath onboarding request submit karega.
2. Super Admin login → **Developer API access** → pending application select karein.
3. Developer ki identity aur purpose verify karein. Sahi **company**, minimum required **read scopes**, **1–365 days**, aur **1–600 requests/minute** choose karein.
4. **Approve & generate key** click karein. Secret sirf ek baar screen par dikhega. Approved contact ko secure channel se share karein; application reference API key nahi hai.
5. Issued access mein expiry, scopes, last use aur successful request count dikhenge. **Rotate key** purani key turant invalidate karta hai, expiry same rehti hai. **Revoke access** turant access band karta hai.
6. Renewal, scope/company/limit change ke liye naya onboarding request approve karein aur purana grant revoke karein. Expired/revoked grants rotate nahi hote.

Company suspension, export restriction aur company module disable hone par existing keys bhi block hoti hain. Rejected requests aur issued grants history mein rehte hain. Staff/Admin ko API management access nahi milta.

## Developer: first request

Store the issued secret in a server environment variable, never browser/mobile source or Git:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $NDFA_API_KEY" \
  'https://ndclients.co.in/api/v1/developer/data/customers?page=1&limit=50'
```

Available GET resources and scopes:

| Resource | Scope | Allowed fields |
|---|---|---|
| customers | customers:read | id, name, mobile, branch, status, createdAt |
| listings | listings:read | id, name, mobile, branch, status, createdAt |
| attendance | attendance:read | id, userId, date, checkInTime, checkOutTime, status |
| employees | employees:read | id, name, employeeId, role, branch, isActive |
| locations | locations:read | id, name, code, isActive |

Only records belonging to the approved company are returned. A `companyId` query parameter cannot change that boundary. Missing source fields are omitted. There are no developer write, biometric, file, payroll, recording or GPS route endpoints in this release.

`page`: positive integer, default 1. `limit`: integer 1–100, default 50. Response:

```json
{"success":true,"message":"Company data","data":{"items":[{"id":"C_EXAMPLE","name":"Example"}],"page":1,"limit":50,"total":1}}
```

Pagination is not a snapshot; data may change between calls. Public `GET /api/v1/developer/catalog` lists scopes/fields.

## Onboarding contract

`POST /api/v1/developer/applications`, JSON body:

```json
{"name":"Developer","email":"dev@example.com","organization":"Example","purpose":"Internal reporting","scopes":["customers:read"],"requestedDays":30,"consent":true}
```

Returns HTTP 201, `data: {"id":"APP_…","status":"pending"}` in the standard success envelope. Save the reference. Manual review is required. No secret is issued to an unauthenticated applicant. Limit: five attempts/hour per server-observed IP, including invalid attempts. No automated email or public status lookup is implemented; the administrator contacts the applicant separately.

## Management API (Super Admin website JWT only)

Base: `/api/v1/developer/manage`. `Authorization: Bearer <verified Super Admin JWT>`.

| Method and path | Body / result |
|---|---|
| GET `/` | applications, sanitized grants, companies, scopes |
| POST `/grants` | `{name,email,organization,purpose,companyId,scopes,days,requestsPerMinute}`; direct Super Admin issuance, returns `{grant,token}` once, HTTP 201 |
| POST `/applications/:id/approve` | `{companyId, scopes, days, requestsPerMinute}`; returns `{grant, token}` once, HTTP 201 |
| POST `/applications/:id/reject` | `{}`; rejects a pending application |
| POST `/grants/:id/rotate` | `{}`; returns new `{grant, token}` once, HTTP 201 |
| POST `/grants/:id/revoke` | `{}`; immediately revokes grant |

API secrets cannot authenticate as staff or access these management endpoints. SHA-256 hashes of cryptographically random 256-bit secrets are persisted; plaintext secrets are not stored. Approval, rejection, rotation and revocation write platform audit entries. No secrets are returned by list/history endpoints.

## Errors and operating limits

Error shape: `{"success":false,"message":"…","data":null}`.

| HTTP | Meaning |
|---|---|
| 400 | Invalid fields or pagination |
| 401 | Missing, invalid, expired or revoked key |
| 403 | Missing scope, company suspended or company module disabled |
| 404 | Missing endpoint or pending application/grant |
| 409 | Expired/revoked grant cannot rotate |
| 429 | Limit exceeded; honor `Retry-After` seconds |
| 500 | Unexpected server/persistence failure; bounded retry and operator investigation |

Expiry is an absolute UTC timestamp calculated at approval and checked on each request. Read request counters persist with up to a 30-second delay; abrupt shutdown may lose the most recent counter updates. Rate limits are in memory per API process and reset at restart; run a single process for consistent limits or add a shared rate-limit store before scaling horizontally. The onboarding IP limit intentionally uses Express's current socket IP (proxy deployments may share one bucket).

No automatic sandbox is created. Use an approved test company for development. Super Admin should verify applicants and use a secure delivery channel. HTTPS is required in production.

## Deploy

```bash
cd ~/NDMF && git pull --ff-only origin main && bash deploy/update-production.sh
```

The updater publishes public website assets (including `/brand/developers.html`), builds the staff console and restarts the API. Existing `/brand/` Nginx public alias is used; TLS configuration and environment files remain intact. New JSONB collections initialize automatically; no destructive database reset or seed is needed.

Isolated HTTP regression tests: `cd backend && npm test`. Test data is in a fake PostgreSQL adapter and never connects to production.
