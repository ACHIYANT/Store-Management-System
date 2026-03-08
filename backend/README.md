# Backend Services

Backend layer of the Store Management System, organized as two services:

- `AuthService` (port `3001`)
- `StoreManagementService` (port `3000`)

## Backend Layout

```text
backend/
├── AuthService/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repository/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── migrations/
│   │   └── routes/
│   └── package.json
├── StoreManagementService/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repository/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── migrations/
│   │   └── routes/
│   ├── docs/                  # migration templates and generation scripts
│   └── package.json
└── README.md
```

## Service Responsibilities

## AuthService
- Authentication and session/token issuance
- Role and approval-stage management
- Security middleware (cookies, CSRF, request hardening)
- Forensic audit log APIs and archival support

## StoreManagementService
- Category master (head/group/category)
- Daybook, daybook items, and serials
- Stocks, stock movements, issue and return flows
- Assets and asset events
- Requisition lifecycle and mapping
- Migration APIs (validate + execute)

## API Surface

Base prefixes:
- AuthService: `http://localhost:3001/api/v1`
- StoreManagementService: `http://localhost:3000/api/v1`

Most mutating routes are protected by auth + role checks, and CSRF where configured.

## Local Setup

## Prerequisites
- Node.js 20+
- MySQL 8+
- npm 9+

## AuthService

```bash
cd backend/AuthService
npm install
npm run dev
```

Migration:
```bash
npx sequelize-cli db:migrate --config src/config/config.json --migrations-path src/migrations --models-path src/models --seeders-path src/seeders
```

## StoreManagementService

```bash
cd backend/StoreManagementService
npm install
npm start
```

Migration:
```bash
npx sequelize-cli db:migrate --config src/config/config.json --migrations-path src/migrations --models-path src/models --seeders-path src/seeders
```

## Environment Files

Create `.env` from `.env.example` for each service and set:
- DB connection credentials
- JWT secret + expiry
- cookie/CSRF settings
- CORS allowlist
- upload security settings
- audit retention/archive settings

Do not commit real secrets.

## Migration Utilities (StoreManagementService)

Template generators and samples are under:
- `backend/StoreManagementService/docs/category-master-migration/`
- `backend/StoreManagementService/docs/employee-migration/`
- `backend/StoreManagementService/docs/vendor-migration/`
- `backend/StoreManagementService/docs/opening-stock-migration/`
- `backend/StoreManagementService/docs/issued-migration/`

Recommended process for every bulk migration:
1. Generate/fill template
2. Call `validate` endpoint
3. Fix failed rows
4. Call `execute` endpoint

## Security and Audit Guidelines

- Keep strict role checks on all write routes
- Keep CSRF enabled on mutating requests
- Avoid logging secrets/personal sensitive fields
- Store forensic logs with searchable hot window and cold archive
- Run periodic backup and restore drills

## Troubleshooting

1. Migration shows "already up to date" but schema mismatch exists
- verify `SequelizeMeta` table and migration paths used in command

2. Build/runtime fails in Linux but works on macOS
- check import path case sensitivity (`FileName` vs `filename`)

3. Upload errors returning HTML stack traces
- keep centralized error middleware enabled for structured JSON responses

## Notes

For frontend setup and UI workflows, see `../frontend/README.md`.
For monorepo-level overview, see `../README.md`.
