# NDFA — Demo login

> **Password (sab users):** `ndfa1234`  
> **OTP (mobile app demo):** `123456`

| Role | Mobile | Branch | Kahan login |
|------|--------|--------|-------------|
| **Admin** | `9000000001` | All branches | Web http://localhost:5173 |
| **Branch Manager (Delhi)** | `9000000002` | Delhi Main Branch | Web |
| **Field Officer (Delhi)** | `9000000003` | Delhi Main Branch | Mobile app |
| **Branch Manager (Mumbai)** | `9000000004` | Mumbai Branch | Web |
| **Field Officer (Mumbai)** | `9000000005` | Mumbai Branch | Mobile app |

## Branch data rule

- **Admin** — saari branches ka data + user/branch management  
- **Branch Manager** — sirf apni branch + users create (Field Officer) + permissions  
- **Field Officer** — mobile app, apni branch ka kaam  

## Reset database

```bash
cd backend
npm run seed
```
