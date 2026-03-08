# Frontend Application

React + Vite client for the Store Management System.

This UI drives daybook operations, stock and issue flows, requisitions, migrations, and role-based dashboards.

## Stack

- React 19
- Vite 6
- React Router
- Tailwind CSS v4
- Axios
- React Hook Form
- Radix UI primitives + custom components

## Frontend Layout

```text
frontend/
├── public/
├── src/
│   ├── auth/                 # route guards
│   ├── components/           # reusable UI and forms
│   ├── hooks/                # list/windowing and utility hooks
│   ├── lib/                  # network utilities
│   ├── pages/                # route pages
│   ├── constants/
│   └── utils/
├── .vscode/
├── package.json
└── README.md
```

## Key Functional Areas

1. Role-based navigation and access control
- Protected routes
- Role-aware menu visibility and page actions

2. Operational modules
- Daybook entry and updates
- MRN and verification views
- Stock and issue workflows
- Asset tracking and event timelines
- Requisition inbox/queue/history

3. Migration UX support
- Template-driven data ingestion workflows
- Validate-first and execute-later operational pattern

4. Dashboard and reporting
- User-centric and store-centric dashboard sections
- Stock/out-of-stock and issued-item reporting

## Local Development

## Install
```bash
cd frontend
npm install
```

## Run dev server
```bash
npm run dev
```

Default URL: `http://localhost:5173`

## Build
```bash
npm run build
```

## Lint
```bash
npm run lint
```

## Environment

Use `.env.example` as reference. Typical variables:
- frontend API base URLs
- optional feature flags
- optional build-time environment controls

Never commit real environment secrets.

## API Integration

Frontend talks to:
- AuthService: `http://localhost:3001/api/v1`
- StoreManagementService: `http://localhost:3000/api/v1`

Network/client helpers are maintained in `src/lib/network.js`.

## UI and Data Notes

- Large tables use cursor/windowed patterns in performance-sensitive pages.
- Form-heavy modules use controlled validation + popup feedback.
- Linux CI is case-sensitive; keep import casing exactly equal to file names.

## VS Code Notes (Tailwind v4)

Tailwind v4 uses directives such as `@theme`, `@custom-variant`, and `@apply`.
Workspace settings are included to suppress false CSS linter warnings in Problems tab:
- `frontend/.vscode/settings.json`
- `.vscode/settings.json` (repo root)

## Troubleshooting

1. Build fails with "Could not load ..." in CI
- check import path case exactly matches file name

2. Login/API requests remain pending
- verify AuthService is running and CORS/cookie settings match frontend origin

3. CSRF token issues
- verify CSRF endpoint call is successful and request headers/cookies are sent

4. Table flicker between loader/no-data
- check page-level loading flags and async data state transitions

## Related Docs

- Backend details: `../backend/README.md`
- Monorepo overview: `../README.md`
