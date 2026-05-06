# BillFlow POS SaaS — Claude Reference

> **Full analysis lives in [`claude.md`](./claude.md).** This file is the short version for quick context loading.

## Project at a Glance

Multi-tenant SaaS POS system. Node.js/Express backend, React/Vite frontend, Flutter mobile app, PostgreSQL database. Deployed on Railway.

```
backend/server.js      ← entry point
frontend/src/App.jsx   ← React routes
frontend/src/api/client.js  ← ALL API calls
database/migrations/   ← 41 auto-applied migrations
```

## Key Rules

1. **Soft-delete**: Always add `AND COALESCE(s.is_deleted, FALSE) = FALSE` to any query touching `shops`.
2. **Tenant isolation**: Every shop query must filter by `shop_id` (enforced by `middleware/shopIsolation.js`).
3. **Commission logic**: First payment → unlock `onboarding` commission; subsequent payments → create `monthly` commission. Use `hasUnlockableOnboarding` pattern in `shopPaymentController.fulfillBillingPayment`.
4. **HelaPOS 401 retry**: Both `helaposService.js` and `systemHelaposService.js` have `helaPostWithRetry()`. Always use it, never call `helaPost()` directly.
5. **Rate limiting**: Login endpoints (`/api/auth/login`, `/api/admin/login`, `/api/agent-auth/login`) are rate-limited via `middleware/loginRateLimiter.js`.
6. **Cron timezone**: All cron jobs use `{ timezone: 'Asia/Colombo' }`.

## Dev Commands

```bash
cd backend && npm install && npm run dev    # port 3001
cd frontend && npm install && npm run dev  # port 5173
```

## Auth Tokens (localStorage)

| Role | Key |
|------|-----|
| Shop user | `pos_token` |
| Agent | `pos_agent_token` |
| Admin | `pos_admin_token` |

## Required ENV (backend)

`DATABASE_URL`, `JWT_SECRET` — fatal if missing. See `backend/.env.example` for full list.

## See Also

- Full API reference → `claude.md` § API Reference
- DB schema → `claude.md` § Database Schema
- Issue history → `claude.md` § Fix History
