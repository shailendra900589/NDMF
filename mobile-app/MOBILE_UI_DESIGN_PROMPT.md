# Nirmaldhara Field App — Ek hi UI design prompt (copy-paste)

Neeche poora block copy karo aur apne UI/AI design tool (Figma AI, v0, Stitch, etc.) me paste karo. Ye **production API** ke saath match karta hai: `https://ndclients.co.in/api/v1`

---

## COPY FROM HERE ↓

**Project:** Nirmaldhara Micro Foundation (NDFA) — **Android field staff mobile app** (Flutter/GetX already wired to API). Redesign all screens with a **modern, trustworthy fintech/MFI** look: teal primary `#00897B`, orange accent `#FF9800`, light gray background `#F5F7FA`, white cards, rounded 12–16px, clear hierarchy, large touch targets (min 48dp), Hindi-friendly labels optional secondary line in English.

**Users & RBAC:** Login returns `role` (`fieldOfficer`, `branchManager`, `admin`) and `permissions` map (boolean keys). Home **Quick Actions** only show tiles where permission is `true`. Profile is **app bar avatar only** (not a Quick Action tile).

| Permission key | Quick Action / feature |
|----------------|------------------------|
| `payslips` | Pay Slips (admin) |
| `callLogs` | Dialer + Call History |
| `customerListings` | Customer applications (list + new + approvals) |
| `customers` | Customers list + detail |
| `attendance` | Attendance + face verify at check-in |
| `tracking` | GPS tracking + map |
| `users` | Team & Users (list + create) |
| `dashboard` | Optional KPI tab on home (if enabled) |

---

### Global navigation & auth flow

1. **Splash** → check token → **Login** or **App Lock PIN** or **Home**.
2. **Login:** Login ID (10-digit mobile) + password. API: `POST /auth/login`. No role dropdown on device.
3. **Face enrollment (mandatory once):** If role is Field Officer or Branch Manager and `faceEnrollmentComplete` is false → full-screen **3 selfie captures** (front camera). API: `GET/PUT /users/me/face-enrollment` with 3 uploaded image URLs via `POST /uploads`. Then App Lock or Home.
4. **App Lock:** 4–6 digit PIN after login (local only).
5. **Home:** Bottom or top tabs: **Dashboard** (optional KPIs from `GET /dashboard`) + **Quick Actions** grid. App bar: **Dialer** shortcut (if `callLogs`), **Profile**.
6. **Profile:** photo, name, role, employee ID, branch, mobile; menus: Change Password (`PUT /auth/change-password`), Face enrollment (FO/BM), Device Info, App Lock setup, Screenshot protection toggle, Logout (`POST /auth/logout` + clear token).

**API auth:** All protected calls: `Authorization: Bearer <token>`. Standard JSON: `{ success, message, data }`.

---

### Module 1 — Pay Slips (admin)

- **List:** `GET /payslips` — employee name, month, net pay; search/filter by month.
- **Create/Edit form:** `POST /payslips`, `PUT /payslips/:id` — company, employee, earnings/deductions breakdown, net pay.
- **UI:** PDF-style preview card; FAB “Add slip”; admin-only.

---

### Module 2 — Dialer

- Keypad, any **10-digit Indian mobile** (customer register optional).
- On call end: sync `POST /call-logs` with duration, direction, optional `recordingUrl` from voice upload (up to ~15 min, 100MB). Uses native telephony + background recording.
- **UI:** Large dial pad, recent number chip, call button, in-call timer, recording indicator.

---

### Module 3 — Customer applications (NOT the same as Customers master)

**Concept:** Field submits **new shop/customer application**; approval chain depends on who submits:

| Submitter | After submit | Approvers |
|-----------|--------------|-----------|
| Field Officer | `branchPending` | Branch Manager → Admin |
| Branch Manager | `adminPending` | Admin only |
| Admin | `listed` immediately | — (auto creates customer) |

**Screens:**

1. **Hub:** Tabs — **All** (`GET /customer-listings`) and **Pending approval** (`GET /customer-listings/approval`) for Branch Manager & Admin. Status chips: Branch / Admin / Listed / Rejected. FAB **New**.
2. **New application form:** name, mobile, Aadhaar, PAN, shop address, **Capture shop GPS** (live lat/lng). Admin picks **branch** dropdown (`GET /branches`). Submit `POST /customer-listings`.
3. **Approval row actions:** Approve / Reject → `POST /customer-listings/approve` body `{ id, action: "approve"|"reject"|"rework" }`.

**UI:** Step-style form for new; timeline or stepper showing approval state on list cards.

---

### Module 4 — Customers (master list)

- **List:** `GET /customers?search=` — search bar, tap row.
- **Detail:** `GET /customers/:id` — contact, address, loan/status fields as returned by API.
- **UI:** Separate visual identity from “applications” (use people icon, blue-teal variant).

---

### Module 5 — Attendance

- **Today:** `GET /attendance/today` — check-in/out status, hours.
- **Check-in flow (FO/BM):** (1) Open front camera → `POST /attendance/verify-face` multipart (not stored on server) → (2) GPS → `POST /attendance/check-in` `{ lat, lng, faceVerified: true }`. Block check-in if face enrollment incomplete.
- **Check-out:** `POST /attendance/check-out` with location.
- **History:** `GET /attendance/history` if shown.
- **UI:** Big “Check in” / “Check out” buttons, face scan overlay, map snippet, success/error states. **Do not** design storage of attendance selfies.

---

### Module 6 — GPS tracking

- **Start/stop tracking** session; while on: every ~30s `POST /tracking/live-ping` `{ lat, lng }` — server returns `totalKm` today (no full trail stored).
- Optional bulk: `POST /tracking/sync` with route points; today summary `GET /tracking/today`.
- **Map screen:** show current position + today km; link from tracking screen.
- **UI:** Toggle “On duty tracking”, battery-friendly note, distance today prominently.

---

### Module 7 — Call history

- `GET /call-logs` — list with customer name/number, duration, play recording if `recordingUrl` (`GET /media/...`).
- **UI:** Chronological list, filter outbound/inbound, audio player bar.

---

### Module 8 — Team & users

- **List:** `GET /users` (permission `users`).
- **Create:** `POST /users` — name, mobile, employeeId, **role** dropdown (`GET /users/permission-schema` → `canCreateRoles`), **branch** (`GET /branches`), initial password.
- Roles: Field Officer, Branch Manager, Admin (per schema).
- **UI:** HR-style cards; create form with validation hints.

---

### Module 9 — Face enrollment (standalone)

- 3 reference selfies, progress `count/3`, retake per slot.
- **UI:** Circular face guide overlay, good lighting tips, progress dots.

---

### Error & empty states

- No permissions: centered message “No modules assigned — contact admin.”
- Network error: snackbar + retry on lists.
- 401: redirect to login.

---

### Deliverables I need from you

1. **Design system** — colors, type scale, buttons, inputs, chips for listing status.
2. **Screen mockups** for every module above (mobile 360×800 baseline).
3. **User flows** diagram: Login → Face → Home → each Quick Action.
4. **Component library** — app bar, quick action tile, list card, approval actions, dial pad, attendance face modal.
5. Keep **Profile** and **Dialer** in app bar on home; **no** Profile or full “Customer Listing” tile on Quick Actions grid (applications tile only).

**Brand:** Nirmaldhara Micro Foundation — professional, rural-friendly, clear icons, not cluttered.

## COPY UNTIL HERE ↑

---

## App routes (developer reference)

| Route | Screen |
|-------|--------|
| `/` | Splash |
| `/login` | Login |
| `/app-lock` | PIN |
| `/home` | Dashboard + Quick Actions |
| `/face-enrollment` | 3-face setup |
| `/customer-application` | Applications hub |
| `/customer-application/new` | New application form |
| `/customers` | Customers list |
| `/customers/detail` | Customer detail |
| `/dialer` | Dialer |
| `/call-history` | Call logs |
| `/attendance` | Attendance |
| `/tracking` | Tracking |
| `/map` | Map |
| `/team` | Team list |
| `/team/create` | Create user |
| `/payslips` | Pay slips list |
| `/payslips/form` | Pay slip form |
| `/profile` | Profile |

Full API: repo file `backend/API.md`.

---

## Implementation (code generated)

| Layer | Path |
|-------|------|
| Design tokens | `lib/app/theme/theme.dart`, `app_tokens.dart`, `app_colors.dart`, `app_theme.dart` |
| UI kit | `lib/app/widgets/ui_kit.dart` |
| Load states | `lib/app/utils/view_load_state.dart` |
| Session 401 | `lib/app/widgets/session_expired_dialog.dart` |

Screens use **CustomAppBar**, **ActionTile**, **MetricCard**, **ListSkeleton**, **EmptyState**, application **wizard** + **approval bottom sheet**.
