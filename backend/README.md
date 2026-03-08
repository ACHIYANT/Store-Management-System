# SMS - Store Management Suite

A multi-service inventory and requisition platform with:
- `AuthService` for identity, roles, approval-stage configuration, and forensic audit logs
- `StoreManagementService` for daybook, stock, issue/return, requisitions, migrations, and operational audit trails
- `frontend` (React + Vite) for role-based UI and operational workflows

This repository is structured as a practical monorepo where backend services and frontend evolve together.

## Repository Structure

```text
sms/
├── backend/
│   ├── AuthService/
│   ├── StoreManagementService/
│   ├── FLOW_SWIMLANE.md
│   ├── DB_ERD.md
│   └── ...
└── frontend/
```

## Core Functional Areas

1. Authentication and Authorization
- Sign-in/sign-up and role assignment
- Approval stage master and flow-type support
- Cookie-based auth support + CSRF integration
- Forensic audit event capture

2. Procurement and Inventory
- Daybook entries with multi-stage approval
- Item category head/group/category master hierarchy
- Stock lots + issue + return + retain/lost flows
- Asset records + asset events + serial tracking

3. Requisition Management
- Employee digital requisitions
- Multi-level approvals (division/admin/store flows)
- Store mapping of requisition items to stock/category
- Requisition queue/history/detail and timeline tracking

4. Data Migration Utilities
- Opening stock migration (validate + execute)
- Issued-items migration (validate + execute)
- Employee migration (validate + execute)
- Vendor migration (validate + execute)
- Category master migration (validate + execute)

5. Security and Audit
- CSRF checks for state-changing requests
- Role-aware access middleware
- Upload validation and safe error handling
- Forensic logs with searchable window + archive path

## Tech Stack

### Backend
- Node.js, Express
- Sequelize ORM
- MySQL
- Multer (uploads)
- XLSX/ExcelJS (migration templates)

### Frontend
- React 19 + Vite
- React Router
- Tailwind + component-level UI utilities

## Local Development

## Prerequisites
- Node.js 20+
- MySQL 8+
- npm 9+

## 1) AuthService

```bash
cd backend/AuthService
npm install
npm run dev
```

Runs by default on `http://localhost:3001`.

## 2) StoreManagementService

```bash
cd backend/StoreManagementService
npm install
npm start
```

Runs by default on `http://localhost:3000`.

## 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs by default on `http://localhost:5173`.

## Database Migrations

AuthService:
```bash
cd backend/AuthService
npx sequelize-cli db:migrate --config src/config/config.json --migrations-path src/migrations --models-path src/models --seeders-path src/seeders
```

StoreManagementService:
```bash
cd backend/StoreManagementService
npx sequelize-cli db:migrate --config src/config/config.json --migrations-path src/migrations --models-path src/models --seeders-path src/seeders
```

## Environment Configuration

Create `.env` from `.env.example` in each service and fill production-grade values.

Minimum environment groups to set:
- Database: host, port, user, password, db name
- JWT: secret key and expiry
- CORS: explicit frontend origins (no wildcard in production)
- Cookies/CSRF: secure flags and trusted origins
- Upload security: file encryption secret and max limits
- Forensic logging: retention and archive settings

Do not commit real `.env` files.

## Operational Workflow (High-Level)

1. Category master setup -> heads/groups/categories
2. Daybook entry -> approval -> stock lot creation
3. Employee requisition -> approval chain -> store mapping
4. Issue from stock -> issued item + stock movement + optional asset event
5. Return/retain/lost -> stock/asset movement updates + audit logs

## Data Migration Workflow (Recommended)

For every migration API:
1. Generate template from docs script
2. Fill sheet with validated master values
3. Call `validate` endpoint first
4. Fix all failed rows
5. Call `execute` endpoint

Use execute APIs in transaction mode (all-or-none) for consistency.

## Security Baseline

- Use HttpOnly secure cookies in production
- Enforce CSRF for mutating requests
- Enforce role checks at route and service layers
- Never log plaintext passwords or sensitive secrets
- Keep upload directories outside version control
- Add regular database backups and restore drills

## What To Commit / What Not To Commit

Commit:
- Source code in `backend/**/src` and `frontend/src`
- Migration files, seeders, models, routes, services, docs scripts
- `package.json`, `package-lock.json`, `.env.example`, markdown docs

Never commit:
- `.env`
- `uploads/` content
- `.DS_Store`
- backup zips (`*.zip`)
- local build artifacts (`dist`, `.vite`, logs)

## Suggested Next Improvements

1. Add root-level `.gitignore` for monorepo-wide protection
2. Add CI checks for lint + migration validation
3. Add OpenAPI docs for both backend services
4. Add smoke tests for critical flows (signin, daybook, issue, requisition)

## Contributors

Internal team at HARTRON Store Management initiative.

