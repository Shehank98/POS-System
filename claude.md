# Project Name: BillFlow POS SaaS

## 📋 Table of Contents
- [Quick Reference](#quick-reference)
- [Project Overview](#project-overview)
- [File Structure](#file-structure)
- [Dependencies](#dependencies)
- [System Connections](#system-connections)
- [Issues Found](#issues-found)
- [Missing Components](#missing-components)
- [Configuration Reference](#configuration-reference)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Common Tasks](#common-tasks)
- [Search Index](#search-index)

---

## 🎯 Quick Reference

| What | Where |
|------|-------|
| Backend entry point | `backend/server.js` |
| Frontend entry point | `frontend/src/main.jsx` (via `frontend/index.html`) |
| API client (all calls) | `frontend/src/api/client.js` |
| DB connection | `backend/config/database.js` |
| All routes registered | `backend/server.js` lines 19–101 |
| Environment template | `backend/.env.example` |
| DB migrations | `database/migrations/001–041_*.sql` |
| Migration runner | `backend/utils/runMigrations.js` |
| WebSocket server | `backend/websocket.js` |
| Deployment config | `railway.json` |

### Key Commands
```bash
# Development
cd backend && npm run dev          # Backend on port 3001
cd frontend && npm run dev         # Frontend on port 5173 (proxied to 3001)

# Production build (Railway runs this)
npm run build                      # installs deps + builds React dist

# Start server (Railway runs this)
node backend/server.js

# Health check
GET http://localhost:3001/health
```

### Role Tokens — localStorage keys
| Role | Token key | Redirect on 401 |
|------|-----------|-----------------|
| Shop user | `pos_token` | `/login` |
| Sales agent | `pos_agent_token` | `/agent/login` |
| Super admin | `pos_admin_token` | `/admin/login` |

---

## 📊 Project Overview

- **Type**: Multi-tenant SaaS POS (Point-of-Sale) web application + Flutter mobile app
- **Primary Language**: JavaScript (Node.js backend, React frontend) / Dart (mobile)
- **Framework**: Express 4 (backend) · React 18 + Vite 5 (web frontend) · Flutter (mobile)
- **Database**: PostgreSQL (multi-tenant, single schema, shop_id isolation)
- **Status**: Active development — feature-complete core, ongoing agent & billing enhancements
- **Deployment**: Railway (cloud) — monorepo, single `node backend/server.js` process serves both API and React SPA

### Architecture Summary
```
┌─────────────────────────────────────────────────────────┐
│  Railway Cloud Deployment                                │
│                                                         │
│  ┌─────────────────────────────────┐                   │
│  │  Express Server (port 3001)      │                   │
│  │  ├── REST API  (/api/*)          │                   │
│  │  ├── WebSocket (/ws)             │                   │
│  │  └── Static React SPA (prod)     │                   │
│  └──────────────┬──────────────────┘                   │
│                 │                                        │
│  ┌──────────────▼──────────────────┐                   │
│  │  PostgreSQL Database             │                   │
│  │  (41 migrations, ~30+ tables)   │                   │
│  └─────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘

External services:
├── Firebase Admin SDK  → Push notifications (FCM)
├── Firebase Storage    → Agent documents & shop selfies
├── HelaPOS API         → Per-shop QR payment terminal
├── HelaPOS System API  → Platform billing QR codes
├── HelaPlay Webhooks   → Payment confirmation callbacks
└── Google Apps Script  → Daily email summary reports
```

### User Roles
| Role | Auth path | Scope |
|------|-----------|-------|
| `superadmin` | `/admin/login` | All shops, all agents, full system |
| `owner` | `/login` | Own shop only (full control) |
| `manager` | `/login` | Own shop (no delete, no billing) |
| `cashier` | `/login` | POS only (read-only on most things) |
| `sales_agent` | `/agent/login` | Own customers, commissions, deposits |

### Business Modules
1. **Core POS** — Products, transactions, receipts, offline sync
2. **Subscription Billing** — Plans, payment proofs, billing QR, activation
3. **Sales Agent System** — Onboarding, commissions, deposits, risk scoring
4. **Car Wash Module** — Jobs, bookings, services, staff view
5. **Clothing Module** — Variants, branches, exchanges, loyalty
6. **Pre-Orders** — Public QR ordering, status tracking
7. **Analytics & Reports** — Excel/PDF exports, email summaries, charts
8. **Notifications** — In-app (shop + admin), Firebase push (mobile)
9. **QR Payments** — HelaPOS per-shop and system-level billing

---

## 📁 File Structure

```
POS-System/
├── package.json                    # Monorepo root — build + start scripts
├── railway.json                    # Railway deployment config
├── .gitignore
├── README.md
│
├── backend/
│   ├── server.js                   # ★ Entry point — Express app, CORS, cron, migrations
│   ├── websocket.js                # WebSocket server (QR events, agent/shop subscriptions)
│   ├── package.json
│   ├── .env.example                # All required environment variables documented
│   │
│   ├── config/
│   │   └── database.js             # pg.Pool — exports db.query() and db.getClient()
│   │
│   ├── routes/                     # Express routers (thin — just route→controller mappings)
│   │   ├── admin.js                # /api/admin/*
│   │   ├── agentAuth.js            # /api/agent-auth/*
│   │   ├── agents.js               # /api/agents/me/*
│   │   ├── audit.js                # /api/audit-log/*
│   │   ├── auth.js                 # /api/auth/*
│   │   ├── carwash.js              # /api/carwash/* (authenticated)
│   │   ├── carwashPublic.js        # /api/carwash/public/*
│   │   ├── clothing.js             # /api/clothing/*
│   │   ├── customers.js            # /api/customers/*
│   │   ├── dashboard.js            # /api/dashboard/*
│   │   ├── emailSummary.js         # /api/email-summary/*
│   │   ├── notifications.js        # /api/notifications/*
│   │   ├── payments.js             # /api/payments/* (shop subscription)
│   │   ├── preOrders.js            # /api/pre-orders/*
│   │   ├── products.js             # /api/products/*
│   │   ├── qrPayments.js           # /api/qr/*
│   │   ├── reports.js              # /api/reports/*
│   │   ├── shopPayments.js         # /api/shop-payments/*
│   │   ├── transactions.js         # /api/transactions/*
│   │   └── webhooks.js             # /api/webhooks/*
│   │
│   ├── controllers/                # Business logic
│   │   ├── adminAgentController.js # Admin: agent mgmt, payments, commissions, risk, registrations
│   │   ├── adminController.js      # Admin: shops, plans, payments, dashboard, audit
│   │   ├── agentAuthController.js  # Agent: login, registration token, file upload, agreement
│   │   ├── agentController.js      # Agent: dashboard, shops, commissions, deposit QR, renewals
│   │   ├── agentRegistrationController.js  # Agent onboarding workflow
│   │   ├── auditController.js      # Audit log queries
│   │   ├── authController.js       # Shop: login, getMe, user management, settings
│   │   ├── carwashController.js    # Car wash: jobs, bookings, services, products, staff
│   │   ├── customerController.js   # Customer top/insights queries
│   │   ├── dashboardController.js  # Shop: today/week/month stats, analytics, sales trend
│   │   ├── emailSummaryController.js  # Daily email summary generation
│   │   ├── helapayWebhookController.js  # HelaPlay webhook: billing + deposit + shop QR
│   │   ├── notificationController.js   # In-app notifications, daily cron checks
│   │   ├── paymentController.js    # Shop subscription payment proofs (legacy flow)
│   │   ├── preOrderController.js   # Pre-orders: public + staff management
│   │   ├── productController.js    # Product CRUD, barcode lookup
│   │   ├── qrPaymentController.js  # HelaPOS per-shop QR: generate, status, webhook
│   │   ├── receiptController.js    # Receipt PDF/thermal generation
│   │   ├── reportController.js     # Sales/inventory/tax exports (Excel, PDF)
│   │   ├── shopPaymentController.js  # Shop billing QR (owner generates), admin verification
│   │   ├── transactionController.js  # Sales: create, void, refund, offline sync
│   │   │
│   │   └── clothing/               # Clothing module sub-controllers
│   │       ├── branchController.js
│   │       ├── customerController.js
│   │       ├── exchangeController.js
│   │       ├── productsController.js
│   │       ├── reportsController.js
│   │       ├── stockController.js
│   │       └── variantsController.js
│   │
│   ├── middleware/
│   │   ├── activationGuard.js      # Blocks inactive shops from mutation routes
│   │   ├── adminAuth.js            # Verifies superadmin JWT → req.admin
│   │   ├── agentAuth.js            # Verifies agent JWT → req.agent
│   │   ├── auth.js                 # Verifies shop-user JWT → req.user; requireRole() factory
│   │   ├── readOnly.js             # Blocks mutations when subscription expired
│   │   └── shopIsolation.js        # Tenant isolation: req.user.shop_id → req.shopId
│   │
│   ├── services/
│   │   ├── helaposService.js       # Per-shop HelaPOS: token cache, QR generate, status check
│   │   ├── systemHelaposService.js # System billing HelaPOS: generateBillingQR, checkBillingQRStatus
│   │   └── riskScoringService.js   # Agent risk score calculation
│   │
│   └── utils/
│       ├── fcm.js                  # Firebase Cloud Messaging (push notifications)
│       ├── runMigrations.js        # DB migration runner (auto-runs on startup)
│       ├── storageService.js       # Firebase Storage upload
│       └── thermalReceiptGenerator.js  # Thermal/PDF receipt generation
│
├── frontend/
│   ├── index.html                  # Vite entry HTML
│   ├── vite.config.js              # Port 5173, /api proxy → 3001, /ws proxy
│   ├── tailwind.config.js          # Custom xs breakpoint, color palette
│   ├── postcss.config.js
│   ├── package.json
│   ├── .env.example                # VITE_API_URL
│   │
│   └── src/
│       ├── main.jsx                # React root, BrowserRouter, Toaster
│       ├── App.jsx                 # Route definitions (all pages)
│       │
│       ├── api/
│       │   └── client.js           # ★ All API calls: authApi, agentApi, adminApi, etc.
│       │
│       ├── store/                  # Zustand state stores
│       │   ├── authStore.js        # Shop user: token, user object, login/logout
│       │   ├── agentStore.js       # Agent: token, profile
│       │   ├── adminStore.js       # Admin: token, profile
│       │   └── cartStore.js        # POS cart: items, totals, discount
│       │
│       ├── hooks/
│       │   ├── useOnlineStatus.js  # navigator.onLine watcher
│       │   ├── usePosScanner.js    # Keyboard wedge barcode scanner hook
│       │   └── useProducts.js      # Product list fetch + cache
│       │
│       ├── utils/
│       │   ├── offlineDB.js        # IndexedDB wrapper (offline transactions)
│       │   ├── receipt.js          # Receipt formatting helpers
│       │   ├── safeTypes.js        # Safe type-casting helpers
│       │   ├── subscriptionGuard.js  # Client-side subscription status checks
│       │   ├── syncService.js      # Offline→online sync on reconnect
│       │   └── thermalReceiptUtils.js  # Thermal printer formatting
│       │
│       ├── components/
│       │   ├── Layout.jsx          # App shell (nav, sidebar, header)
│       │   ├── CarWashLayout.jsx   # Car wash module layout
│       │   ├── PaymentModal.jsx    # POS payment dialog
│       │   ├── QRPaymentModal.jsx  # HelaPOS QR display + polling
│       │   ├── ProductForm.jsx     # Product create/edit form
│       │   ├── VariantPickerModal.jsx  # Clothing variant selector
│       │   ├── RefundModal.jsx     # Refund/return dialog
│       │   ├── BulkImport.jsx      # CSV/Excel bulk product import
│       │   ├── CameraScanner.jsx   # html5-qrcode camera scanner
│       │   ├── PosCameraScanner.jsx
│       │   ├── PhoneScannerModal.jsx
│       │   ├── ConfirmDialog.jsx   # Generic confirmation dialog
│       │   ├── ConnectionStatus.jsx  # Online/offline indicator
│       │   ├── NotificationBell.jsx  # In-app notification center
│       │   ├── SubscriptionGuard.jsx  # Wrapper that gates UI on subscription
│       │   ├── SubscriptionStatusBar.jsx
│       │   └── ThermalReceiptPreview.jsx
│       │
│       └── pages/
│           ├── LoginPage.jsx
│           ├── DashboardPage.jsx   # Shop dashboard (today/week/month charts)
│           ├── POSPage.jsx         # ★ Main POS interface
│           ├── ProductsPage.jsx
│           ├── TransactionsPage.jsx
│           ├── OrderPage.jsx
│           ├── CustomersPage.jsx
│           ├── AnalyticsPage.jsx
│           ├── ReportsPage.jsx
│           ├── BillingPage.jsx     # Subscription, payment proof, billing QR
│           ├── SettingsPage.jsx    # Shop settings, HelaPOS config
│           ├── AuditLogPage.jsx
│           ├── ScannerPage.jsx
│           ├── QRDisplayPage.jsx
│           ├── TrackOrderPage.jsx
│           ├── PreOrdersPage.jsx
│           ├── BranchManagementPage.jsx
│           ├── ClothingAnalyticsPage.jsx
│           ├── ClothingExchangesPage.jsx
│           ├── CarWashPortal.jsx
│           │
│           ├── admin/
│           │   ├── AdminLoginPage.jsx
│           │   ├── AdminDashboardPage.jsx  # ★ Main admin control center
│           │   ├── AgentsPage.jsx          # Agent management
│           │   ├── CommissionManagementPage.jsx
│           │   ├── ShopMapTab.jsx
│           │   └── ShopsByAgentTab.jsx
│           │
│           ├── agent/
│           │   ├── AgentLoginPage.jsx
│           │   ├── AgentPortalPage.jsx     # ★ Agent dashboard, shops, payments, commissions
│           │   └── AgentRegistrationPage.jsx
│           │
│           └── carwash/
│               ├── CarWashDashboard.jsx
│               ├── CarWashBookings.jsx
│               ├── CarWashJobCreate.jsx
│               ├── CarWashJobDetail.jsx
│               ├── CarWashJobList.jsx
│               ├── CarWashProducts.jsx
│               ├── CarWashServices.jsx
│               └── CarWashStaffView.jsx
│
├── database/
│   ├── schema.sql                  # Base schema (shops, users, products, transactions, payments)
│   └── migrations/                 # 41 incremental migration files (auto-applied on startup)
│       ├── 001_add_client_id.sql
│       ├── 002_notifications.sql
│       ├── 003_phase7.sql
│       ├── 004_staff_limits.sql
│       ├── 005_shop_logo.sql
│       ├── 006_missing_columns.sql
│       ├── 007_pre_orders.sql
│       ├── 008_car_wash_module.sql
│       ├── 009_cancellation_tracking.sql
│       ├── 010_weight_products.sql
│       ├── 011_kg_stock_decimal.sql
│       ├── 012_clothing_module.sql
│       ├── 013_customers_loyalty.sql
│       ├── 014_branches.sql
│       ├── 015_refund_vouchers.sql
│       ├── 016_shop_feature_flags.sql
│       ├── 017_mobile_feature_flags.sql
│       ├── 018_payment_plan_name.sql
│       ├── 019_subscription_plans.sql
│       ├── 020_car_service_flag.sql
│       ├── 021_qr_payments.sql
│       ├── 022_qr_data_column.sql
│       ├── 023_fix_qr_session_status.sql
│       ├── 024_sales_agents.sql
│       ├── 025_auth_upgrade.sql
│       ├── 026_agent_notifications.sql
│       ├── 027_agent_onboarding_upgrade.sql
│       ├── 028_soft_delete_shops.sql
│       ├── 029_admin_notifications.sql
│       ├── 030_payment_fraud_prevention.sql
│       ├── 031_subscription_billing_fixes.sql
│       ├── 032_agent_risk_scoring.sql
│       ├── 033_agent_shop_registration.sql
│       ├── 034_shop_selfie.sql
│       ├── 035_billing_qr.sql
│       ├── 036_commission_fields.sql
│       ├── 037_agent_shop_notes.sql
│       ├── 038_agent_deposit.sql
│       ├── 039_payout_logs_enhancement.sql
│       ├── 040_helapay_webhook.sql
│       └── 041_shops_district.sql
│
├── billflow/                       # Flutter mobile app (Android + iOS)
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart
│       ├── app.dart
│       ├── core/                   # Constants, network, router, storage, theme, utils
│       ├── data/                   # Models + API services (14 models, 15 services)
│       ├── presentation/           # Screens + widgets (29+ screens)
│       └── providers/              # Riverpod state management (20+ providers)
│
└── appscript/
    └── daily-summary.gs            # Google Apps Script: daily email summaries to admin
```

---

## 📦 Dependencies

### Backend Production Dependencies (`backend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.19.2 | HTTP server framework |
| `pg` | ^8.11.5 | PostgreSQL client (connection pool) |
| `jsonwebtoken` | ^9.0.2 | JWT signing and verification |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `firebase-admin` | ^12.0.0 | FCM push notifications + Firebase Storage |
| `ws` | ^8.20.0 | WebSocket server |
| `node-cron` | ^3.0.3 | Scheduled jobs (daily checks, stale pre-orders) |
| `cors` | ^2.8.5 | CORS middleware |
| `dotenv` | ^16.4.5 | Environment variable loading |
| `express-validator` | ^7.1.0 | Request input validation |
| `qrcode` | ^1.5.4 | QR code image generation (PNG/data-URL) |
| `bwip-js` | ^4.9.2 | Barcode image generation |
| `exceljs` | ^4.4.0 | Excel (.xlsx) export generation |
| `pdfkit` | ^0.15.0 | PDF generation (receipts, reports) |

### Backend Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `nodemon` | ^3.1.0 | Auto-restart on file changes |

### Frontend Production Dependencies (`frontend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `react-router-dom` | ^6.24.0 | SPA routing |
| `axios` | ^1.7.2 | HTTP client |
| `zustand` | ^4.5.2 | Lightweight state management |
| `react-hot-toast` | ^2.4.1 | Toast notifications |
| `lucide-react` | ^0.395.0 | Icon library |
| `recharts` | ^2.12.7 | Charts and data visualization |
| `qrcode.react` | ^4.2.0 | QR code SVG rendering (`<QRCodeSVG>`) |
| `qrcode` | ^1.5.4 | QR code data-URL generation |
| `html5-qrcode` | ^2.3.8 | Camera-based QR/barcode scanning |
| `leaflet` | ^1.9.4 | Map rendering |
| `react-leaflet` | ^4.2.1 | React wrapper for Leaflet |
| `uuid` | ^10.0.0 | UUID generation |
| `xlsx` | ^0.18.5 | Excel parsing (bulk import) |

### Frontend Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^5.3.1 | Build tool and dev server |
| `@vitejs/plugin-react` | ^4.3.1 | Vite React fast-refresh plugin |
| `tailwindcss` | ^3.4.4 | Utility-first CSS framework |
| `autoprefixer` | ^10.4.19 | CSS vendor prefix automation |
| `postcss` | ^8.4.39 | CSS transformation pipeline |
| `@types/react` | ^18.3.3 | TypeScript types (used for IDE support) |
| `@types/react-dom` | ^18.3.0 | TypeScript types |

### Flutter Dependencies (Key Packages)

| Package | Purpose |
|---------|---------|
| `flutter_riverpod` | State management |
| `go_router` | Navigation/routing |
| `dio` | HTTP client |
| `flutter_secure_storage` | Secure token persistence |
| `mobile_scanner` | Barcode/QR scanner |
| `fl_chart` | Charts |
| `firebase_core` + `firebase_messaging` | Push notifications |
| `local_auth` | Biometric authentication |
| `qr_flutter` | QR code display |

### ⚠️ Dependency Issues

- [ ] **`qrcode` listed in both backend and frontend** — frontend uses `qrcode.react` (`QRCodeSVG`) for display; the raw `qrcode` package in frontend is potentially unused since the agent QR rewrite (now uses `QRCodeSVG`). Verify before removing.
- [ ] **`xlsx` (frontend) uses unmaintained v0.18.5** — the package was renamed to `SheetJS` with different licensing at v0.19+. Current version is stable but consider pinning or switching to `exceljs`.
- [ ] **`leaflet` + `react-leaflet`** — used only for shop map in admin panel (`ShopMapTab.jsx`). If map feature is not deployed, these are significant bundle weight (~150 KB).
- [ ] **No test runner** — neither backend nor frontend has a test framework configured (`jest`, `vitest`, etc.)

---

## 🔗 System Connections

### Frontend → Backend API Map

```
authApi      → /api/auth/*          (authController.js)
productsApi  → /api/products/*      (productController.js)
transactionsApi → /api/transactions/* (transactionController.js)
dashboardApi → /api/dashboard/*     (dashboardController.js)
reportsApi   → /api/reports/*       (reportController.js)
analyticsApi → /api/dashboard/analytics (dashboardController.js)
notificationsApi → /api/notifications/* (notificationController.js)
auditApi     → /api/audit-log/*     (auditController.js)
paymentsApi  → /api/payments/*      (paymentController.js)
preOrdersApi → /api/pre-orders/*    (preOrderController.js)
customersApi → /api/customers/*     (customerController.js)
carwashApi   → /api/carwash/*       (carwashController.js)
carwashPublicApi → /api/carwash/public/* (carwashController.js subset)
clothingApi  → /api/clothing/*      (clothing/*.js controllers)
qrPaymentsApi → /api/qr/*          (qrPaymentController.js)
shopPayApi   → /api/shop-payments/* (shopPaymentController.js)
agentApi     → /api/agent-auth/* + /api/agents/me/* (agentController.js)
adminApi     → /api/admin/*         (adminController.js + adminAgentController.js)
```

### Middleware Chain (per request)

```
Request
  → CORS
  → Raw body capture (webhooks only)
  → express.json()
  → activationGuard (blocks inactive shops except billing/admin/agent routes)
  → Route-specific middleware:
      authMiddleware   → shopIsolation
      agentAuth
      adminAuth
      requireRole(...)
      readOnlyGuard
  → Controller function
  → Response
```

### Payment Flow Connections

```
SHOP OWNER SELF-PAY (HelaPOS billing QR):
  shopPayApi.generateBillingQR()
  → POST /api/shop-payments/generate-billing-qr
  → shopPaymentController.generateBillingQR()
  → systemHelaposService.generateBillingQR()
  → Polls: shopPayApi.billingQRStatus(ref)
  → GET /api/shop-payments/billing-qr-status/:ref
  → shopPaymentController.checkBillingQRStatus()
  → On payment_status=2: fulfillBillingPayment() → activates shop

AGENT PAYS FOR SHOP (HelaPOS billing QR):
  agentApi.generateShopQR(shopId)
  → POST /api/agents/me/shops/:shopId/payment-qr
  → agentController.generateShopPaymentQR()
  → systemHelaposService.generateBillingQR()
  → qr_payment_sessions row (session_type='billing', billing_proof_id)
  → Polls: agentApi.shopPaymentQRStatus(shopId, ref)
  → GET /api/agents/me/shops/:shopId/payment-qr/status/:ref
  → agentController.getShopPaymentQRStatus()
  → On payment_status=2: shopPaymentController.fulfillBillingPayment()

WEBHOOK PATH (HelaPOS callback):
  POST /api/webhooks/helapay
  → helapayWebhookController.handleHelaPay()
  → Reads qr_payment_sessions by qr_reference
  → session_type='billing' → fulfillBillingPayment()
  → session_type='deposit' → fulfillDepositPayment()

AGENT DEPOSIT:
  agentApi.generateDepositQR()
  → POST /api/agents/me/deposit/generate-qr
  → agentController.generateDepositQR()
  → qr_payment_sessions (session_type='deposit')
  → fulfillDepositPayment() → credits agent wallet
```

### Commission Flow

```
Shop activated (fulfillBillingPayment):
  ↓
  Check: agent_commissions WHERE agent_id + shop_id + type='onboarding' + status IN ('pending','locked')
  ↓ YES → UPDATE status='approved' (unlock onboarding commission)
  ↓ NO  → INSERT agent_commissions (commission_type='monthly', amount=plan.monthly_price * 0.2)
  ↓
  Admin: GET /api/admin/agent-commissions
  Admin: PUT /api/admin/agent-commissions/approve  (pending → approved)
  Admin: PUT /api/admin/agent-commissions/payout   (approved → paid)
```

### WebSocket Event Flow

```
backend/websocket.js manages 3 subscription systems:

1. Shop QR subscriptions (shopId):
   - Client sends: { type: 'subscribe_shop', shopId }
   - Server pushes: { type: 'qr_payment_update', status, reference }
   - Triggered by: qrPaymentController or helapayWebhookController

2. Agent subscriptions (agentId):
   - Client sends: { type: 'subscribe_agent', agentId }
   - Server pushes: activation events, commission events

3. Pairing sessions (6-digit code):
   - POS pairs with mobile scanner for remote QR scanning
```

### Database → Controller Connections

```
shops              → authController, adminController, agentController, shopPaymentController
users              → authController, adminController
products           → productController
transactions       → transactionController, dashboardController, reportController
transaction_items  → transactionController
agent_commissions  → agentController, adminAgentController, shopPaymentController
agent_wallet       → agentController (deposit), helapayWebhookController
qr_payment_sessions → qrPaymentController, shopPaymentController, agentController, helapayWebhookController
shop_payment_proofs → shopPaymentController, adminAgentController, adminController
sales_agents       → agentController, adminAgentController, agentAuthController
agent_payment_submissions → agentController, adminAgentController
carwash_jobs       → carwashController
clothing_products  → clothing/productsController
clothing_variants  → clothing/variantsController, clothing/stockController
pre_orders         → preOrderController
notifications      → notificationController
admin_notifications → notificationController, adminController
```

---

## 🐛 Issues Found

### Critical
- [ ] **`is_deleted` filter missing from some admin queries**: `adminListShopPayments` in `shopPaymentController.js` now fixed (via JOIN condition), but verify `adminController.js` shop list also applies `COALESCE(is_deleted, FALSE) = FALSE`. Deleted shops should never appear in admin UI searches.
- [ ] **No input validation on most agent/admin endpoints**: `express-validator` is installed but only selectively used. Agent `onboardCustomer`, `registerShop`, and commission endpoints lack systematic validation — relies entirely on PostgreSQL constraints.
- [ ] **CORS wildcard in development**: `server.js` line 49 defaults to `origin: '*'` when `FRONTEND_URL` is not set. In production this must be set explicitly.

### Errors
- [ ] **`earned_date` type mismatch in `fillDays()`** (`dashboardController.js`): PostgreSQL DATE columns arrive as JS Date objects. Fixed by always overwriting `day` field with string key in `fillDays()`. Monitor if similar issue appears in other trend queries.
- [ ] **HelaPOS token expiry not handled in `helaposService.js`** (per-shop): Only `systemHelaposService.js` has the `helaPostWithRetry()` / `invalidateCachedToken()` pattern. If a per-shop HelaPOS token expires mid-session, the POS QR will fail silently with a 401. `helaposService.js` should get the same retry wrapper.
- [ ] **Cron timezone**: `node-cron` uses server timezone. On Railway, server timezone may differ from Sri Lanka (IST/+5:30). The 09:00 daily check may fire at the wrong local time. Should use `{ timezone: 'Asia/Colombo' }` option.

### Warnings
- [ ] **`agent_payment_submissions` still references deleted shops**: `listPayments` in `agentController.js` now filters deleted shops, but the submission record itself (created before deletion) still exists. Display "Deleted Shop" as the name gracefully if `s.name` is null after a LEFT JOIN approach.
- [ ] **Firebase push notifications**: `fcm.js` silently catches token errors. If `FIREBASE_SERVICE_ACCOUNT` is malformed or not set, FCM will fail quietly — no alert to admin. Add startup validation for Firebase config.
- [ ] **`readOnly` flag set on JWT at login time**: If a shop's subscription expires mid-session, the JWT still has `read_only: false` until re-login. The `activationGuard` re-checks the DB on every request, so activation status is live. But `read_only` is a JWT claim — stale until token refresh.
- [ ] **No rate limiting**: Admin login, agent login, and shop login endpoints have no brute-force protection. Consider `express-rate-limit`.
- [ ] **Large JSON body limit** (`20mb` in `server.js`): Required for base64 document uploads in agent registration. Potential DoS vector — consider limiting to the specific upload routes only.

---

## ❌ Missing Components

### Required Implementations
- [ ] **Per-shop HelaPOS token 401 retry** (`backend/services/helaposService.js`): `systemHelaposService.js` has `helaPostWithRetry()` — same pattern needs to be applied to `helaposService.js` for POS QR payments.
- [ ] **Webhook signature verification for HelaPOS QR** (`qrPaymentController.js`): `helapayWebhookController.js` verifies HMAC (`HELAPAY_WEBHOOK_SECRET`), but `qrPaymentController.handleWebhook` (the `/api/qr/webhook` endpoint) may lack equivalent signature checking.
- [ ] **Agent notification on shop activation**: When `fulfillBillingPayment` activates a shop, the agent who onboarded it does not receive an in-app notification. WebSocket push to agent is not wired up at the billing fulfillment path.

### Missing Configurations
- [ ] **`HELAPOS_*` env vars not validated at startup**: `server.js` only validates `JWT_SECRET` and `DATABASE_URL`. If HelaPOS system vars are missing, billing QR generation will fail at runtime with a cryptic error.
- [ ] **`FRONTEND_URL` should be required in production**: Currently optional (defaults to `*`). Should enforce non-wildcard CORS in production.
- [ ] **Flutter `api_constants.dart`** — production API URL must be updated before release build; currently likely points to localhost or staging.

### Missing Files
- [ ] **No `CLAUDE.md` at project root** — this file is it; place at `/home/user/POS-System/CLAUDE.md` (see Getting Started)
- [ ] **No `.env` file** — must be created from `.env.example` (never committed)
- [ ] **No test files** — `backend/` has zero test files; `frontend/src/` has no `*.test.jsx` files
- [ ] **No `Dockerfile`** — deployment relies entirely on Railway's Nixpacks auto-detection

---

## ⚙️ Configuration Reference

### Backend Environment Variables (`backend/.env.example`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ YES | — | PostgreSQL connection string (full URL with SSL params) |
| `JWT_SECRET` | ✅ YES | — | Random secret for signing JWTs (min 32 chars recommended) |
| `JWT_EXPIRES_IN` | no | `12h` | Token expiry: `12h`, `7d`, `30d`, etc. |
| `ADMIN_EMAIL` | no | — | Super-admin email (seeded on first startup) |
| `ADMIN_PASSWORD` | no | — | Super-admin password (seeded on first startup) |
| `PORT` | no | `3001` | HTTP server port |
| `NODE_ENV` | no | — | Set to `production` to serve React dist and enable SSL DB |
| `FRONTEND_URL` | no | `*` | CORS allowed origin — set to your frontend URL in prod |
| `DAILY_SUMMARY_KEY` | no | — | Secret key for Google Apps Script daily email endpoint |
| `FIREBASE_SERVICE_ACCOUNT` | no | — | JSON string: Firebase Admin SDK service account (FCM push) |
| `FIREBASE_STORAGE_SERVICE_ACCOUNT` | no | — | JSON string: Firebase Storage service account |
| `FIREBASE_STORAGE_BUCKET` | no | — | Firebase Storage bucket name (e.g. `myapp.appspot.com`) |
| `HELAPAY_WEBHOOK_SECRET` | no | — | HMAC-SHA256 secret for verifying HelaPlay webhook signatures |
| `HELAPOS_SYSTEM_APP_ID` | no | — | HelaPOS platform app ID (for system billing QR) |
| `HELAPOS_SYSTEM_APP_SECRET` | no | — | HelaPOS platform app secret |
| `HELAPOS_SYSTEM_BUSINESS_ID` | no | — | HelaPOS platform business ID |
| `HELAPOS_SYSTEM_BUSINESS_USER_ID` | no | — | HelaPOS platform business user ID |

### Frontend Environment Variables (`frontend/.env.example`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | no | `/api` | Backend API base URL (omit in production — uses Vite proxy) |

### Config Files

| File | Purpose |
|------|---------|
| `backend/.env.example` | Template for all backend env vars |
| `frontend/.env.example` | Template for frontend env vars |
| `railway.json` | Railway deployment: buildCommand + startCommand |
| `frontend/vite.config.js` | Dev server port, API proxy, React plugin |
| `frontend/tailwind.config.js` | Custom breakpoints (xs: 480px), color palette |
| `frontend/postcss.config.js` | Tailwind + autoprefixer plugins |
| `backend/config/database.js` | pg.Pool config: max=10, idleTimeout=30s, SSL in prod |

---

## 🌐 API Reference

All routes are under `/api/`. Authentication header: `Authorization: Bearer <token>`.

### Auth Routes (`/api/auth/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | public | Shop user login → JWT |
| GET | `/auth/me` | shop-user | Get current user + shop info |
| POST | `/auth/register-user` | owner/manager | Create staff account |
| GET | `/auth/users` | owner/manager | List shop users |
| DELETE | `/auth/users/:id` | owner | Delete staff account |
| PUT | `/auth/settings` | owner/manager | Update shop settings |

### Product Routes (`/api/products/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/products` | shop-user | List products (paginated, filterable) |
| GET | `/products/categories` | shop-user | List distinct categories |
| GET | `/products/by-barcode/:code` | shop-user | Lookup by barcode |
| GET | `/products/:id` | shop-user | Get single product |
| POST | `/products` | owner/manager | Create product |
| PUT | `/products/:id` | owner/manager | Update product |
| DELETE | `/products/:id` | owner/manager | Delete product |

### Transaction Routes (`/api/transactions/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/transactions` | shop-user | List transactions (date filtered) |
| GET | `/transactions/summary` | shop-user | Aggregated totals |
| GET | `/transactions/:id` | shop-user | Get transaction + items |
| GET | `/transactions/:id/receipt` | shop-user | PDF receipt |
| POST | `/transactions` | shop-user (active sub) | Create sale |
| POST | `/transactions/sync` | shop-user (active sub) | Offline sync batch |
| POST | `/transactions/:id/void` | owner/manager | Void transaction |
| POST | `/transactions/:id/refund` | owner/manager | Refund transaction |

### Dashboard Routes (`/api/dashboard/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard/today` | shop-user | Today's stats |
| GET | `/dashboard/yesterday` | shop-user | Yesterday's stats |
| GET | `/dashboard/week` | shop-user | Current week stats |
| GET | `/dashboard/month` | shop-user | Current month stats |
| GET | `/dashboard/low-stock` | shop-user | Products below threshold |
| GET | `/dashboard/analytics` | shop-user | Detailed analytics + trends |

### Agent Routes (`/api/agents/me/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/agents/me/dashboard` | agent | Dashboard stats + recent commissions |
| GET | `/agents/me/customers` | agent | Legacy customer list |
| POST | `/agents/me/customers` | agent | Legacy onboard customer |
| GET | `/agents/me/shops` | agent | Shop list (non-deleted only) |
| POST | `/agents/me/shops/register` | agent | Register new shop |
| POST | `/agents/me/shops/:shopId/payment-qr` | agent | Generate billing QR for shop |
| GET | `/agents/me/shops/:shopId/payment-qr/status/:ref` | agent | Poll QR payment status |
| GET | `/agents/me/shops/:shopId/payments` | agent | Shop payment history |
| GET | `/agents/me/payments` | agent | Agent cash submissions |
| POST | `/agents/me/payments` | agent | Submit cash payment proof |
| GET | `/agents/me/commissions` | agent | Commission history |
| PUT | `/agents/me/bank-details` | agent | Update bank details |
| GET | `/agents/me/renewals` | agent | Shops expiring soon |
| GET | `/agents/me/subscriptions` | agent | All shop subscriptions |
| PUT | `/agents/me/shops/:shopId/note` | agent | Save shop follow-up note |
| POST | `/agents/me/deposit/generate-qr` | agent | Generate HelaPOS deposit QR |
| GET | `/agents/me/deposit/status/:ref` | agent | Poll deposit QR status |
| GET | `/agents/me/deposit/history` | agent | Deposit history |
| GET | `/agents/me/plans` | agent | Available subscription plans |
| GET | `/agents/me/notifications` | agent | Agent notifications |
| PUT | `/agents/me/notifications/:id/read` | agent | Mark notification read |

### Admin Routes (`/api/admin/*`) — superadmin only
| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/login` | Admin login |
| GET | `/admin/dashboard` | System-wide dashboard |
| GET | `/admin/financial-summary` | Revenue + agent financials |
| GET | `/admin/analysis` | Advanced analytics |
| GET | `/admin/shops` | List all shops |
| POST | `/admin/shops` | Create shop |
| PUT | `/admin/shops/:id` | Update shop |
| DELETE | `/admin/shops/:id` | Soft-delete shop |
| GET | `/admin/shops/:id/users` | Shop users |
| POST | `/admin/shops/:id/users` | Add shop user |
| DELETE | `/admin/shops/:id/users/:uid` | Remove shop user |
| GET | `/admin/shops/:id/agent-info` | Agent who onboarded shop |
| PUT | `/admin/shops/:id/subscription` | Manually update subscription |
| GET | `/admin/payments` | All shop payment proofs |
| PUT | `/admin/payments/:id/verify` | Verify payment proof |
| PUT | `/admin/payments/:id/reject` | Reject payment proof |
| GET | `/admin/shop-payments` | Shop billing payment proofs |
| PUT | `/admin/shop-payments/:id/verify` | Verify billing payment |
| PUT | `/admin/shop-payments/:id/reject` | Reject billing payment |
| PUT | `/admin/shop-payments/:id/helaPay-verify` | Manual HelaPay verify |
| GET | `/admin/agents` | List all agents |
| PUT | `/admin/agents/:id/approve` | Approve agent registration |
| PUT | `/admin/agents/:id/reject` | Reject agent registration |
| GET | `/admin/agent-commissions` | List commissions (filterable) |
| PUT | `/admin/agent-commissions/approve` | Bulk approve commissions |
| PUT | `/admin/agent-commissions/payout` | Mark commissions paid |
| GET | `/admin/agent-payout-logs` | Payout history |
| GET | `/admin/agent-payments/pending` | Pending agent cash submissions |
| PUT | `/admin/agent-payments/:id/verify` | Verify agent payment |
| GET | `/admin/agent-risk-scores` | Agent risk scores |
| PUT | `/admin/agent-risk-scores/:id/recalculate` | Recalculate risk score |
| GET | `/admin/shops-by-agent` | All agents with shop breakdown |
| GET | `/admin/shops/map-data` | Shop locations for map |
| POST | `/admin/generate-agent-invite` | Generate agent invite token |
| GET | `/admin/invite-tokens` | List invite tokens |
| GET | `/admin/plans` | List subscription plans |
| POST | `/admin/plans` | Create plan |
| PUT | `/admin/plans/:id` | Update plan |
| DELETE | `/admin/plans/:id` | Delete plan |

### QR Payment Routes (`/api/qr/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/qr/webhook` | public | HelaPOS payment webhook |
| GET | `/qr/display/:reference` | public | QR session status (polling) |
| GET | `/qr/config` | owner | HelaPOS shop config |
| PUT | `/qr/config` | owner | Save HelaPOS shop config |
| POST | `/qr/test` | owner | Test HelaPOS connection |
| POST | `/qr/generate` | shop-user | Generate payment QR |
| GET | `/qr/status/:reference` | shop-user | Poll QR payment status |

### Shop Payment Routes (`/api/shop-payments/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/shop-payments/upload-proof` | shop-user | Upload payment proof image |
| GET | `/shop-payments/my-proofs` | shop-user | My payment proof history |
| POST | `/shop-payments/generate-billing-qr` | shop-user | Generate HelaPOS billing QR |
| GET | `/shop-payments/billing-qr-status/:ref` | shop-user | Poll billing QR status |

### Webhook Routes (`/api/webhooks/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/helapay` | public (HMAC) | HelaPlay payment callback |
| GET | `/webhooks/logs` | admin | View webhook event log |

---

## 🗄️ Database Schema

### Core Tables

#### `shops` — Multi-tenant root table
```sql
id                      SERIAL PRIMARY KEY
name                    TEXT NOT NULL
owner_name              TEXT
email                   TEXT
phone                   TEXT
address                 TEXT
contact_number          TEXT
username                TEXT UNIQUE
password_hash           TEXT
tax_rate                NUMERIC(5,2) DEFAULT 0
logo_url                TEXT
selfie_url              TEXT           -- Shop selfie for verification
br_number               TEXT           -- Business registration number
district                TEXT
shop_reference_id       TEXT UNIQUE    -- Human-readable ID (e.g. SHOP-0001)
shop_type               TEXT           -- retail, clothing, car_wash, etc.
activation_status       TEXT DEFAULT 'inactive'  -- inactive | active
subscription_status     TEXT DEFAULT 'pending_payment'  -- pending_payment | active | expired | suspended
subscription_end_date   TIMESTAMPTZ
plan_id                 INT REFERENCES subscription_plans(id)
subscription_months     INT DEFAULT 1
expected_amount         NUMERIC(10,2)
onboarded_by_agent_id   INT REFERENCES sales_agents(id)
location_lat            NUMERIC
location_lng            NUMERIC
location_map_url        TEXT
is_deleted              BOOLEAN DEFAULT FALSE  -- Soft delete flag
created_at              TIMESTAMPTZ DEFAULT NOW()
```

#### `users` — Shop staff accounts
```sql
id          SERIAL PRIMARY KEY
shop_id     INT REFERENCES shops(id)
username    TEXT NOT NULL
password_hash TEXT
role        TEXT  -- owner | manager | cashier
is_active   BOOLEAN DEFAULT TRUE
created_at  TIMESTAMPTZ DEFAULT NOW()
```

#### `products` — Product catalog (per shop)
```sql
id              SERIAL PRIMARY KEY
shop_id         INT REFERENCES shops(id)
name            TEXT NOT NULL
category        TEXT
barcode         TEXT
price           NUMERIC(10,2)
cost_price      NUMERIC(10,2)
stock           NUMERIC(10,3)  -- Decimal for weight-based (kg)
low_stock_alert INT DEFAULT 10
is_active       BOOLEAN DEFAULT TRUE
track_stock     BOOLEAN DEFAULT TRUE
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `transactions` — Sales records
```sql
id              SERIAL PRIMARY KEY
shop_id         INT REFERENCES shops(id)
total_amount    NUMERIC(10,2)
discount_amount NUMERIC(10,2)
tax_amount      NUMERIC(10,2)
payment_method  TEXT  -- cash | card | qr | etc.
status          TEXT  -- completed | voided | refunded
receipt_number  TEXT
cashier_id      INT REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `transaction_items` — Line items
```sql
id              SERIAL PRIMARY KEY
transaction_id  INT REFERENCES transactions(id)
product_id      INT REFERENCES products(id)
product_name    TEXT  -- snapshot at sale time
quantity        NUMERIC(10,3)
unit_price      NUMERIC(10,2)
total_price     NUMERIC(10,2)
```

#### `subscription_plans` — Billing tiers
```sql
id                  SERIAL PRIMARY KEY
name                TEXT
base_monthly_price  NUMERIC(10,2)
discount_3m         NUMERIC(5,2)  -- Percentage discount for 3-month
discount_6m         NUMERIC(5,2)
discount_12m        NUMERIC(5,2)
features            JSONB
limits              JSONB
is_active           BOOLEAN DEFAULT TRUE
```

#### `sales_agents` — Field sales agents
```sql
id                  SERIAL PRIMARY KEY
name                TEXT
email               TEXT UNIQUE
phone               TEXT
district            TEXT
bank_name           TEXT
bank_account        TEXT
bank_branch         TEXT
account_holder      TEXT
approval_status     TEXT  -- pending | approved | rejected
is_active           BOOLEAN DEFAULT TRUE
monthly_target      INT DEFAULT 10
created_at          TIMESTAMPTZ DEFAULT NOW()
```

#### `agent_commissions` — Commission tracking
```sql
id              SERIAL PRIMARY KEY
agent_id        INT REFERENCES sales_agents(id)
shop_id         INT REFERENCES shops(id)
commission_type TEXT  -- onboarding | monthly
amount          NUMERIC(10,2)
status          TEXT  -- pending | locked | approved | paid
month           DATE
earned_date     DATE
paid_at         TIMESTAMPTZ
payment_method  TEXT
transaction_reference TEXT
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `agent_wallet` — Agent cash wallet
```sql
id              SERIAL PRIMARY KEY
agent_id        INT REFERENCES sales_agents(id) UNIQUE
balance         NUMERIC(10,2) DEFAULT 0
total_collected NUMERIC(10,2) DEFAULT 0
total_verified  NUMERIC(10,2) DEFAULT 0
```

#### `qr_payment_sessions` — Payment QR sessions
```sql
id              SERIAL PRIMARY KEY
shop_id         INT REFERENCES shops(id)
agent_id        INT REFERENCES sales_agents(id)
reference       TEXT UNIQUE    -- Internal UUID reference
qr_reference    TEXT           -- HelaPOS QR reference
qr_data         TEXT           -- QR string to encode
amount          NUMERIC(10,2)
session_type    TEXT  -- billing | deposit | pos
billing_proof_id INT REFERENCES shop_payment_proofs(id)
payment_status  INT DEFAULT 0  -- 0=pending, 1=processing, 2=paid, -1=failed
expires_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `shop_payment_proofs` — Payment proof records
```sql
id              SERIAL PRIMARY KEY
shop_id         INT REFERENCES shops(id)
agent_id        INT REFERENCES sales_agents(id)
amount          NUMERIC(10,2)
payment_method  TEXT  -- bank_transfer | agent_cash | agent_helaPay
proof_url       TEXT
status          TEXT  -- pending | verified | rejected
verified_at     TIMESTAMPTZ
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `agent_payment_submissions` — Agent cash collection
```sql
id              SERIAL PRIMARY KEY
agent_id        INT REFERENCES sales_agents(id)
shop_id         INT REFERENCES shops(id)
amount          NUMERIC(10,2)
payment_method  TEXT
proof_url       TEXT
status          TEXT  -- pending_verification | verified | rejected
submitted_at    TIMESTAMPTZ DEFAULT NOW()
```

#### `agent_risk_scores` — Fraud prevention
```sql
id              SERIAL PRIMARY KEY
agent_id        INT REFERENCES sales_agents(id) UNIQUE
score           NUMERIC(5,2) DEFAULT 0
risk_level      TEXT  -- low | medium | high | critical
restriction     TEXT
last_calculated TIMESTAMPTZ
```

### Key Relationships
```
shops
  ├── users (1:many)
  ├── products (1:many)
  ├── transactions (1:many)
  │   └── transaction_items (1:many)
  ├── shop_payment_proofs (1:many)
  ├── qr_payment_sessions (1:many)
  └── onboarded_by → sales_agents (many:1)

sales_agents
  ├── agent_commissions (1:many) ──→ shops
  ├── agent_wallet (1:1)
  ├── agent_payment_submissions (1:many)
  └── agent_risk_scores (1:1)

subscription_plans
  └── referenced by shops.plan_id
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL 14+ (or a Railway/Supabase PostgreSQL URL)
- (Optional) Firebase project for push notifications and storage
- (Optional) HelaPOS merchant account for QR payments

### 1. Clone and Install Dependencies
```bash
cd /home/user/POS-System

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure Environment
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set DATABASE_URL and JWT_SECRET

# Frontend (optional — uses Vite proxy in dev)
cp frontend/.env.example frontend/.env
# Only needed if connecting to a remote backend in dev
```

### 3. Set Up Database
```bash
# Run migrations manually (or they run automatically on server start)
# Ensure DATABASE_URL is set, then:
node backend/utils/runMigrations.js
```

### 4. Run in Development
```bash
# Terminal 1 — Backend
cd backend && npm run dev
# Starts on http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev
# Starts on http://localhost:5173 (proxies /api/* → localhost:3001)
```

### 5. Production Build (Railway)
```bash
# Railway runs: npm run build (root package.json)
# Which runs:
cd backend && npm install
cd ../frontend && npm install --include=dev && npm run build
# Outputs React dist to frontend/dist/
# Then Railway runs: node backend/server.js
# server.js serves frontend/dist as static files in production
```

### 6. First-Time Admin Setup
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` before first startup. The server seeds the admin account automatically if it doesn't exist.

Access admin at: `http://localhost:5173/admin/login`

---

## 📝 Common Tasks

### Add a New API Endpoint
1. Add function to appropriate controller in `backend/controllers/`
2. Add route in `backend/routes/`
3. Register route (if new file) in `backend/server.js`
4. Add API method to `frontend/src/api/client.js` under the right group
5. Call from frontend component using the API method

### Add a New Database Column
1. Create `database/migrations/042_your_change.sql`
2. The migration runs automatically on next server startup
3. Update affected controller queries to include the new column

### Add a Commission-Eligible Event
1. Call `shopPaymentController.fulfillBillingPayment(proofId, shopId, qrRef)` after payment
2. This handles shop activation AND commission logic atomically
3. The `hasUnlockableOnboarding` pattern ensures: first payment unlocks onboarding commission, subsequent payments create monthly commission

### Debug a Failed QR Payment
```sql
-- Check session state
SELECT * FROM qr_payment_sessions WHERE reference = '<ref>';

-- Check webhook logs
SELECT * FROM helapay_webhook_logs ORDER BY created_at DESC LIMIT 10;

-- Check payment proofs
SELECT * FROM shop_payment_proofs WHERE shop_id = <id> ORDER BY created_at DESC;
```

### Check Agent Commission Correctness
```sql
-- Should see: 1 onboarding at status='approved' or 'paid', then monthly commissions
SELECT commission_type, amount, status, earned_date, created_at
  FROM agent_commissions
 WHERE agent_id = <id> AND shop_id = <id>
 ORDER BY created_at;
```

### Soft-Delete a Shop (Admin)
The `DELETE /api/admin/shops/:id` endpoint sets `is_deleted = TRUE`. All agent/admin queries have `COALESCE(is_deleted, FALSE) = FALSE` guards to prevent deleted shops from appearing. The shop user can no longer log in once deleted.

### Test HelaPOS System Billing QR Locally
Requires all four `HELAPOS_SYSTEM_*` env vars. Without them, `systemHelaposService.generateBillingQR()` throws a 503 with a friendly message. Check `backend/services/systemHelaposService.js` for the `HelaPOSError` class and `helaPostWithRetry()` retry logic.

### Run Database Health Check
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Check Which Migrations Have Run
```sql
SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at;
```

---

## 🔍 Search Index

| Concept | File | Key Function/Component |
|---------|------|----------------------|
| JWT login (shop) | `authController.js` | `login()` |
| JWT login (agent) | `agentAuthController.js` | `login()` |
| JWT login (admin) | `adminController.js` | `adminLogin()` |
| Shop activation | `shopPaymentController.js` | `fulfillBillingPayment()` |
| Commission logic | `shopPaymentController.js`, `adminController.js`, `adminAgentController.js` | `fulfillBillingPayment()`, `verifyPayment()`, submission verify |
| Commission onboarding unlock | `shopPaymentController.js` ~line 45 | `hasUnlockableOnboarding` pattern |
| HelaPOS system billing QR | `systemHelaposService.js` | `generateBillingQR()`, `checkBillingQRStatus()` |
| HelaPOS per-shop POS QR | `helaposService.js` | `helaPost()`, `fetchFreshToken()` |
| HelaPOS 401 retry | `systemHelaposService.js` | `helaPostWithRetry()`, `invalidateCachedToken()` |
| Webhook handler | `helapayWebhookController.js` | `handleHelaPay()` |
| Agent deposit QR | `agentController.js` | `generateDepositQR()`, `getDepositQRStatus()` |
| Agent shop payment QR | `agentController.js` | `generateShopPaymentQR()`, `getShopPaymentQRStatus()` |
| Soft delete filter | All queries touching `shops` | `COALESCE(is_deleted, FALSE) = FALSE` |
| WebSocket events | `websocket.js` | `setupWebSocket()`, `safeSend()` |
| Tenant isolation | `middleware/shopIsolation.js` | `shopIsolation()` → `req.shopId` |
| Activation guard | `middleware/activationGuard.js` | `activationGuard()` |
| Risk scoring | `services/riskScoringService.js` | `recalculateRiskScore()` |
| Daily cron | `notificationController.js` | `runDailyChecks()` |
| Stale pre-order cleanup | `preOrderController.js` | `cancelStalePreOrders()` |
| Offline sync | `utils/syncService.js`, `transactionController.js` | `syncOfflineTransactions()` |
| IndexedDB offline | `utils/offlineDB.js` | `saveTransaction()`, `getPendingTransactions()` |
| Sales trend "Invalid date" fix | `dashboardController.js` | `fillDays()` — always spreads `day: key` |
| Subscription date formula | `shopPaymentController.js`, `adminAgentController.js` | `CASE WHEN end_date > NOW() THEN end_date + 1 month ...` |
| Progress bar denominator | `BillingPage.jsx` | `planMonths * 30` |
| Agent dashboard stats | `agentController.js` `getDashboard()` | Returns: total_customers, activated_shops, this_month_earnings, recent_commissions, expiring_soon (7 days) |
| Admin commission view | `CommissionManagementPage.jsx` | Shows `shop_activation_status`, `shop_subscription_status` |
| QR display component | `AgentPortalPage.jsx` `ShopQRModal` | `QRCodeSVG`, 3s polling, 10-min countdown, success/fail/expired states |
| All API calls | `frontend/src/api/client.js` | `authApi`, `agentApi`, `adminApi`, `shopPayApi`, etc. |
| State management | `frontend/src/store/` | `authStore`, `agentStore`, `adminStore`, `cartStore` |

---

*Last Updated: 2026-05-06*
*Analysis performed by Claude Code — branch `claude/agent-shop-registration-33sjT`*
