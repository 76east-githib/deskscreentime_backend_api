# DeskScreenTime Backend API

Standalone **Node.js + Express + TypeScript** backend API for DeskScreenTime.
No frontend — Swagger UI is the only built-in interface, and every business
endpoint from the original Next.js app is exposed under `/api`.

---

## Features

- 82 REST endpoints across `auth`, `admin`, `common`, `task`, `projectTask`, and `superAdmin` domains
- Full **Swagger / OpenAPI 3** documentation auto-generated from controllers, served at **`/docs`**
- JWT (Bearer) authentication primitives + middleware
- Strong, scalable structure: `controllers/`, `routes/`, `middleware/`, `services-ready helpers/`, `models/`, `validation/`, `errors/`, `responses/`, `config/`
- Centralized async error handling, Zod-based request validation, structured responses
- Production-grade middleware stack: helmet, cors, compression, morgan, rate limiting, cookie parsing
- Multipart file uploads via `multer` (memory storage)
- Path aliases (`@controllers/*`, `@models/*`, `@helpers/*`, …) for clean imports

---

## Prerequisites

- Node.js **18+**
- A running MongoDB instance (local or remote)

---

## Quick Start

```bash
npm install
cp .env.example .env   # then edit values

# dev (auto-reload via ts-node-dev)
npm run dev

# production build + run
npm run build
npm start
```

Server defaults to **`http://localhost:4000`** (override with `PORT`).

| URL | Purpose |
| --- | --- |
| `http://localhost:4000/healthz` | Liveness check |
| `http://localhost:4000/docs` | Swagger UI for testing every API |
| `http://localhost:4000/docs.json` | Raw OpenAPI 3 JSON |
| `http://localhost:4000/api/...` | All business endpoints |

---

## Available Scripts

```text
npm run dev         # ts-node-dev with path alias support
npm run build       # tsc + tsc-alias (rewrites @aliases in dist)
npm start           # node dist/index.js  (uses tsconfig-paths)
npm run typecheck   # strict TypeScript check, no emit
npm run lint        # ESLint (config not committed; install your preferred config)
```

---

## Folder Structure

```text
src/
├── index.ts                   # entrypoint: bootstraps DB + Express
├── server.ts                  # Express app factory (middleware + routes)
├── config/
│   ├── env.ts                 # typed env access
│   └── constants.ts           # HTTP status codes, timezones
├── database/
│   └── connect-db.ts          # singleton mongoose connection
├── models/                    # Mongoose models (User, Task, Project, …)
├── controllers/               # one folder per endpoint
│   ├── auth/login/controller.ts
│   ├── admin/add-user/controller.ts
│   └── …                      (82 total)
├── routes/                    # auto-generated Express routers
│   ├── index.ts               # mounts every domain
│   ├── auth.routes.ts
│   ├── admin.routes.ts
│   └── …
├── middleware/
│   ├── async-handler.ts       # wraps async handlers
│   ├── auth.middleware.ts     # requireAuth / requireRole / optionalAuth
│   ├── cors.ts
│   ├── error-handler.ts       # central error responder
│   ├── upload.ts              # multer (memory) for file uploads
│   └── validate.ts            # Zod-driven validator
├── helpers/                   # email, screenshot diff, project/user helpers
├── utils/                     # pure utilities (date, request, object id)
├── validation/                # Zod schemas
├── auth/                      # JWT signing/verification + types
├── errors/                    # AppError + typed subclasses
├── responses/                 # apiResponse helper
├── logging/                   # logger
├── docs/                      # OpenAPI generator
└── filesystem/                # screenshot storage paths
```

---

## Authentication

The login endpoint (`POST /api/auth/login`) returns a JWT.
Send it on subsequent requests with `Authorization: Bearer <token>`.

`requireAuth`, `requireRole(...)`, and `optionalAuth` middlewares live in
`src/middleware/auth.middleware.ts` and read the token from the
`Authorization` header. Apply them per-route as needed.

---

## File Uploads

Uploads use `multer.memoryStorage()`. Two endpoints currently expect
multipart bodies:

| Endpoint | Field |
| --- | --- |
| `POST /api/task/screen-shot` | `image` |
| `POST /api/common/send-client-excel` | `file` |

---

## Environment Variables

See [`.env.example`](./.env.example). Key vars:

- `MONGODB_URI` — required
- `JWT_SECRET` — required
- `PORT` (default 4000), `API_PREFIX` (default `/api`)
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_EMAIL_FROM` — email features
- `SCREENSHOT_STORAGE_ROOT`, `EXTENSION_SCREENSHOT_ROOT` — storage paths
- `CRYPTO_ENCRYPTION_KEY` — used by `helpers/helpers.ts`

---

## Pushing to the GitHub remote

This project is ready to push to the configured repo:

```bash
git init
git add .
git commit -m "Initial standalone Node.js backend"
git branch -M main
git remote add origin https://github.com/76east-githib/deskscreentime_backend_api.git
git push -u origin main
```

---

## Migration Notes

This codebase was generated from the original Next.js API routes via
[`scripts/migrate-from-dexscreen.cjs`](./scripts/migrate-from-dexscreen.cjs).
A small set of file-upload + helper-function controllers were finalized
manually and are listed in `MANUAL_FIX_FILES` inside that script (so re-running
the migrator preserves them).
