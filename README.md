# Store Management System

A production-oriented monorepo for inventory, procurement, requisition approvals, and asset lifecycle management.

This repository contains:
- `backend/AuthService`: identity, roles, approval-stage configuration, cookie auth, CSRF, forensic audit logging
- `backend/StoreManagementService`: daybook, stock, issue/return, asset events, gate pass, migrations, requisitions
- `frontend`: React + Vite application for role-based operations and reporting

## Monorepo Structure

```text
sms/
├── .github/                  # CI workflows and PR template
├── docs/                     # high-level architecture and shared docs
├── backend/
│   ├── AuthService/
│   ├── StoreManagementService/
│   └── README.md
└── frontend/
    └── README.md
```

## Core Capabilities

1. Authentication and access control
- Role-based access (`SUPER_ADMIN`, approvers, store roles, user roles)
- Cookie-based auth and CSRF protection
- Approval-stage management for workflow routing

2. Inventory and procurement
- Daybook entry and approval lifecycle
- Category hierarchy: head -> group -> category
- Stock lot tracking with issue, return, retain, lost flows
- Serialized and non-serialized handling

3. Asset and movement tracking
- Asset creation and asset event timeline
- Stock movement log for quantity deltas and auditability
- Gate pass and MRN verification flows

4. Migration framework
- Validate + execute pattern for safe bulk ingestion
- Templates for category master, vendors, employees, opening stock, issued items
- Transactional execution (all-or-none) for data consistency

5. Security and forensic audit
- Request context tracking
- Forensic logs with hot window + archive strategy
- Secure upload middleware and controlled error output

## Technology Stack

### Backend
- Node.js + Express
- Sequelize ORM
- MySQL 8+
- Multer / ExcelJS / XLSX

### Frontend
- React 19 + Vite
- React Router
- Tailwind CSS v4
- Axios

## Quick Start

## Prerequisites
- Node.js 20+
- npm 9+
- MySQL 8+

## 1) Clone and Install

```bash
git clone <your-repo-url>
cd sms

cd backend/AuthService && npm install
cd ../StoreManagementService && npm install
cd ../../frontend && npm install
```

## 2) Configure Environment

Create `.env` files from `.env.example`:
- `backend/AuthService/.env`
- `backend/StoreManagementService/.env`
- `frontend/.env` (if required by your setup)

Never commit real `.env` files.

## 3) Run Database Migrations

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

## 4) Start Services

```bash
# Terminal 1
cd backend/AuthService
npm run dev

# Terminal 2
cd backend/StoreManagementService
npm start

# Terminal 3
cd frontend
npm run dev
```

Default local URLs:
- AuthService: `http://localhost:3001`
- StoreManagementService: `http://localhost:3000`
- Frontend: `http://localhost:5173`

## Testing and Quality

Frontend:
```bash
cd frontend
npm run lint
npm run build
```

Backend services can be smoke-tested by hitting health/startup routes and critical APIs in Postman.

## Branch and Release Workflow

Recommended workflow:
- `main`: production-ready
- `develop`: integration/staging
- `feature/<module>-<name>`: new work
- `fix/<module>-<bug>`: bug fixes
- `hotfix/<issue>`: urgent production fixes from `main`

Merge strategy:
1. Push branch
2. Open PR to `develop`
3. Pass CI + review
4. Squash merge
5. Periodically PR `develop -> main`
6. Tag release (example: `v1.0.0`)

## Documentation

- Backend guide: `backend/README.md`
- Frontend guide: `frontend/README.md`
- Shared architecture note: `docs/ARCHITECTURE.md`
- Migration templates: `backend/StoreManagementService/docs/*`

## Security Baseline Checklist

- Use strong JWT/cookie secrets
- Use strict CORS origin allowlist
- Keep CSRF enabled for mutating requests
- Keep uploads and runtime artifacts out of git
- Rotate secrets and test DB restore procedures periodically

## License

Private/internal project unless explicitly published under a separate license.
