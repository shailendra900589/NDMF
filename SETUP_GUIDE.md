# NDFA — Complete Setup Guide (Hindi + English)

> **Nirmaldhara Micro Foundation** — Flutter App + Express Backend + React Admin Panel

## 🔐 Demo login (sab roles — ek hi password)

| Role | Mobile (Login ID) | Password | Kahan |
|------|-------------------|----------|--------|
| **Admin** | `9000000001` | `ndfa1234` | Web http://localhost:5173 |
| **Branch Manager** | `9000000002` | `ndfa1234` | Web http://localhost:5173 |
| **Field Officer** | `9000000003` | `ndfa1234` | Mobile app (OTP demo: `123456`) |

Poori list: **[DEMO_LOGINS.md](DEMO_LOGINS.md)** — login fail ho to `cd backend && npm run seed`

---

## 📁 Project Structure (Poora Project)

```
NDFA/
├── mobile-app/             ← Flutter Mobile App (Android - Field Officer app)
├── backend/                ← Express.js API Server (Node.js)
├── admin-frontend/         ← React Admin Panel (Browser me chalega)
├── SETUP_GUIDE.md          ← Ye file (aap padh rahe ho)
└── README.md               ← Project overview
```

### Kyun alag-alag rakha?

| Folder | Kaam | Kaun use karega |
|--------|------|-----------------|
| `mobile-app/` | Android mobile app | Field Officer, Branch Manager (phone par) |
| `backend/` | API server + database | Dono connect honge isse |
| `admin-frontend/` | Web admin panel | Admin, Branch Manager (office me browser) |

---

## 🚀 STEP 1: Backend Start Karna

### 1.1 Terminal kholo aur backend folder me jao

```bash
cd D:\Laravel\NDFA\backend
```

### 1.2 Environment file banao

```bash
copy .env.example .env
```

**File:** `backend/.env`
```
PORT=5000
JWT_SECRET=apna_secret_key_yahan_likho
FRONTEND_URL=http://localhost:5173
```

> **Kyun?** `.env` me secret keys aur port number hota hai. Git me push nahi karte.

### 1.3 Dependencies install karo

```bash
npm install
```

### 1.4 Demo data seed karo (pehli baar)

```bash
npm run seed
```

> **Kya hota hai?** `backend/data/db.json` me demo users + sample collections create hote hain.
> Aap is file ko Notepad se khol kar manually data dekh/s edit kar sakte ho!

### 1.5 Server start karo

```bash
npm run dev
```

✅ Server chal gaya: **http://localhost:5000/api/v1/health**

---

## 🖥️ STEP 2: React Admin Panel Start Karna

### Naya terminal kholo:

```bash
cd D:\Laravel\NDFA\admin-frontend
npm install
npm run dev
```

✅ Admin panel: **http://localhost:5173**

Login table upar **Demo login** section me hai. Admin panel par **Quick login** buttons bhi hain.

---

## STEP 3 — Flutter App ko Backend se Connect Karna

**File:** `mobile-app/lib/app/data/services/api_constants.dart`

```dart
static const bool useRemoteApi = true;   // true = real backend, false = dummy offline

// Android Emulator:
static const String baseUrl = 'http://10.0.2.2:5000/api/v1';

// Real phone (PC ka WiFi IP):
// static const String baseUrl = 'http://192.168.1.XXX:5000/api/v1';
```

**Nayi files (mobile-app):**

| File | Kaam |
|------|------|
| `remote_api_service.dart` | Express backend se saari API calls |
| `ndfa_api_service.dart` | Switch — remote ya dummy |
| `dummy_api_service.dart` | Offline demo data (backup) |

**Pehle backend start karo**, phir mobile app run karo.

---

## ✅ Completed Features (All 3 Projects)

| Feature | Mobile App | Backend API | Admin Panel |
|---------|-----------|-------------|-------------|
| Login / OTP | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| Customer Listing + Photos | ✅ | ✅ | ✅ |
| Collections | ✅ | ✅ | ✅ |
| Dialer + Call recordings | ✅ | ✅ | ✅ |
| File Upload (GPS photos) | ✅ | ✅ | View in admin |
| Customers (Listed) | ✅ | ✅ | ✅ |
| Attendance GPS | ✅ | ✅ | ✅ |
| Tracking KM sync | ✅ | ✅ | ✅ |
| Call Logs sync | ✅ | ✅ | ✅ |
| Change Password | ✅ | ✅ | — |
| Profile Photo upload | ✅ | ✅ | — |

---

## 🗂️ Backend File Structure — Har File Ka Kaam

```
backend/
│
├── data/
│   └── db.json                 ← PURA DATABASE (JSON file)
│                                  Manually edit kar sakte ho!
│
├── uploads/                    ← Uploaded photos/audio yahan save
│
├── .env                        ← Secret keys (PORT, JWT_SECRET)
├── .env.example                ← Template (.env banane ke liye copy karo)
├── package.json                ← Node.js dependencies list
│
└── src/
    ├── index.js                ← SERVER START (npm run dev yahan se chalta hai)
    ├── app.js                  ← Express setup (CORS, middleware, routes)
    │
    ├── config/
    │   └── env.js              ← .env se values read karta hai
    │
    ├── lib/
    │   ├── db.js               ← db.json read/write functions
    │   └── response.js         ← Standard API response { success, message, data }
    │
    ├── middleware/
    │   ├── authMiddleware.js   ← JWT token check + role permission
    │   └── errorHandler.js     ← Error handling
    │
    ├── routes/
    │   └── index.js            ← Saari routes yahan mount hoti hain
    │
    ├── modules/                ← HAR FEATURE KA ALA FOLDER
    │   ├── auth/
    │   │   ├── auth.routes.js      ← URL paths define (POST /login)
    │   │   └── auth.controller.js  ← Business logic (login check)
    │   │
    │   ├── dashboard/          ← Dashboard stats API
    │   ├── leads/              ← Leads CRUD + accept
    │   ├── loans/              ← Loan submit, verify, approve
    │   ├── customers/          ← Listed customers list
    │   ├── customerListings/   ← Customer listing submit + approve
    │   ├── attendance/         ← Check-in/out with GPS
    │   ├── tracking/           ← Route tracking KM
    │   └── upload/             ← Photo/audio file upload
    │
    └── seed/
        └── seedData.js         ← Demo data create (npm run seed)
```

### Pattern samjho (har module same hai):

```
modules/leads/
  leads.routes.js     → URL define karta hai  (GET /leads, POST /leads/accept)
  leads.controller.js → Logic likha hai       (data fetch, save, filter)
```

> **Naya feature add karna ho?** → Naya folder banao `modules/xyz/` → routes + controller → `routes/index.js` me mount karo.

---

## 🖥️ Frontend File Structure — Har File Ka Kaam

```
admin-frontend/
│
├── index.html              ← HTML entry point
├── vite.config.js          ← Dev server + API proxy config
├── package.json            ← React dependencies
│
└── src/
    ├── main.jsx            ← React start
    ├── App.jsx             ← Routes (kaun sa page kab dikhe)
    │
    ├── api/
    │   └── api.js          ← SAARI API CALLS YAHAN (axios)
    │                          Backend se baat karne ka ek hi jagah
    │
    ├── utils/
    │   └── constants.js    ← Status colors, role labels
    │
    ├── styles/
    │   └── global.css      ← Poori styling
    │
    ├── components/
    │   ├── Layout.jsx      ← Sidebar + topbar (common layout)
    │   └── StatusBadge.jsx ← Status color badge
    │
    └── pages/              ← HAR SCREEN KA ALA FILE
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Leads.jsx
        ├── Loans.jsx
        ├── CustomerListings.jsx
        ├── Customers.jsx
        ├── Approvals.jsx   ← Branch + Admin approve buttons
        └── Attendance.jsx
```

---

## 🔌 Complete API List

Base URL: `http://localhost:5000/api/v1`

### Auth (Login)
| Method | URL | Body | Response |
|--------|-----|------|----------|
| POST | `/auth/login` | `{ mobile, password, role }` | User + token |
| POST | `/auth/otp/send` | `{ mobile }` | OTP sent |
| POST | `/auth/otp/verify` | `{ mobile, otp, role }` | User + token |
| GET | `/auth/me` | Header: Bearer token | Current user |

### Dashboard
| GET | `/dashboard/stats` | Dashboard counts |

### Leads
| GET | `/leads?status=&search=` | List leads |
| POST | `/leads/accept` | `{ leadId }` | Accept lead |
| POST | `/leads` | Lead object | Create lead (admin) |

### Loans
| GET | `/loans` | All loans |
| GET | `/loans/approval` | Pending approvals (role-based) |
| POST | `/loans` | Loan object | Submit loan |
| PUT | `/loans/:id/verify` | `{ verification, submit }` | Save verification |
| POST | `/loans/approve` | `{ loanId, action }` | Approve/reject |
| POST | `/loans/:id/disburse` | Disburse approved loan |

### Customer Listing
| GET | `/customer-listings` | All listings |
| GET | `/customer-listings/approval` | Pending approvals |
| POST | `/customer-listings` | Listing object | Submit listing |
| POST | `/customer-listings/approve` | `{ id, action }` | Approve listing |

### Customers
| GET | `/customers?search=` | Listed customers |

### Attendance
| POST | `/attendance/check-in` | `{ lat, lng }` |
| POST | `/attendance/check-out` | `{ lat, lng }` |
| GET | `/attendance/history` | History |

### Tracking
| POST | `/tracking/route-points` | `{ routePoints: [] }` |
| GET | `/tracking/today` | Today's KM |
| GET | `/tracking/history` | All reports |

### Upload
| POST | `/uploads/single` | FormData: file + lat/lng | File URL |

### Approval Actions (loans + listings dono me)
| Action | Branch Manager | Admin |
|--------|---------------|-------|
| `approve` | Branch → Admin queue | — |
| `reject` | Reject | — |
| `rework` | Send back | — |
| `finalApprove` | — | Approve / List customer |
| `finalReject` | — | Final reject |

---

## 🔄 Customer Listing Workflow

```
Field Officer (Flutter App)
    ↓ Submit Customer Listing
Branch Pending  ←── Branch Manager approve kare (Admin Panel / Flutter)
    ↓
Admin Pending   ←── Admin final approve kare
    ↓
Listed ✅       → Customer auto-create hota hai customers list me
```

---

## ✏️ Manual Changes — Common Tasks

### 1. Naya user add karna
**File:** `backend/data/db.json` → `users` array me add karo
```json
{
  "id": "U_FO002",
  "name": "New Officer",
  "mobile": "9999999999",
  "employeeId": "FO002",
  "branch": "Mumbai Branch",
  "role": "fieldOfficer",
  "password": "$2a$10$..." 
}
```
> Password hash ke liye: `npm run seed` dubara chalao ya bcrypt use karo.

### 2. API port change karna
**File:** `backend/.env` → `PORT=5000` change karo
**File:** `admin-frontend/vite.config.js` → proxy target update karo

### 3. Flutter app ka API URL change karna
**File:** `mobile-app/lib/app/data/services/api_constants.dart` → `baseUrl` change karo

### 4. Naya admin page add karna
1. `admin-frontend/src/pages/NewPage.jsx` banao
2. `admin-frontend/src/App.jsx` me route add karo
3. `admin-frontend/src/components/Layout.jsx` me nav link add karo
4. `admin-frontend/src/api/api.js` me API function add karo

### 5. Naya backend API add karna
1. `backend/src/modules/newfeature/newfeature.controller.js` banao
2. `backend/src/modules/newfeature/newfeature.routes.js` banao
3. `backend/src/routes/index.js` me mount karo:
   ```js
   router.use('/newfeature', newfeatureRoutes);
   ```

---

## 🧪 Test Karna (Postman / Browser)

1. Health check: `GET http://localhost:5000/api/v1/health`
2. Login:
   ```
   POST http://localhost:5000/api/v1/auth/login
   Body: { "mobile": "9000000001", "password": "ndfa1234", "role": "admin" }
   ```
3. Response me `token` milega — baaki requests me header me lagao:
   ```
   Authorization: Bearer <token>
   ```

---

## ⚠️ Production ke liye (Baad me)

| Abhi (Demo) | Production me |
|-------------|--------------|
| JSON file (`db.json`) | MongoDB ya PostgreSQL |
| Demo OTP `123456` | Real SMS gateway |
| Localhost | VPS/Cloud server |
| No HTTPS | SSL certificate |

---

## 📞 Quick Commands Summary

```bash
# Backend
cd backend
npm install
npm run seed
npm run dev

# Admin Frontend (naya terminal)
cd admin-frontend
npm install
npm run dev

# Flutter App (mobile-app folder me)
cd D:\Laravel\NDFA\mobile-app
flutter pub get
flutter run
```

**Backend:** http://localhost:5000/api/v1  
**Admin Panel:** http://localhost:5173  
**Flutter:** Android device/emulator
