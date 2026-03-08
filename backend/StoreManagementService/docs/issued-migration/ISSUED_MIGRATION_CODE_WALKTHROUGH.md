# Issued Migration - Function-Wise Technical Explanation

This guide explains the migration code in the way you asked:
- each function and its purpose,
- which helper/pre-functions it uses,
- why those helpers are needed,
- important technical concepts behind it.

Covered files:
- `StoreManagementService/src/controllers/migration-controller.js`
- `StoreManagementService/src/controllers/issued-migration-controller.js`
- `StoreManagementService/src/services/issued-migration-service.js`
- route/auth context from `StoreManagementService/src/routes/v1/index.js` and `StoreManagementService/src/middlewares/auth-middleware.js`

---

## Latest Input Format (Current)

Issued migration now supports a **single-sheet format** for upload:
- sheet name: `issued_items` (default),
- one `item_type` column decides row mode:
  - `Asset` (serialized),
  - `Consumable` (non-serialized).

Employee-wise block entry is supported:
- put employee details once,
- keep `employee_emp_id` / `employee_name` / `division` blank in subsequent rows,
- controller carries forward those values until next employee block starts.

Template now includes:
- `category_master` sheet with all category names from seeded master data,
- strict in-cell dropdown validations in `issued_items` for:
  - `item_type` (`Asset`, `Consumable`)
  - `category_name` (from category master list)
- `issued_items` and `category_master` also have header filter drop-downs for quick search/filter in Excel.

Notes:
- `item_master_id` / `item_code` are optional but preferred in upload; backend uses them first for exact mapping.
- `category_id` is optional in upload; backend resolves category by `category_name`.
- `stock_id` is optional; backend can map by `item_name` (plus category context).
- `asset_tag` is optional for new Asset rows. If blank, migration auto-generates an asset tag after asset creation.

Legacy two-sheet format (`assets_issued` + `consumables_issued`) is still accepted for backward compatibility.

---

## 1) Route/Auth Context (How requests reach these functions)

### Route: legacy stock migration
- `POST /migration/upload`
- calls `uploadMigrationFile` from `migration-controller.js`

### Routes: issued-items migration
- `POST /migration/issued-items/validate`
- `POST /migration/issued-items/execute`
- both call handlers from `issued-migration-controller.js`

### Pre-check middleware used before issued migration handlers
1. `ensureAuth`
- validates token and sets `req.user`

2. `requireAdminOperations`
- alias of `requireAnyRole(["SUPER_ADMIN"])`
- only SUPER_ADMIN can run these migration endpoints

3. `upload.single("file")`
- Multer middleware to parse multipart form-data and save uploaded Excel in temp path
- controller reads it via `req.file.path`

---

## 2) `migration-controller.js` (existing stock migration flow)

### Function: `uploadMigrationFile(req, res)`

Purpose:
- handles Excel upload for opening/current stock migration using old migration service.

Uses (pre-functions/dependencies):
1. `XLSX.readFile(filePath)`
- reads workbook from disk.

2. `XLSX.utils.sheet_to_json(sheet)`
- converts first sheet into row objects.

3. `service.migrate(rows)` from `MigrationService`
- business logic for stock/assets opening migration.

4. `fs.unlinkSync(filePath)`
- deletes temp upload file after processing.

Flow:
1. checks feature flag `ENABLE_MIGRATION`.
2. takes uploaded file path.
3. reads first sheet only.
4. converts sheet to `rows`.
5. throws if empty.
6. calls `migrate(rows)`.
7. deletes file.
8. returns result JSON.

Why this function exists:
- single endpoint entry point for stock opening migration.

Technical notes:
- uses sync file delete (`unlinkSync`) after successful migration.
- if error occurs before delete, temp file may remain (your issued controller improves this via `finally` cleanup).

---

## 3) `issued-migration-controller.js` (new issued migration entry layer)

This controller is only HTTP/Excel orchestration.  
It does not contain DB business rules; those are in service.

### Function: `removeFileSafe(filePath)`

Purpose:
- safely delete uploaded temp file.

Uses:
- `fs.existsSync` and `fs.unlinkSync`.

Why needed:
- cleanup must happen in both success and error paths.
- prevents temp-upload accumulation.

Technical note:
- errors during cleanup are logged, not thrown.

---

### Function: `resolveSheetName(workbook, preferred)`

Purpose:
- resolve sheet name robustly (exact or case-insensitive).

Uses:
- `workbook.SheetNames.find(...)`.

Why needed:
- users may upload sheets with case variation (`Assets_Issued`, `assets_issued`, etc.).

---

### Function: `readRows(workbook, sheetName)`

Purpose:
- read rows from one sheet.

Uses:
- `XLSX.utils.sheet_to_json(sheet, { defval: null })`.

Why `{ defval: null }`:
- empty Excel cells become explicit `null`, helpful for consistent validation.

---

### Function: `parseBoolean(value, fallback=false)`

Purpose:
- parse form body booleans (`"true"`, `"1"`, `"yes"` etc.).

Why needed:
- multipart form fields arrive as strings.

---

### Function: `buildPayloadFromFile(filePath, body={})`

Purpose:
- build normalized payload for service methods.

Uses helper/pre-functions:
1. `XLSX.readFile`
2. `resolveSheetName`
3. `readRows`
4. `parseBoolean`

What it returns:
1. `assetsRows` from `assets_issued` or first sheet fallback.
2. `consumableRows` from optional `consumables_issued`.
3. `options.adjustStock`.
4. `options.createStockIfMissing`.
5. `meta` (sheet names used).

Why needed:
- keeps endpoint handlers small and consistent.

---

### Function: `ensureMigrationEnabled(res)`

Purpose:
- centralized feature-flag gate.

Uses:
- `process.env.ENABLE_MIGRATION`.

Behavior:
- if disabled => returns `403` and `false`.
- else returns `true`.

Why needed:
- migration endpoints should be switchable at runtime.

---

### Function: `validateUpload(req, res)`

Purpose:
- dry-run endpoint; checks data without writing DB.

Uses pre-functions:
1. `ensureMigrationEnabled`
2. `buildPayloadFromFile`
3. `service.validate(payload)`
4. `removeFileSafe` in `finally`

Flow:
1. feature flag check.
2. file presence check.
3. parse workbook payload.
4. reject if both sheets empty.
5. call service validate.
6. return validation summary + details.
7. always cleanup temp file.

Why needed:
- lets store team correct errors before execute.

---

### Function: `executeUpload(req, res)`

Purpose:
- actual migration endpoint; writes DB records.

Uses pre-functions:
1. `ensureMigrationEnabled`
2. `buildPayloadFromFile`
3. `service.execute(payload)`
4. `removeFileSafe` in `finally`

Flow is same as validate, except it calls execute.

Why needed:
- separate dry-run and write paths make migration safer.

---

## 4) `issued-migration-service.js` (core migration business logic)

Class: `IssuedMigrationService`

Role:
- converts input rows into DB operations.
- enforces data rules.
- handles serialized and consumable migrations separately.

Constant:
- `SOURCE_FLAG = "MIGRATION_ISSUED"`
- used in audit notes to identify source.

---

### Static Helper: `normalizeKey(key)`

Purpose:
- normalize Excel header keys for flexible matching.

How:
- trim + lowercase + spaces to underscore.

Example:
- `"Employee Emp ID"` -> `"employee_emp_id"`.

---

### Static Helper: `toBool(value, fallback=false)`

Purpose:
- generic bool parsing inside service.

Why duplicated from controller:
- service can be called from other contexts, so it keeps own safe parsing.

---

### Static Helper: `toInteger(value)`

Purpose:
- strict integer parser (rejects decimals, NaN, empty).

Why important:
- employee id, stock id, quantity must be true integers.

---

### Static Helper: `parseDate(value)`

Purpose:
- parse issue date from different Excel representations.

Supports:
1. JS Date
2. Excel serial number
3. date string

Why needed:
- migration files may have mixed date formats.

---

### Static Helper: `normalizeRow(rawRow, rowNo)`

Purpose:
- transform one raw row object into canonical shape used by processors.

Uses:
1. key normalization
2. alias resolver `get(...)`
3. integer parsers

Important aliases it supports:
- `employee_emp_id / employee_id / emp_id`
- `serial_number / serial_no`
- `quantity / qty`
- `source_ref / source_reference / ref_no`

Why needed:
- prevents strict template dependency; supports slight header variations.

---

### Method: `_buildSheetRows(sheetRows)`

Purpose:
- normalize all rows of one sheet.

Behavior:
1. maps through `normalizeRow`.
2. row number starts at `2` (header on row 1).
3. filters fully empty rows.

Why needed:
- downstream processors expect clean normalized rows.

---

### Method: `_buildEventNotes({sourceRef, remarks})`

Purpose:
- builds consistent `AssetEvent.notes`.

Output pattern:
- `MIGRATION_ISSUED | source_ref:XYZ | user remarks`

Why needed:
- future traceability in timeline and audits.

---

### Method: `_normalizeSerial(value)` and `_normalizeText(value)`

Purpose:
- safe trim + null conversion for text fields.

Why needed:
- Excel may carry whitespace-only strings.

---

### Method: `_findCategory({categoryId, categoryName}, transaction)`

Purpose:
- resolve category with ID-first strategy.

Why ID-first:
- deterministic and safer than name matching.

Uses:
- `ItemCategory.findByPk` or `findOne`.

---

### Method: `_findStock({stockId, itemName, categoryId}, transaction)`

Purpose:
- resolve stock from row mapping.

Order:
1. if `stockId` present -> fetch active stock directly.
2. else search by `item_name` (+ optional category constraint).

Why needed:
- supports both strict-id input and legacy-name input.

---

### Method: `_resolveCommon({row, options, transaction, writeMode})`

Purpose:
- common resolver shared by serialized and consumable processors.

What it validates/resolves:
1. employee id presence.
2. employee existence.
3. category resolution.
4. stock resolution.
5. optional stock auto-create when enabled.
6. category-stock mismatch checks.
7. issue date parse check.

Pre-functions used:
- `_findCategory`
- `_findStock`
- `toBool`
- `parseDate`
- `_normalizeText`

Technical concepts:
1. `writeMode=false` (dry-run):
- returns a “would create stock” marker without writing.

2. `writeMode=true` (execute):
- can actually create stock when `createStockIfMissing=true`.

Why needed:
- avoids duplicate code and keeps both processors consistent.

---

### Method: `_processSerializedRow({row, options, dryRun=false})`

Purpose:
- process one row from serialized sheet (`assets_issued`).

Core steps:
1. validate serial/asset_tag presence.
2. start transaction if execute mode.
3. resolve employee/category/stock/date via `_resolveCommon`.
4. try to find existing asset by serial or asset tag.
5. enforce stock match if asset exists.
6. enforce state rules:
   - if already issued to same employee => `skipped`.
   - if issued to other employee => fail.
   - invalid statuses fail.
7. if dry-run => return preview result.
8. execute mode:
   - create asset if missing or update existing asset.
   - optional stock decrement if `adjustStock=true`.
   - create `IssuedItem` quantity `1`.
   - create linked `AssetEvent` (`event_type="Issued"`).
9. commit transaction.
10. rollback on error.

Pre-functions/helpers used:
- `_normalizeSerial`
- `_normalizeText`
- `_resolveCommon`
- `_buildEventNotes`
- `toBool`

Technical details:
1. row-level transaction:
- each row isolated; one failure does not rollback other rows.

2. lock usage:
- stock/asset reads in write flow use transaction locks to reduce race issues.

3. daybook links:
- `daybook_id` and `daybook_item_id` are set to `null` intentionally for migrated issued data.

4. idempotency-lite behavior:
- if same asset already issued to same employee => skip, not fail.

---

### Method: `_processConsumableRow({row, options, dryRun=false})`

Purpose:
- process one row from consumable sheet (`consumables_issued`).

Core steps:
1. validate quantity integer > 0.
2. start transaction if execute mode.
3. resolve common entities via `_resolveCommon`.
4. dry-run => preview.
5. execute mode:
   - optional stock decrement by quantity.
   - create `IssuedItem`.
   - no `AssetEvent` (no per-asset identity).
6. commit/rollback.

Pre-functions/helpers used:
- `toInteger`
- `_resolveCommon`
- `toBool`

Why no `AssetEvent`:
- asset events require `asset_id`; consumables don’t map one-by-one to asset rows.

---

### Method: `_processRows({rows, type, options, dryRun})`

Purpose:
- generic row-loop orchestration.

What it does:
1. loops every normalized row.
2. routes to serialized or consumable processor.
3. captures status and message per row.
4. counts imported/skipped/failed.

Why needed:
- single aggregation utility for both validate and execute.

---

### Method: `validate({assetsRows=[], consumableRows=[], options={}})`

Purpose:
- full dry-run for both sheets.

Flow:
1. normalize both sheets.
2. call `_processRows(...dryRun:true)` for serialized and consumables.
3. combine details.
4. return summary:
   - total rows
   - ready rows
   - failed rows

Why needed:
- safe preview before DB writes.

---

### Method: `execute({assetsRows=[], consumableRows=[], options={}})`

Purpose:
- real DB write flow for both sheets.

Flow:
1. normalize both sheets.
2. run `_processRows(...dryRun:false)` for each sheet.
3. aggregate details and counters.
4. return execution summary.

Why needed:
- production migration operation.

---

## 5) Technical Concepts Used in This Module

### 1. Feature flag (`ENABLE_MIGRATION`)
- runtime on/off switch for all migration APIs.

### 2. Dry-run pattern
- same input parsing, but no DB writes.
- used for safe validation.

### 3. Row-level transactions
- each row has its own transaction in execute mode.
- gives partial success behavior.

### 4. Pessimistic locking
- locks selected rows during stock adjustment/update to avoid concurrent corruption.

### 5. Idempotent skip behavior (partial)
- duplicate row where asset already with same employee is skipped.

### 6. Structured per-row result output
- response includes row status for correction and re-upload.

### 7. Separation of concerns
- controller handles HTTP + file parsing.
- service handles business and DB logic.

### 8. Backward-friendly header parsing
- alias-based field mapping supports minor Excel format variation.

---

## 6) Quick Practical Notes for You

1. If you want strict template only:
- remove alias flexibility in `normalizeRow`.

2. If you want hard idempotency:
- add migration batch tables and unique `source_ref` constraints.

3. If you want all-or-nothing file behavior:
- move from per-row transactions to per-file transaction (not recommended for large files).

4. If stock migration already means in-store-only quantities:
- run execute with `adjustStock=false` for issued migration.
