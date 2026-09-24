# NDFA API Reference

**Base URL (production):** `https://ndclients.co.in/api/v1`  
**Local:** `http://localhost:3000/api/v1` (port from `backend` env)

All JSON responses use the same envelope:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { }
}
```

Errors:

```json
{
  "success": false,
  "message": "Reason",
  "data": null
}
```

## Authentication

Send JWT on protected routes:

```http
Authorization: Bearer <token>
```

Token is returned from `POST /auth/login` and expires in **7 days**.

---

### `POST /auth/login`

**Request**

```json
{
  "loginId": "9000000001",
  "password": "ndfa1234"
}
```

`loginId` may also be sent as `mobile` or `employeeId` (same value).

**Response `200`**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": "U_abc123",
    "name": "Admin User",
    "mobile": "9000000001",
    "employeeId": "ADM001",
    "role": "admin",
    "branch": "Delhi Main Branch",
    "permissions": {
      "dashboard": true,
      "users": true,
      "payslips": true,
      "customers": true
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Response `401`:** Invalid Login ID or password.

---

### `GET /auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response `200`:** Same user object as login (without re-issuing token unless you login again).

---

### `PUT /auth/change-password`

**Request**

```json
{
  "oldPassword": "ndfa1234",
  "newPassword": "newSecret1"
}
```

---

### `POST /auth/logout`

No body. Clears server-side session metadata if used; client should delete stored token.

---

## Health

### `GET /health`

**Response**

```json
{
  "success": true,
  "message": "NDFA API is running",
  "data": {
    "version": "2.2.0",
    "modules": "rbac,branches,users,listing,calls,attendance,tracking,payslips"
  }
}
```

---

## Dashboard

### `GET /dashboard`

**Auth:** required  
**Response `data`:** KPIs and summaries for the logged-in user (role-scoped).

---

## Branches

### `GET /branches`

**Auth:** required  
**Response `data`:** array of `{ id, name, code?, address?, ... }`

---

## Users (team / employees)

### `GET /users/permission-schema`

**Auth:** required  

**Response `data`**

```json
{
  "canCreateRoles": ["fieldOfficer", "branchManager", "admin"],
  "keys": ["dashboard", "users", "payslips", "customers", "..."]
}
```

`canCreateRoles` depends on the caller’s role (admin sees all creatable roles).

### `GET /users`

**Permission:** `users`  
Lists employees visible to the caller.

### `POST /users`

**Roles:** `admin` or `branchManager` with `users` permission  

**Request**

```json
{
  "name": "Amit Patel",
  "mobile": "9876543210",
  "employeeId": "FO002",
  "role": "fieldOfficer",
  "branch": "Delhi Main Branch",
  "password": "initial123"
}
```

**Response `201`:** created user (no password field).

---

## Customers

### `GET /customers`

Query: `search`, pagination as implemented in controller.

### `GET /customers/:id`

Single customer record.

---

## Customer listings (field visits — separate from Customers)

### `GET /customer-listings`

List listings (filters by role/branch). Query: `search`, `status`.

### `POST /customer-listings`

Submit new listing (photos via `/uploads/single` first).

### `GET /customer-listings/:id`

### `GET /customer-listings/approval`

Pending approvals (managers).

### `POST /customer-listings/approve`

**Request:** `{ "id": "...", "action": "approve" | "reject" }`

### `POST /customer-listings/:id/assign`

Assign listing to a field officer.

---

## Call logs

### `GET /call-logs`

Recent calls for the user or branch (role-scoped).

### `POST /call-logs`

**Request (example)**

```json
{
  "mobile": "9026554516",
  "customerName": "Contact 9026554516",
  "direction": "outbound",
  "durationSeconds": 120,
  "recordingUrl": "/uploads/...",
  "recordingDurationSeconds": 120,
  "startedAt": "2026-09-24T10:00:00.000Z"
}
```

Non-registered numbers are allowed. Voice uploads support files up to **100 MB** (~15 min AAC). Non-registered numbers may use `customerName` as a display label.

---

## Attendance

### `GET /attendance/today`

### `POST /attendance/check-in`

### `POST /attendance/check-out`

---

## Tracking

### `GET /tracking/today`

**Response `data`:** `{ totalKm, routePoints: [...] }`

### `POST /tracking/sync`

Batch GPS points from mobile.

---

## Uploads

### `POST /uploads`

Multipart file upload; returns URL/path used in listings and call recordings.

---

## Media

### `GET /media/...`

Stream or proxy media assets (recordings).

---

## Pay slips (admin only)

**Auth:** `admin` role + `payslips` permission.

### `GET /payslips`

Query: `search`, `employeeNo`, `month` (`YYYY-MM`).

**Response `data`:** array of slips, newest month first.

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "PS_1727180000_abc12",
      "companyName": "Nirmaldhara Micro Foundation",
      "employeeName": "Raj Kumar",
      "employeeNo": "EMP001",
      "designation": "Field Officer",
      "department": "Operations",
      "bankName": "SBI",
      "accountNo": "1234567890",
      "month": "2026-09",
      "earnings": {
        "basic": 15000,
        "hra": 5000,
        "conveyance": 2000,
        "medical": 1500,
        "special": 1000
      },
      "deductions": {
        "epf": 1800,
        "healthInsurance": 500,
        "professionalTax": 200,
        "tds": 0
      },
      "grossSalary": 24500,
      "totalDeductions": 2500,
      "netPay": 22000,
      "createdAt": "2026-09-01T08:00:00.000Z",
      "updatedAt": "2026-09-01T08:00:00.000Z"
    }
  ]
}
```

### `GET /payslips/:id`

Single slip.

### `POST /payslips`

**Request**

```json
{
  "employeeName": "Raj Kumar",
  "employeeNo": "EMP001",
  "department": "Operations",
  "designation": "Field Officer",
  "bankName": "SBI",
  "accountNo": "1234567890",
  "month": "2026-09",
  "earnings": {
    "basic": 15000,
    "hra": 5000,
    "conveyance": 2000,
    "medical": 1500,
    "special": 1000
  },
  "deductions": {
    "epf": 1800,
    "healthInsurance": 500,
    "professionalTax": 200,
    "tds": 0
  }
}
```

Server computes `grossSalary`, `totalDeductions`, `netPay`.  
**409** if slip already exists for same `employeeNo` + `month`.

### `PUT /payslips/:id`

Same body fields as create (partial merge with existing).

### `POST /payslips/:id/add-month`

Copy employee to next month (or body `{ "month": "2026-10", "copyAmounts": true }`).

### `POST /payslips/bulk`

Multi-month upsert for one employee (web PDF flow).

**Request**

```json
{
  "employeeName": "Raj Kumar",
  "employeeNo": "EMP001",
  "designation": "Field Officer",
  "department": "Operations",
  "bankName": "SBI",
  "accountNo": "1234567890",
  "months": [
    {
      "month": "2026-07",
      "earnings": { "basic": 15000, "hra": 5000, "conveyance": 2000, "medical": 1500, "special": 1000 },
      "deductions": { "epf": 1800, "healthInsurance": 500, "professionalTax": 200, "tds": 0 }
    },
    {
      "month": "2026-08",
      "earnings": { "basic": 15000, "hra": 5000, "conveyance": 2000, "medical": 1500, "special": 1000 },
      "deductions": { "epf": 1800, "healthInsurance": 500, "professionalTax": 200, "tds": 0 }
    }
  ]
}
```

### `DELETE /payslips/:id`

**Response:** `data: null`, message confirms delete.

---

## Roles & permissions (summary)

| Role            | Typical access                                      |
|-----------------|-----------------------------------------------------|
| `admin`         | All modules including pay slips, all branches       |
| `branchManager` | Branch users, customers, calls; not always payslips  |
| `fieldOfficer`  | Dialer, customers, attendance, tracking           |

Permission keys are on the user object (`permissions` map). Middleware checks `requirePermission('key')` on routes.

---

## HTTP status codes

| Code | Meaning                          |
|------|----------------------------------|
| 200  | OK                               |
| 201  | Created                          |
| 400  | Validation / bad request         |
| 401  | Missing or invalid token         |
| 403  | Forbidden (role/permission)      |
| 404  | Not found                        |
| 409  | Conflict (duplicate payslip etc.)|
| 500  | Server error                     |

---

## Mobile app alignment

- **Login:** `loginId` + `password` only.  
- **Dialer:** any 10-digit number; call log uses `Contact {number}` when not in customer master.  
- **Create employee:** `GET /branches` + `GET /users/permission-schema` then `POST /users`.  
- **Pay slips (admin):** CRUD via `/payslips`; multi-month PDF on web admin.
