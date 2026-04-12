# Multi-Tenant POS SaaS System

A cloud-based Point of Sale system supporting multiple shops (tenants) on a single deployment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT tokens |
| Frontend (Phase 2) | React + Vite + Tailwind CSS |
| Deployment | Railway |

---

## Project Structure

```
POS-System/
├── database/
│   └── schema.sql          ← Run this once on your PostgreSQL DB
├── backend/
│   ├── server.js            ← Entry point
│   ├── package.json
│   ├── .env.example         ← Copy to .env and fill in values
│   ├── config/
│   │   └── database.js      ← PostgreSQL connection pool
│   ├── middleware/
│   │   ├── auth.js          ← JWT verification + role guard
│   │   ├── adminAuth.js     ← Super-admin JWT guard
│   │   └── shopIsolation.js ← Binds req.shopId from token
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── transactions.js
│   │   └── admin.js
│   └── controllers/
│       ├── authController.js
│       ├── productController.js
│       ├── transactionController.js
│       └── adminController.js
└── railway.json             ← Railway deployment config
```

---

## Local Setup

### 1. Database

```bash
# Connect to your PostgreSQL instance and run:
psql $DATABASE_URL -f database/schema.sql
```

### 2. Backend

```bash
cd backend
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

npm run dev       # development (nodemon)
npm start         # production
```

---

## API Reference

### Authentication (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | Public | Login with username + password + shop_id |
| GET | `/me` | Any user | Get current user info |
| POST | `/register-user` | Owner/Manager | Create staff account |
| GET | `/users` | Owner/Manager | List shop staff |
| DELETE | `/users/:id` | Owner | Delete staff account |

### Products (`/api/products`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Any | List products (supports search, category, pagination) |
| GET | `/:id` | Any | Get single product |
| GET | `/by-barcode/:barcode` | Any | Look up by barcode |
| GET | `/categories` | Any | List all categories |
| POST | `/` | Owner/Manager | Create product |
| PUT | `/:id` | Owner/Manager | Update product |
| DELETE | `/:id` | Owner/Manager | Delete product (audit logged) |

### Transactions (`/api/transactions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Any | List transactions (filterable by date, method, status) |
| GET | `/summary` | Any | Totals for a date range |
| GET | `/:id` | Any | Get transaction with line items |
| POST | `/` | Any | Create new sale |
| POST | `/:id/void` | Owner/Manager | Void a transaction (restores stock) |

### Super Admin (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | Public | Admin login |
| GET | `/dashboard` | Admin | System-wide stats |
| GET | `/shops` | Admin | All shops |
| POST | `/shops` | Admin | Create shop + owner account |
| PUT | `/shops/:id` | Admin | Update shop details |
| PUT | `/shops/:id/subscription` | Admin | Change status / extend months |
| GET | `/shops/:id/sales` | Admin | View any shop's transactions |
| GET | `/payments` | Admin | All subscription payments |
| PUT | `/payments/:id/verify` | Admin | Verify payment + extend subscription |

---

## Railway Deployment

1. Push this repo to GitHub.
2. Create a new Railway project → **Deploy from GitHub repo**.
3. Add a **PostgreSQL** service inside Railway.
4. In the backend service, add environment variables from `.env.example`.
5. Railway auto-sets `DATABASE_URL` from the Postgres service.
6. Run the schema: connect via Railway's database shell and execute `database/schema.sql`.

---

## Security Notes

- All shop data is isolated by `shop_id` extracted from the JWT — users can never access other shops' data.
- Passwords are hashed with bcrypt (cost factor 10).
- Deleted products are archived in `deleted_records` before removal.
- Subscription expiry blocks login at the API level.
