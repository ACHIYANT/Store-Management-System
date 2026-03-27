# Location Scope Implementation Explained

This document explains **all location-scope related changes** done on this branch.

It covers:

- why the change was needed
- which file was changed
- what was added or changed in that file
- a simple example for each important piece

This is not only the last patch. It covers the **full location-aware implementation chain**:

- how a user gets location responsibility
- how that information reaches StoreManagement
- how records are stamped with `location_scope`
- how lists, approvals, issues, assets, gate passes, and migrations are restricted by location

## 1. Problem We Solved

Earlier, the system mainly knew:

- user
- role
- division

That was not enough for a strict multi-location office.

Example problem:

- Panchkula store user could accidentally see or act on Chandigarh data if we only checked role and not location.

The goal of this implementation was:

- every important operational record should carry a `location_scope`
- every non-super-admin user should be restricted to their assigned location(s)
- Panchkula records should stay with Panchkula users
- Chandigarh records should stay with Chandigarh users
- stock, issue, assets, gate pass, requisition, e-waste, MRN, and daybook should all stay in the same location chain

## 2. End-to-End Example

Example: `Panchkula`

1. A super admin assigns User A as `STORE_INCHARGE` for Panchkula.
2. That assignment is saved in AuthService.
3. When User A logs in, AuthService returns that assignment in `/users/isAuthenticated`.
4. StoreManagement reads the assignment and learns User A has access to Panchkula.
5. User A creates a daybook entry.
6. The daybook is stamped with `location_scope = PANCHKULA`.
7. When approved, stock created from that daybook is also stamped with `location_scope = PANCHKULA`.
8. If User A issues stock to an employee, the employee/custodian must also belong to Panchkula.
9. Asset events, issued items, and gate passes created from that stock also stay in Panchkula.
10. A Chandigarh user will not see those records in normal lists because every list query is filtered by allowed locations.

That is the full idea behind the changes below.

## 3. AuthService Changes

AuthService now has the concept of **organizational assignments**.

This is different from normal login roles.

Example:

- `SUPER_ADMIN` = what the account is allowed to do
- `STORE_INCHARGE @ PANCHKULA` = what current responsibility the person holds

### 3.1 `AuthService/src/constants/table-names.js`

Change:

- added `ORG_ASSIGNMENT_TABLE: "OrgAssignments"`
- added `USER_LOCATION_SCOPE_TABLE: "UserLocationScopes"`

Why:

- we needed a dedicated table name constant for storing organization responsibilities like:
  - division head
  - vehicle driver
  - location incharge
  - store incharge

Example:

- User 12 can have one row in `Users`
- and multiple rows in `OrgAssignments`
- and multiple rows in `UserLocationScopes`

### 3.2 `AuthService/src/models/user.js`

Change:

- added `User.hasMany(models.OrgAssignment, { as: "orgAssignments" ... })`
- added `User.hasMany(models.UserLocationScope, { as: "userLocationScopes" ... })`

Why:

- now when we load a user, we can also load the user’s active responsibilities

Example:

- User 12 may have:
  - role: `USER`
  - role: `SUPER_ADMIN`
  - location access: `PANCHKULA`
  - assignment: `LOCATION_INCHARGE @ PANCHKULA`

### 3.2A `AuthService/src/models/userlocationscope.js` (new)

Change:

- created a new Sequelize model for `UserLocationScopes`

Important fields:

- `user_id`
- `location_scope`
- `scope_label`
- `active`
- `effective_from`
- `effective_to`
- `created_by_user_id`
- `ended_by_user_id`

Why:

- operational access to a location is not the same thing as a role
- and also not the same thing as an organizational responsibility

Example:

- a generic store login can now have:
  - role: `STORE_ENTRY`
  - location access: `PANCHKULA`

without pretending that it is a divisional head or another responsibility holder

### 3.3 `AuthService/src/models/orgassignment.js` (new)

Change:

- created a new Sequelize model for `OrgAssignments`

Important fields:

- `user_id`
- `assignment_type`
- `scope_type`
- `scope_key`
- `scope_label`
- `metadata_json`
- `active`
- `effective_from`
- `effective_to`
- `created_by_user_id`
- `ended_by_user_id`

Why:

- roles alone were not enough
- this table stores current posting/responsibility

Example:

- `assignment_type = STORE_INCHARGE`
- `scope_type = LOCATION`
- `scope_key = PANCHKULA`
- `scope_label = Panchkula`
- `metadata_json = { "location": "Panchkula" }`

### 3.4 `AuthService/src/migrations/20260323120000-create-org-assignments.js` (new)

Change:

- creates the `OrgAssignments` table
- adds indexes for:
  - active lookup by scope
  - active lookup by user and assignment type

Why:

- without this table there is no structured place to store location-specific responsibilities

Example:

- fast lookup for:
  - who is current `STORE_INCHARGE` of Panchkula?
  - what active responsibilities does User 12 currently hold?

### 3.5 `AuthService/src/migrations/20260323121000-add-vehicle-driver-role.js` (new)

Change:

- adds `VEHICLE_DRIVER` role to `Roles`

Why:

- vehicle responsibility was added to the same assignment system

Example:

- Vehicle 1 driver can be User 3 now
- later Vehicle 1 driver can become User 4
- history stays in assignment rows

### 3.6 `AuthService/src/migrations/20260326101500-add-org-assignment-managed-roles.js` (new)

Change:

- adds:
  - `DIVISION_CUSTODIAN`
  - `LOCATION_INCHARGE`
  - `STORE_INCHARGE`

Why:

- these are assignment-managed roles
- they are not meant to be manually added through ordinary role editing

Example:

- if someone becomes `STORE_INCHARGE` of Panchkula, we record it through assignment, not by random DB editing

### 3.6A `AuthService/src/migrations/20260326150000-create-user-location-scopes.js` (new)

Change:

- creates the `UserLocationScopes` table
- adds indexes for:
  - active lookup by user
  - active lookup by location
  - active lookup by user + location

Why:

- role-based operational accounts need explicit location access
- and that should be stored directly instead of inferred at runtime

Example:

- one store account can have:
  - `PANCHKULA`
- another inspection account can have:
  - `PANCHKULA`
  - `CHANDIGARH`

### 3.7 `AuthService/src/constants/org-assignments.js` (new)

Change:

- introduced supported scope types:
  - `DIVISION`
  - `VEHICLE`
  - `CUSTODIAN`
  - `LOCATION`
  - `GLOBAL`

- introduced assignment types:
  - `DIVISION_HEAD`
  - `DIVISION_CUSTODIAN`
  - `VEHICLE_DRIVER`
  - `LOCATION_INCHARGE`
  - `STORE_INCHARGE`
  - `GLOBAL`

- defined rules like:
  - allowed scope types for each assignment
  - whether one user can hold multiple active assignments of the same type

Why:

- this file is the central rulebook for assignment behavior

Important business behavior:

- `DIVISION_HEAD.singleActivePerUser = false`

This means:

- one user can hold charge of multiple divisions

Example:

- one person can be divisional head of:
  - Accounts Division, Panchkula
  - Requirement Division, Panchkula
  - Procurement Division, Panchkula

### 3.8 `AuthService/src/repository/org-assignment-repository.js` (new)

Change:

- added DB operations for:
  - list assignments
  - load active assignment by scope
  - load active assignment by user/type
  - create assignment
  - end assignment

Why:

- service layer needs a clean repository to enforce rules safely

Example:

- when a new store incharge is assigned to Panchkula:
  - old active Panchkula store-incharge row is found
  - it is ended
  - new row is created

### 3.9 `AuthService/src/services/org-assignment-service.js` (new)

Change:

- added the main assignment logic

Important behavior:

- validates supported `assignment_type`
- validates supported `scope_type`
- normalizes `scope_key`
- writes location data into `metadata_json`
- enforces one-active-holder-per-scope rules
- syncs managed role assignment automatically

Why:

- this is where “business meaning” is enforced

Example:

- if you assign:
  - `STORE_INCHARGE`
  - `scope_type = LOCATION`
  - `scope_key = PANCHKULA`

then the system makes sure:

- the location is normalized
- the previous active Panchkula store incharge is ended
- the new user becomes the active holder

### 3.10 `AuthService/src/repository/user-repository.js`

Change:

- signup now auto-adds the default `USER` role in one transaction
- user loading now includes active `orgAssignments`
- user loading now includes active `userLocationScopes`
- user listing includes active assignments
- user listing includes active account-level location scopes
- manual role assignment/removal is aware of assignment-managed roles
- added explicit account location-scope assignment/removal methods

Why:

- new accounts should not need manual SQL insert into `User_Roles`
- AuthService also needs to send assignments back to StoreManagement

Example:

- new signup automatically becomes `USER`
- later super admin can add:
  - location access separately
  - responsibilities separately

### 3.11 `AuthService/src/services/user-service.js`

Change:

- added `serializeAssignments`
- added `serializeLocationScopes`
- `isAuthenticated()` now returns active assignments
- `isAuthenticated()` now also returns explicit `location_scopes`
- user list API now returns roles + assignments
- user list API now returns roles + location scopes + assignments
- role catalog marks whether a role is assignment-managed
- added service methods to assign/remove account-level location scopes

Why:

- StoreManagement needs assignment info during every authenticated request

Example:

- login response can now indirectly support:
  - “this user is allowed only in PANCHKULA”
  - without requiring a responsibility assignment just to grant location access

### 3.12 `AuthService/src/controllers/user-controller.js`

Change:

- exposes role-management related endpoints used by Access Control UI
- exposes account location-scope management endpoints used by Access Control UI

Why:

- super admin needed a UI-safe API to manage user roles and review users

### 3.13 `AuthService/src/controllers/org-assignment-controller.js` (new)

Change:

- added endpoints to:
  - list org assignments
  - create org assignments
  - end org assignments

Why:

- super admin needs a backend API for assignment-based responsibility management

### 3.14 `AuthService/src/routes/v1/index.js`

Change:

- added:
  - `GET /users`
  - `GET /roles`
  - `GET /users/:userId/roles`
  - `GET /users/:userId/location-scopes`
  - `POST /users/:userId/roles`
  - `POST /users/:userId/location-scopes`
  - `DELETE /users/:userId/roles/:roleName`
  - `DELETE /users/:userId/location-scopes/:locationScope`
  - `GET /org-assignments`
  - `POST /org-assignments`
  - `PATCH /org-assignments/:assignmentId/end`

- kept these behind `requireAdminOperations`

Important:

- `requireAdminOperations` is already `SUPER_ADMIN` only

Why:

- only super admin should control roles and location responsibilities

## 4. Frontend Changes For Assignment / Location Management

These changes are not directly filtering data in the store APIs, but they are part of the full location implementation because they provide the UI for assigning responsibility.

### 4.1 `frontend/src/App.jsx`

Change:

- added the `AccessControl` page route
- protected it with `SUPER_ADMIN`

Why:

- only super admin can manage assignments and role escalation

### 4.2 `frontend/src/components/Sidebar.jsx`

Change:

- added sidebar access rule for `access-control`
- only `SUPER_ADMIN` sees it

Why:

- location responsibility should not be editable by ordinary admin/store accounts

### 4.3 `frontend/src/pages/AccessControl.jsx` (new)

Change:

- created UI for:
  - listing users
  - manual role assignment
  - manual account location access assignment
  - assignment-based responsibility creation
  - ending active responsibilities

Important support added:

- supported responsibility types:
  - `DIVISION_HEAD`
  - `DIVISION_CUSTODIAN`
  - `VEHICLE_DRIVER`
  - `LOCATION_INCHARGE`
  - `STORE_INCHARGE`
  - `GLOBAL`

- loads:
  - users from AuthService
  - roles from AuthService
  - division and vehicle custodians from StoreManagement

Why:

- this is the UI where super admin can say:
  - “User A handles Panchkula”
  - “User B is divisional head of Accounts Division”
  - “User C is driver of Vehicle 1”

Example:

- assign `STORE_INCHARGE`
- scope type = `LOCATION`
- scope value = `Panchkula`

result:

- that user’s authenticated payload will later include location assignment for Panchkula

Another example:

- assign location access:
  - `Panchkula`

result:

- that account can operate on Panchkula records even if it is just a role-based
  operational account like `STORE_ENTRY`

## 5. StoreManagement Authentication Bridge

### 5.1 `StoreManagementService/src/middlewares/auth-middleware.js`

Change:

- when StoreManagement calls AuthService for the current user, it now keeps:
  - `roles`
  - `assignments`
- `location_scopes`
- if explicit `location_scopes` are present, they are used as the primary source
- if no explicit `location_scopes` are present, it safely falls back to the
  local `Employee.office_location` using the authenticated `empcode`
- the resolved fallback is attached as:
  - `location_scopes`
  - `office_location_scope`
  - `location_scope_source`

Why:

- StoreManagement cannot enforce location rules unless it knows the user’s assignments
- ordinary employee accounts should not require manual location assignment if
  their employee master already has a valid office location
- non-employee service accounts should still stay blocked until a super admin
  assigns them explicitly

Example:

- Store service receives:
  - `roles = ["STORE_ENTRY"]`
  - `location_scopes = ["PANCHKULA"]`
  - `assignments = [{ assignment_type: "STORE_INCHARGE", metadata_json: { location: "Panchkula" } }]`

Then it can restrict data to Panchkula only.

Another example:

- Auth user:
  - `roles = ["USER"]`
  - `assignments = []`
  - `empcode = 6437`
- local employee master:
  - `office_location = "Panchkula"`

Then middleware enriches `req.user` with:

- `location_scopes = ["PANCHKULA"]`
- `location_scope_source = "employee"`

So that employee can operate only in Panchkula without manual assignment.

## 6. New Core Utility For Location Logic

### 6.1 `StoreManagementService/src/utils/location-scope.js` (new)

Change:

- created the central helper for all location-aware behavior

Main helpers:

- `normalizeLocationScope(value)`
  - converts location text to normalized uppercase form
  - example:
    - `" Panchkula "` -> `PANCHKULA`

- `collectActorLocationScopes(actor)`
  - reads allowed locations from `actor.assignments`
  - also reads actor-level fallback values like:
    - `location_scopes`
    - `office_location_scope`
    - `office_location`
    - `location_scope`
  - if user has `SUPER_ADMIN`, access becomes unrestricted
  - if user has `GLOBAL` assignment, access becomes unrestricted

- `assertActorCanAccessLocation(actor, locationScope, actionLabel)`
  - throws if user is trying to touch another location
  - example:
    - user location = `PANCHKULA`
    - record location = `CHANDIGARH`
    - result = blocked

- `resolveActorLocationScope(actor, requestedLocationScope)`
  - decides what location to stamp on new records
  - if user has exactly one assigned location and request does not provide one, it uses that location
  - if user has multiple locations, it forces explicit selection

- `buildLocationScopeWhere(actor)`
  - creates DB filter like:
    - `WHERE location_scope IN (...)`

- `resolveEmployeeLocationScope(employeeId)`
  - gets location from employee office location

- `resolveCustodianLocationScope(custodianId)`
  - gets location from custodian location

Why:

- this file prevents location logic from being copied badly in 10 different places

Example:

- Panchkula store user requests stocks list
- repository calls `buildLocationScopeWhere(actor)`
- query becomes restricted to `PANCHKULA`

Long-term rule used now:

- explicit account location access is used first
- explicit assignment location also works
- if no location assignment exists, employee office location can be used as a
  safe fallback for employee-linked accounts
- if neither exists, access is blocked

## 7. Database Schema For Operational Records

### 7.1 `StoreManagementService/src/migrations/20260326120000-add-location-scope-to-operational-records.js` (new)

Change:

- added `location_scope` column to:
  - `DayBooks`
  - `Stocks`
  - `Requisitions`
  - `IssuedItems`
  - `Assets`
  - `AssetEvents`
  - `GatePasses`
  - `StockMovements`

- added indexes for common location-filtered reads

- added best-effort backfills

Why:

- location-aware logic only works cleanly if records actually store the location directly

Backfill examples:

- requisition gets location from employee office location
- issued item gets location from employee/custodian
- stock gets location from daybook
- asset gets location from stock/daybook/holder

### 7.2 Model Files Updated With `location_scope`

Each of these files now includes a `location_scope` field:

- `StoreManagementService/src/models/daybook.js`
- `StoreManagementService/src/models/stock.js`
- `StoreManagementService/src/models/requisition.js`
- `StoreManagementService/src/models/issueditem.js`
- `StoreManagementService/src/models/asset.js`
- `StoreManagementService/src/models/assetevents.js`
- `StoreManagementService/src/models/gatepass.js`
- `StoreManagementService/src/models/stockmovement.js`

Why:

- Sequelize must know about the new database column

Example:

- when a new asset is created from a Panchkula stock row:
  - model now accepts and stores `location_scope: "PANCHKULA"`

## 8. Stock Movement Logging

### 8.1 `StoreManagementService/src/services/stock-movement-service.js`

Change:

- added support for `location_scope` in stock movement log entries

Why:

- inventory movement history must also stay location-specific

Example:

- issuing 5 units from Panchkula stock writes:
  - movement type = `ISSUE_OUT`
  - location scope = `PANCHKULA`

## 9. DayBook Flow

### 9.1 `StoreManagementService/src/services/daybook-service.js`

Change:

- when creating a daybook, location is resolved from the actor or explicit payload
- approval and reject now assert that actor can access the daybook location
- MRN and search methods now carry viewer assignments so location filtering works consistently
- `getDayBookById` and `getDayBookFullDetails` now assert location access

Why:

- daybook is the first operational record in the chain; if it leaks, everything after it leaks

Example:

- Panchkula store user creates daybook
- system stamps `location_scope = PANCHKULA`
- Chandigarh approver tries to approve by ID
- blocked

### 9.2 `StoreManagementService/src/repository/daybook-repository.js`

Change:

- added location filtering to:
  - list daybooks
  - MRN list
  - search by entry number

Why:

- list queries should never show other locations

### 9.3 `StoreManagementService/src/controllers/daybook-controller.js`

Change:

- passes `req.user.assignments` to service methods
- now returns proper `statusCode` when location access is denied

Why:

- without forwarding assignments, the service cannot know which location the user belongs to

## 10. Stock Flow

### 10.1 `StoreManagementService/src/repository/stock-repository.js`

Change:

- when approved daybook items move to stock, new stock rows inherit `daybook.location_scope`
- stock lists are filtered by location
- stock-by-category grouped queries are also filtered by location
- raw grouped SQL path also applies location restriction

Why:

- once stock is created, it must stay inside the same location

Example:

- Panchkula daybook approved
- created stock gets `PANCHKULA`
- Chandigarh store user cannot see it in `/stocks`

### 10.2 `StoreManagementService/src/services/stock-service.js`

Change:

- forwards actor/viewer context into repository calls

### 10.3 `StoreManagementService/src/controllers/stock-controller.js`

Change:

- forwards `req.user`
- returns correct non-500 status codes when location access is denied

## 11. Requisition Flow

### 11.1 `StoreManagementService/src/services/requisition-service.js`

Change:

- requisition creation now derives requester location from employee
- requisition read/list/issue queue functions carry actor assignments
- location is checked before returning record by ID

Why:

- requisition must be tied to requester location from the beginning

Example:

- employee from Panchkula creates requisition
- requisition is stamped `PANCHKULA`
- only Panchkula divisional head / Panchkula store flow should touch it

### 11.2 `StoreManagementService/src/repository/requisition-repository.js`

Change:

- stores `location_scope` during requisition create
- filters requisition list and issue-ready list by location
- blocks approval/reject/submit/cancel/map/fulfillment when actor location does not match
- stock mapping now requires stock location to match requisition location

Why:

- this is the main no-breach enforcement for requisition lifecycle

Example:

- Panchkula requisition cannot be mapped against Chandigarh stock

### 11.3 `StoreManagementService/src/controllers/requisition-controller.js`

Change:

- now uses `error.statusCode` for proper location-aware errors

## 12. Issued Item Flow

### 12.1 `StoreManagementService/src/repository/issueditem-repository.js`

Change:

- issue operations now assert actor can access source stock location
- target employee/custodian location must match stock location
- issued rows store `location_scope`
- stock movement logs store location
- asset events created during serialized issue store location
- search results are filtered by location

Why:

- this is where “Panchkula stock should issue only to Panchkula employee/custodian” is enforced

Example:

- Panchkula stock + Chandigarh employee = blocked

### 12.2 `StoreManagementService/src/services/issueditem-services.js`

Change:

- forwards actor into repository methods

### 12.3 `StoreManagementService/src/controllers/issueditem-controller.js`

Change:

- forwards `req.user`
- returns proper status codes when location validation fails

## 13. Asset Flow

### 13.1 `StoreManagementService/src/repository/asset-repository.js`

Change:

- when assets are created from approved daybook serials, they inherit daybook location
- asset return checks actor location and logs `location_scope`
- asset transfer checks:
  - actor access to source location
  - target custodian location must match asset location
- repair out / repair in now enforce location and preserve location in events and stock movements
- finalize / e-waste / lost / disposed enforce location
- retain enforces location
- asset list / asset category summary / assets-by-category now filter by location

Why:

- assets are one of the easiest places for location leakage if not guarded

Example:

- Panchkula asset cannot be transferred to Chandigarh custodian

### 13.2 `StoreManagementService/src/services/asset-service.js`

Change:

- forwards actor to repository

### 13.3 `StoreManagementService/src/controllers/asset-controller.js`

Change:

- forwards `req.user`
- returns non-500 status codes for location denial

## 14. Gate Pass Flow

### 14.1 `StoreManagementService/src/repository/gatepass-repository.js`

Change:

- gate pass rows now carry `location_scope`
- list and getById are location filtered
- verify-by-code now also checks location access
- repair-out gate pass creation requires all selected assets to belong to one location
- e-waste gate pass creation requires all assets to belong to one location
- verify out / verify in enforce location
- `EWasteOut` asset events now keep location

Why:

- gate pass should not become a backdoor for cross-location asset movement

Example:

- selected e-waste assets from two locations in one pass = blocked

### 14.2 `StoreManagementService/src/services/gatepass-service.js`

Change:

- forwards actor into repository

### 14.3 `StoreManagementService/src/controllers/gatepass-controller.js`

Change:

- forwards `req.user`
- returns proper status code for location denial

## 15. Asset Event Flow

### 15.1 `StoreManagementService/src/repository/assetevent-repository.js`

Change:

- event list/search/timeline/history/recent endpoints are now location filtered
- serialized output now includes `location_scope`

Why:

- event history should not expose another location’s movement log

### 15.2 `StoreManagementService/src/services/assetevent-service.js`

Change:

- forwards actor/viewer context

### 15.3 `StoreManagementService/src/controllers/assetevent-controller.js`

Change:

- forwards `req.user`
- returns non-500 status codes for location denial

## 16. Issued Migration Flow

### 16.1 `StoreManagementService/src/services/issued-migration-service.js`

Change:

- resolves location from employee office location
- if stock exists, stock location must match employee location
- if stock is auto-created, it is stamped with the employee location
- issued item rows are stamped with `location_scope`
- asset rows created by migration are stamped with `location_scope`
- asset events created by migration are stamped with `location_scope`
- stock movement logs created by migration carry location

Why:

- historical import should not create location-less issued data

Example:

- row says employee `6437`
- employee office location = `PANCHKULA`
- stock location = `CHANDIGARH`
- result = blocked

## 17. Opening Stock Migration Flow

### 17.1 `StoreManagementService/src/services/migration-service.js`

Change:

- resolves one group location from:
  - row location fields
  - existing stock location
  - or single-system-location fallback
- stamps created or updated stock with `location_scope`
- stock movements created during opening migration now carry location
- assets created from opening migration now carry location
- asset events created from opening migration now carry location

Why:

- opening stock import must also become location-aware

Example:

- if the system currently only has Panchkula everywhere, opening migration can safely infer `PANCHKULA`
- if the system has multiple locations, file must provide a resolvable location

## 18. Why `SUPER_ADMIN` Still Works Across All Locations

This behavior comes from:

- `StoreManagementService/src/utils/location-scope.js`
- `AuthService/src/services/user-service.js`
- Auth assignments model

Rule:

- `SUPER_ADMIN` is treated as unrestricted
- `GLOBAL` responsibility is also treated as unrestricted

That means:

- super admin can view all locations
- ordinary operational accounts stay location-scoped

## 19. Why This Approach Is Optimized

This implementation is optimized because:

- location is stored directly on operational tables
- queries filter by exact `location_scope`
- indexes were added in the migration
- lists return only relevant rows instead of loading all and filtering later

Example:

- Panchkula user querying stocks does not scan the whole logical dataset in application code
- database query is already narrowed to Panchkula

## 20. Full File Checklist

This branch’s location-scope implementation touches these files:

### AuthService

- `AuthService/src/constants/table-names.js`
- `AuthService/src/constants/org-assignments.js`
- `AuthService/src/models/user.js`
- `AuthService/src/models/orgassignment.js`
- `AuthService/src/migrations/20260323120000-create-org-assignments.js`
- `AuthService/src/migrations/20260323121000-add-vehicle-driver-role.js`
- `AuthService/src/migrations/20260326101500-add-org-assignment-managed-roles.js`
- `AuthService/src/repository/user-repository.js`
- `AuthService/src/repository/org-assignment-repository.js`
- `AuthService/src/services/user-service.js`
- `AuthService/src/services/org-assignment-service.js`
- `AuthService/src/controllers/user-controller.js`
- `AuthService/src/controllers/org-assignment-controller.js`
- `AuthService/src/routes/v1/index.js`

### StoreManagementService

- `StoreManagementService/src/middlewares/auth-middleware.js`
- `StoreManagementService/src/utils/location-scope.js`
- `StoreManagementService/src/migrations/20260326120000-add-location-scope-to-operational-records.js`
- `StoreManagementService/src/models/daybook.js`
- `StoreManagementService/src/models/stock.js`
- `StoreManagementService/src/models/requisition.js`
- `StoreManagementService/src/models/issueditem.js`
- `StoreManagementService/src/models/asset.js`
- `StoreManagementService/src/models/assetevents.js`
- `StoreManagementService/src/models/gatepass.js`
- `StoreManagementService/src/models/stockmovement.js`
- `StoreManagementService/src/repository/daybook-repository.js`
- `StoreManagementService/src/repository/stock-repository.js`
- `StoreManagementService/src/repository/requisition-repository.js`
- `StoreManagementService/src/repository/issueditem-repository.js`
- `StoreManagementService/src/repository/asset-repository.js`
- `StoreManagementService/src/repository/gatepass-repository.js`
- `StoreManagementService/src/repository/assetevent-repository.js`
- `StoreManagementService/src/services/daybook-service.js`
- `StoreManagementService/src/services/stock-service.js`
- `StoreManagementService/src/services/requisition-service.js`
- `StoreManagementService/src/services/issueditem-services.js`
- `StoreManagementService/src/services/asset-service.js`
- `StoreManagementService/src/services/gatepass-service.js`
- `StoreManagementService/src/services/assetevent-service.js`
- `StoreManagementService/src/services/stock-movement-service.js`
- `StoreManagementService/src/services/issued-migration-service.js`
- `StoreManagementService/src/services/migration-service.js`
- `StoreManagementService/src/controllers/daybook-controller.js`
- `StoreManagementService/src/controllers/stock-controller.js`
- `StoreManagementService/src/controllers/requisition-controller.js`
- `StoreManagementService/src/controllers/issueditem-controller.js`
- `StoreManagementService/src/controllers/asset-controller.js`
- `StoreManagementService/src/controllers/gatepass-controller.js`
- `StoreManagementService/src/controllers/assetevent-controller.js`

### Frontend

- `frontend/src/App.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/pages/AccessControl.jsx`

## 21. Code Reference And Functionality

This section adds the **actual code patterns** that were added or changed, along with the **functionality of that code**.

I am grouping repeated patterns where the code is the same across many files, but I am still naming **every affected file** so nothing is skipped.

### 21.1 `AuthService/src/constants/table-names.js`

Code added:

```js
ORG_ASSIGNMENT_TABLE: "OrgAssignments",
```

Functionality:

- defines the physical table name used for organizational assignments
- this constant is reused by migrations and models so the table name stays consistent

Example:

- when `OrgAssignment` model is created, it points to `OrgAssignments`

### 21.2 `AuthService/src/models/user.js`

Code added:

```js
User.hasMany(models.OrgAssignment, {
  as: "orgAssignments",
  foreignKey: "user_id",
  sourceKey: "id",
});
```

Functionality:

- links one user to many organizational assignments
- allows repository code to include active assignments when loading a user

Example:

- User 14 can have:
  - one login row in `Users`
  - many responsibility rows in `OrgAssignments`

### 21.3 `AuthService/src/models/orgassignment.js`

Code added:

```js
scope_type: {
  type: DataTypes.STRING,
  allowNull: false,
},
scope_key: {
  type: DataTypes.STRING,
  allowNull: false,
},
metadata_json: {
  type: DataTypes.JSON,
  allowNull: true,
},
active: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: true,
},
```

Functionality:

- stores one current organizational responsibility
- `scope_type` says what kind of scope it is
- `scope_key` says which exact division/vehicle/location it belongs to
- `metadata_json` stores extra details like `location`
- `active` tells whether the assignment is current

Example:

```js
{
  assignment_type: "STORE_INCHARGE",
  scope_type: "LOCATION",
  scope_key: "PANCHKULA",
  metadata_json: { location: "Panchkula" },
  active: true
}
```

### 21.4 `AuthService/src/migrations/20260323120000-create-org-assignments.js`

Code added:

```js
await queryInterface.createTable(ORG_ASSIGNMENT_TABLE, {
  user_id: { ... },
  assignment_type: { type: Sequelize.STRING, allowNull: false },
  scope_type: { type: Sequelize.STRING, allowNull: false },
  scope_key: { type: Sequelize.STRING, allowNull: false },
  metadata_json: { type: Sequelize.JSON, allowNull: true },
  active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
});
```

Functionality:

- creates the table used to store organizational responsibilities

Also added:

```js
await queryInterface.addIndex(
  ORG_ASSIGNMENT_TABLE,
  ["assignment_type", "scope_type", "scope_key", "active"],
  { name: "idx_org_assignments_scope_active" },
);
```

Functionality:

- makes active-assignment lookups faster

Example:

- find active `STORE_INCHARGE` for `PANCHKULA` quickly

### 21.5 `AuthService/src/migrations/20260323121000-add-vehicle-driver-role.js`

Code added:

```sql
INSERT INTO `Roles` (name, createdAt, updatedAt)
SELECT 'VEHICLE_DRIVER', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `Roles` WHERE name = 'VEHICLE_DRIVER'
)
```

Functionality:

- makes sure `VEHICLE_DRIVER` role exists in the system

### 21.6 `AuthService/src/migrations/20260326101500-add-org-assignment-managed-roles.js`

Code added:

```js
const ROLE_NAMES = [
  "DIVISION_CUSTODIAN",
  "LOCATION_INCHARGE",
  "STORE_INCHARGE",
];
```

Functionality:

- adds more assignment-managed roles to the `Roles` table

Why:

- these responsibilities are real system concepts and need matching roles

### 21.7 `AuthService/src/constants/org-assignments.js`

Code added:

```js
const ASSIGNMENT_SCOPE_TYPES = Object.freeze({
  DIVISION: "DIVISION",
  VEHICLE: "VEHICLE",
  CUSTODIAN: "CUSTODIAN",
  LOCATION: "LOCATION",
  GLOBAL: "GLOBAL",
});
```

Functionality:

- creates the allowed scope types used by the assignment system

Code added:

```js
DIVISION_HEAD: Object.freeze({
  roleName: "DIVISION_HEAD",
  defaultScopeType: ASSIGNMENT_SCOPE_TYPES.CUSTODIAN,
  allowedScopeTypes: [
    ASSIGNMENT_SCOPE_TYPES.DIVISION,
    ASSIGNMENT_SCOPE_TYPES.CUSTODIAN,
  ],
  singleActivePerScope: true,
  singleActivePerUser: false,
}),
```

Functionality:

- defines how `DIVISION_HEAD` behaves
- one division can have only one active head
- one user can hold multiple divisions because `singleActivePerUser: false`

Example:

- one person can hold:
  - Accounts Division, Panchkula
  - Requirement Division, Panchkula
  - Procurement Division, Panchkula

Code added:

```js
STORE_INCHARGE: Object.freeze({
  roleName: "STORE_INCHARGE",
  defaultScopeType: ASSIGNMENT_SCOPE_TYPES.LOCATION,
  allowedScopeTypes: [
    ASSIGNMENT_SCOPE_TYPES.LOCATION,
    ASSIGNMENT_SCOPE_TYPES.GLOBAL,
  ],
  singleActivePerScope: true,
  singleActivePerUser: false,
}),
```

Functionality:

- defines store responsibility as location-based

Also added helper code:

```js
const isAssignmentManagedRole = (roleName) =>
  ASSIGNMENT_MANAGED_ROLE_NAMES.includes(
    String(roleName || "").trim().toUpperCase(),
  );
```

Functionality:

- tells the system whether a role should be managed through org assignments instead of manual role editing

### 21.8 `AuthService/src/repository/org-assignment-repository.js`

Code added:

```js
async findActiveByScope(assignmentType, scopeType, scopeKey, transaction) {
  return OrgAssignment.findAll({
    where: {
      assignment_type: assignmentType,
      scope_type: scopeType,
      scope_key: scopeKey,
      active: true,
    },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
}
```

Functionality:

- finds who is currently active for a given scope

Example:

- current `STORE_INCHARGE` for `PANCHKULA`

Code added:

```js
async endAssignments(ids = [], payload = {}, transaction) {
  await OrgAssignment.update(
    {
      active: false,
      effective_to: payload.effective_to || new Date(),
      ended_by_user_id: payload.ended_by_user_id || null,
    },
    ...
  );
}
```

Functionality:

- closes old assignments instead of deleting them
- preserves audit history

### 21.9 `AuthService/src/services/org-assignment-service.js`

Code added:

```js
const scopeType = normalizeScopeType(
  payload.scopeType ?? payload.scope_type ?? config.defaultScopeType,
);
```

Functionality:

- normalizes and validates the scope type sent from the UI or API

Code added:

```js
if (scopeType === ASSIGNMENT_SCOPE_TYPES.LOCATION) {
  const resolvedLocation =
    normalizeScopeLabel(
      scopeLabel ||
        metadataJson?.location ||
        payload.location ||
        payload.scopeLabel ||
        payload.scopeKey,
    ) || null;
  scopeLabel = resolvedLocation || scopeLabel || null;
  scopeKey = scopeKey || normalizeScopeKey(resolvedLocation);
  metadataJson = {
    ...(metadataJson || {}),
    location: resolvedLocation,
  };
}
```

Functionality:

- ensures location assignments always carry normalized location data

Example:

- if UI sends `" Panchkula "`
- service normalizes it and saves:
  - `scope_key = PANCHKULA`
  - `metadata_json.location = Panchkula`

Code added:

```js
if (
  Array.isArray(config.allowedScopeTypes) &&
  config.allowedScopeTypes.length &&
  !config.allowedScopeTypes.includes(scopeType)
) {
  throw createError(
    `assignment_type ${assignmentType} does not allow scope_type ${scopeType}.`,
  );
}
```

Functionality:

- prevents invalid combinations

Example:

- `VEHICLE_DRIVER` cannot wrongly be assigned to a division scope

### 21.10 `AuthService/src/repository/user-repository.js`

Code changed in signup:

```js
return await sequelize.transaction(async (transaction) => {
  const user = await User.create(data, { transaction });
  const defaultRole = await Role.findOne({
    where: { name: DEFAULT_SIGNUP_ROLE },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  await user.addRole(defaultRole, { transaction });
  return user;
});
```

Functionality:

- signup now automatically binds `USER` role

Code changed in user fetch:

```js
include: [
  {
    model: OrgAssignment,
    as: "orgAssignments",
    required: false,
    where: { active: true },
    attributes: [
      "id",
      "assignment_type",
      "scope_type",
      "scope_key",
      "scope_label",
      "effective_from",
      "metadata_json",
      "notes",
    ],
  },
],
```

Functionality:

- when user data is loaded, active org assignments are fetched too

This powers:

- login payload
- user listing in Access Control

### 21.11 `AuthService/src/services/user-service.js`

Code added:

```js
const serializeAssignments = (assignments = []) =>
  Array.isArray(assignments)
    ? assignments.map((assignment) => ({
        id: assignment.id,
        assignment_type: assignment.assignment_type,
        scope_type: assignment.scope_type,
        scope_key: assignment.scope_key,
        scope_label: assignment.scope_label || null,
        effective_from: assignment.effective_from || null,
        metadata_json: assignment.metadata_json || null,
        notes: assignment.notes || null,
      }))
    : [];
```

Functionality:

- converts raw assignment rows into clean API output

Code changed in authentication:

```js
return {
  id: user.id,
  empcode: user.empcode,
  fullname: user.fullname,
  mobileno: user.mobileno,
  designation: user.designation,
  division: user.division,
  roles: Array.isArray(user.roles)
    ? user.roles.map((role) => role.name)
    : [],
  assignments: serializeAssignments(user.orgAssignments),
};
```

Functionality:

- sends active assignments back to StoreManagement during auth

This is the exact reason StoreManagement later knows:

- which locations the user belongs to

Code changed in role catalog:

```js
return roles.map((role) => ({
  id: role.id,
  name: role.name,
  managed_by_assignment: isAssignmentManagedRole(role.name),
  is_default_role: String(role.name || "").trim().toUpperCase() === DEFAULT_SIGNUP_ROLE,
}));
```

Functionality:

- tells the frontend whether a role should be changed manually or through assignment UI

### 21.12 `AuthService/src/controllers/user-controller.js`

Code added or changed conceptually:

- role listing endpoint
- user listing endpoint
- manual role assign/remove endpoints

Representative behavior:

```js
UserController.listUsers
UserController.listRoles
UserController.assignRole
UserController.removeRole
```

Functionality:

- exposes the user, role, and location-access management APIs used by Access Control

### 21.13 `AuthService/src/controllers/org-assignment-controller.js`

Code added:

```js
const data = await OrgAssignmentService.assign(req.body || {}, req.user || {});
```

Functionality:

- controller receives assignment payload from frontend
- passes it to service
- returns saved assignment

### 21.14 `AuthService/src/routes/v1/index.js`

Code added:

```js
router.get(
  "/org-assignments",
  ensureAuth,
  requireAdminOperations,
  OrgAssignmentController.list,
);
router.post(
  "/org-assignments",
  ensureAuth,
  requireAdminOperations,
  OrgAssignmentController.assign,
);
router.patch(
  "/org-assignments/:assignmentId/end",
  ensureAuth,
  requireAdminOperations,
  OrgAssignmentController.end,
);
```

Functionality:

- makes assignment management available through API
- keeps it restricted to `SUPER_ADMIN`

Additional routes added:

```js
router.get("/users/:userId/location-scopes", ...);
router.post("/users/:userId/location-scopes", ...);
router.delete("/users/:userId/location-scopes/:locationScope", ...);
```

Functionality:

- lets super admin manage explicit account-level location access
- keeps operational location access separate from responsibilities

## 21.15 Frontend Files

### `frontend/src/App.jsx`

Code added:

```jsx
<Route
  path="access-control"
  element={
    <ProtectedRoute user={user} anyOf={["SUPER_ADMIN"]}>
      <AccessControl />
    </ProtectedRoute>
  }
/>
```

Functionality:

- registers Access Control page
- only super admin can open it

### `frontend/src/components/Sidebar.jsx`

Code added:

```js
accessControl: ["SUPER_ADMIN"],
```

Functionality:

- sidebar shows Access Control only for super admin

### `frontend/src/pages/AccessControl.jsx`

Code added:

```js
const DEFAULT_LOCATION_SCOPE_FORM = {
  locationScope: "",
};

const ASSIGNMENT_TYPE_CONFIG = {
  DIVISION_HEAD: { selector: "division", ... },
  DIVISION_CUSTODIAN: { selector: "division", ... },
  VEHICLE_DRIVER: { selector: "vehicle", ... },
  LOCATION_INCHARGE: { selector: "location", ... },
  STORE_INCHARGE: { selector: "location", ... },
  GLOBAL: { selector: "global", ... },
};
```

Functionality:

- tells the UI what input to show for each responsibility type
- also adds a dedicated location-access flow for role-based operational accounts

Code added:

```js
await axios.post(toAuthApiUrl(`/users/${selectedUser.id}/location-scopes`), {
  locationScope: selectedLocation.id,
  scopeLabel: selectedLocation.display_name,
});
```

Functionality:

- saves explicit account-level location access for the selected user

Code added:

```js
await axios.post(toAuthApiUrl("/org-assignments"), requestPayload);
```

Functionality:

- creates new assignments from the UI

Code added:

```js
axios.get(toStoreApiUrl("/custodians"), {
  params: { custodian_type: "DIVISION", limit: 500 },
})
```

Functionality:

- loads division master records for assignment dropdown

Example:

- dropdown option:
  - `Accounts Division - Panchkula`

## 21.16 `StoreManagementService/src/middlewares/auth-middleware.js`

Code changed:

```js
return withFallbackLocationScopes({
  id: me.id,
  empcode: me.empcode,
  fullname: me.fullname,
  mobileno: me.mobileno,
  designation: me.designation,
  division: me.division,
  roles: normalizeRoleList(me.roles),
  assignments: Array.isArray(me.assignments) ? me.assignments : [],
  location_scopes: Array.isArray(me.location_scopes) ? me.location_scopes : [],
  location_scope_source: me.location_scope_source || null,
});
```

Functionality:

- takes the AuthService response and enriches it before placing it into `req.user`
- if explicit `location_scopes` already exist on the account, it keeps them as
  the primary source
- if no explicit `location_scopes` exist and the account has a real `empcode`,
  it looks up `Employee.office_location` and stores that as a safe fallback
- service accounts without an employee match still remain unscoped and blocked

Example:

- Auth payload:
  - `roles = ["USER"]`
  - `assignments = []`
  - `empcode = 6437`
- local employee record:
  - `office_location = "Panchkula"`

Result:

- `req.user.location_scopes = ["PANCHKULA"]`
- `req.user.location_scope_source = "employee"`

Without this layer:

- StoreManagement would know roles
- but would not know location responsibilities
- and ordinary employee accounts would need unnecessary manual assignment

## 21.17 `StoreManagementService/src/utils/location-scope.js`

Code added:

```js
const normalizeLocationScope = (value) => {
  if (value == null) return null;
  const text = String(value).trim().replace(/\\s+/g, " ");
  if (!text) return null;
  return text.toUpperCase();
};
```

Functionality:

- standardizes all location text

Example:

- `" Panchkula "` becomes `PANCHKULA`

Code added:

```js
const collectActorLocationScopes = (actor = {}) => {
  const roles = normalizeRoleList(actor?.roles || []);
  if (roles.includes("SUPER_ADMIN")) {
    return { unrestricted: true, scopes: [] };
  }
  ...
  if (Array.isArray(actor?.location_scopes)) {
    actorLevelCandidates.push(...actor.location_scopes);
  }
  if (actor?.office_location_scope) actorLevelCandidates.push(actor.office_location_scope);
  if (actor?.office_location) actorLevelCandidates.push(actor.office_location);
  ...
}
```

Functionality:

- reads allowed locations from the logged-in actor
- `SUPER_ADMIN` gets unrestricted access
- explicit assignment locations still work
- actor-level fallback locations also work, which is how employee-based
  auto-location is consumed everywhere without extra DB lookups inside every
  repository method

Code added:

```js
const assertActorCanAccessLocation = (actor, locationScope, actionLabel) => {
  ...
  if (!access.scopes.includes(normalizedScope)) {
    throw createLocationError(
      `You can ${actionLabel} only for your assigned location.`,
    );
  }
  return normalizedScope;
};
```

Functionality:

- blocks cross-location operations

Code added:

```js
const buildLocationScopeWhere = (actor = {}, fieldName = LOCATION_SCOPE_FIELD) => {
  const access = collectActorLocationScopes(actor);
  if (access.unrestricted) return null;
  if (!access.scopes.length) {
    return { [fieldName]: NO_LOCATION_ACCESS_SCOPE };
  }
  return { [fieldName]: { [Op.in]: access.scopes } };
};
```

Functionality:

- generates repository-level location filter

Example:

- Panchkula user gets:
  - `where.location_scope IN ["PANCHKULA"]`

## 21.18 `StoreManagementService/src/migrations/20260326120000-add-location-scope-to-operational-records.js`

Code added:

```js
const LOCATION_COLUMN = "location_scope";
```

Code added:

```js
await queryInterface.addColumn(tableName, LOCATION_COLUMN, LOCATION_COLUMN_DEF);
```

Functionality:

- adds `location_scope` to operational tables

Code added:

```js
await queryInterface.addIndex(table, fields, { name });
```

Functionality:

- indexes common location-filtered queries

Code added:

```sql
UPDATE Requisitions r
LEFT JOIN Employees e
  ON e.emp_id = CAST(r.requester_emp_id AS UNSIGNED)
SET r.location_scope = UPPER(TRIM(e.office_location))
```

Functionality:

- backfills old requisition rows from employee office location

## 21.19 Model Files With Same `location_scope` Pattern

Files:

- `StoreManagementService/src/models/daybook.js`
- `StoreManagementService/src/models/stock.js`
- `StoreManagementService/src/models/requisition.js`
- `StoreManagementService/src/models/issueditem.js`
- `StoreManagementService/src/models/asset.js`
- `StoreManagementService/src/models/assetevents.js`
- `StoreManagementService/src/models/gatepass.js`
- `StoreManagementService/src/models/stockmovement.js`

Code pattern added:

```js
location_scope: {
  type: DataTypes.STRING(80),
  allowNull: true,
},
```

Functionality:

- adds the location field to Sequelize model definitions

## 21.20 `StoreManagementService/src/services/stock-movement-service.js`

Code changed:

```js
location_scope: locationScope || null,
```

and

```js
location_scope: row?.locationScope || null,
```

Functionality:

- logs stock movement with the same location as the operational action

## 21.21 DayBook Files

Files:

- `StoreManagementService/src/services/daybook-service.js`
- `StoreManagementService/src/repository/daybook-repository.js`
- `StoreManagementService/src/controllers/daybook-controller.js`

### `daybook-service.js`

Code added:

```js
payload.location_scope = resolveActorLocationScope(
  actor,
  payload.location_scope || payload.location,
);
```

Functionality:

- stamps new daybook with the actor’s allowed location

Code added:

```js
assertActorCanAccessLocation(
  actor || {},
  existingDaybook.location_scope,
  "approve this daybook",
);
```

Functionality:

- blocks approval from wrong location

### `daybook-repository.js`

Code added:

```js
const locationWhere = buildLocationScopeWhere(viewerActor || {});
if (locationWhere) {
  Object.assign(whereClause, locationWhere);
}
```

Functionality:

- filters daybook lists and searches by actor location

### `daybook-controller.js`

Code changed:

```js
viewerAssignments: Array.isArray(req.user?.assignments)
  ? req.user.assignments
  : [],
```

and:

```js
return res.status(error?.statusCode || 500).json(...)
```

Functionality:

- forwards assignments into service
- returns proper 403/409 style responses instead of generic 500 when location rules fail

## 21.22 Stock Files

Files:

- `StoreManagementService/src/repository/stock-repository.js`
- `StoreManagementService/src/services/stock-service.js`
- `StoreManagementService/src/controllers/stock-controller.js`

### `stock-repository.js`

Code changed:

```js
attributes: ["id", "location_scope"],
```

Functionality:

- loads daybook location before creating stock

Code added:

```js
location_scope: daybook.location_scope || null,
```

Functionality:

- newly created stock inherits daybook location

Code added:

```js
const locationWhere = buildLocationScopeWhere(actor || {});
```

Functionality:

- stock list queries are filtered by location

### `stock-service.js`

Code changed:

```js
return await repo.getAll(actor);
```

Functionality:

- forwards actor to repository so location filter can be applied

### `stock-controller.js`

Code changed:

```js
const data = await stockService.getAll(req.user || null);
```

Functionality:

- sends logged-in user to service

## 21.23 Requisition Files

Files:

- `StoreManagementService/src/services/requisition-service.js`
- `StoreManagementService/src/repository/requisition-repository.js`
- `StoreManagementService/src/controllers/requisition-controller.js`

### `requisition-service.js`

Code added:

```js
const requesterLocationScope =
  (await resolveEmployeeLocationScope(actor.empcode, { transaction })) ||
  resolveActorLocationScope(
    actor,
    payload?.location_scope || payload?.location,
  );
```

Functionality:

- determines requisition location from employee first
- falls back to actor-assigned location when needed

### `requisition-repository.js`

Code added:

```js
location_scope: requesterLocationScope || null,
```

Functionality:

- stores location on requisition row

Code added:

```js
location_scope: requisition.location_scope,
```

Functionality:

- mapped stock rows must belong to the same requisition location

Code added:

```js
assertActorCanAccessLocation(
  actor || {},
  requisition.location_scope,
  "map store items for this requisition",
);
```

Functionality:

- blocks action if actor is from another location

### `requisition-controller.js`

Code changed:

```js
return res.status(error?.statusCode || 500).json(...)
```

Functionality:

- returns location access errors properly

## 21.24 Issued Item Files

Files:

- `StoreManagementService/src/repository/issueditem-repository.js`
- `StoreManagementService/src/services/issueditem-services.js`
- `StoreManagementService/src/controllers/issueditem-controller.js`

### `issueditem-repository.js`

Code added:

```js
const stockLocationScope = assertActorCanAccessLocation(
  actor || {},
  stock.location_scope,
  "issue stock from this location",
);
```

Functionality:

- actor must be allowed to use the source stock location

Code added:

```js
ensureSameLocationScope(stockLocationScope, targetLocationScope, "Issue target");
```

Functionality:

- target employee or custodian must belong to the same location

Code added:

```js
location_scope: stockLocationScope,
```

Functionality:

- issued records and asset events are stamped with source stock location

### `issueditem-services.js`

Code changed:

```js
return await repo.search({ ...filters, viewerActor: actor });
```

Functionality:

- passes viewer context for location filtering

### `issueditem-controller.js`

Code changed:

```js
data = await service.issueItem(payload, req.user || null);
```

Functionality:

- forwards user context into issuance path

## 21.25 Asset Files

Files:

- `StoreManagementService/src/repository/asset-repository.js`
- `StoreManagementService/src/services/asset-service.js`
- `StoreManagementService/src/controllers/asset-controller.js`

### `asset-repository.js`

Code added:

```js
location_scope: db.location_scope || null,
```

Functionality:

- assets created from approved daybook inherit daybook location

Code added:

```js
const assetLocationScope = assertActorCanAccessLocation(
  actor || {},
  a.location_scope,
  "transfer assets from this location",
);
```

Functionality:

- asset actions are blocked if actor is from another location

Code added:

```js
ensureSameLocationScope(
  assetLocationScope,
  toLocationScope,
  "Transfer target",
);
```

Functionality:

- transfer target must belong to same location as the asset

Code added:

```js
const locationWhere = buildLocationScopeWhere(viewerActor || {});
```

Functionality:

- category summary and asset list/search are location-filtered

### `asset-service.js`

Code changed:

```js
return await repo.returnAssets({ ...payload, actor });
```

Functionality:

- forwards actor into repository methods

### `asset-controller.js`

Code changed:

```js
const data = await service.transferAssets(payload, req.user || null);
```

Functionality:

- passes logged-in user to service
- allows location enforcement to happen deeper in repository

## 21.26 Gate Pass Files

Files:

- `StoreManagementService/src/repository/gatepass-repository.js`
- `StoreManagementService/src/services/gatepass-service.js`
- `StoreManagementService/src/controllers/gatepass-controller.js`

### `gatepass-repository.js`

Code added:

```js
location_scope: p.location_scope || null,
```

Functionality:

- gate pass response now exposes location

Code added:

```js
const locationScope = this._resolveSingleLocationScope(
  assets,
  "E-Waste assets",
);
```

Functionality:

- all selected assets in one pass must belong to the same location

Code added:

```js
assertActorCanAccessLocation(
  actor || {},
  gatePass.location_scope,
  "update gate pass verification for this location",
);
```

Functionality:

- gate verification is location-restricted

### `gatepass-service.js`

Code changed:

```js
return await repo.verifyOut({ ...payload, actor });
```

Functionality:

- forwards actor into repository

### `gatepass-controller.js`

Code changed:

```js
const data = await service.createEWasteOutPass(payload, req.user || null);
```

Functionality:

- ensures location checks happen during gate-pass creation

## 21.27 Asset Event Files

Files:

- `StoreManagementService/src/repository/assetevent-repository.js`
- `StoreManagementService/src/services/assetevent-service.js`
- `StoreManagementService/src/controllers/assetevent-controller.js`

### `assetevent-repository.js`

Code added:

```js
location_scope: r.location_scope || null,
```

Functionality:

- event response includes location

Code added:

```js
const locationWhere = buildLocationScopeWhere(viewerActor || {});
if (locationWhere) {
  Object.assign(where, locationWhere);
}
```

Functionality:

- event history, recent events, and search are all location-filtered

### `assetevent-service.js`

Code changed:

```js
return await repo.search({ ...filters, viewerActor: actor });
```

Functionality:

- forwards viewer actor to repository

### `assetevent-controller.js`

Code changed:

```js
const data = await service.getTimeline(req.params.assetId, req.user || null);
```

Functionality:

- timeline is now also location-aware

## 21.28 Issued Migration File

File:

- `StoreManagementService/src/services/issued-migration-service.js`

Code added:

```js
const resolvedLocationScope = getLocationScopeFromResolvedCustodian(
  resolvedCustodian,
);
```

Functionality:

- gets location from the employee custodian used in migration

Code added:

```js
if (stockLocationScope !== resolvedLocationScope) {
  throw new Error(
    `Stock ${stock.id} belongs to ${stockLocationScope}, but employee belongs to ${resolvedLocationScope}. Issued migration must stay within one location.`,
  );
}
```

Functionality:

- migration cannot issue Chandigarh stock to Panchkula employee

Code added:

```js
location_scope: locationScope,
```

Functionality:

- stamped on:
  - issued items
  - assets
  - asset events
  - stock movements

## 21.29 Opening Migration File

File:

- `StoreManagementService/src/services/migration-service.js`

Code added:

```js
async resolveGroupLocationScope(records = [], stock = null, transaction = null) {
  ...
}
```

Functionality:

- figures out one valid location for one migration group

Code added:

```js
const implicitScope = await this.getImplicitSingleLocationScope(transaction);
```

Functionality:

- if system currently has only one location overall, migration can safely infer it

Code added:

```js
location_scope: locationScope,
```

Functionality:

- stamped on:
  - stock
  - asset
  - asset event
  - stock movement

## 21.30 Final Meaning Of The Code

The code now does this:

1. super admin assigns a user to a location responsibility
2. AuthService returns that assignment in authenticated user payload
3. StoreManagement reads the assignments
4. helper functions extract allowed locations
5. repositories filter records by `location_scope`
6. services block cross-location actions
7. new operational records inherit and preserve location

That is the complete code-level meaning of the implementation.

## 22. Final Simple Summary

The implementation now works like this:

- AuthService decides **who belongs to which location responsibility**
- StoreManagement receives that responsibility at login time
- operational records store `location_scope`
- repositories filter by `location_scope`
- services block cross-location actions
- controllers return clear errors when location rules are violated

So if a record belongs to `PANCHKULA`, it stays inside the Panchkula workflow unless the actor is `SUPER_ADMIN` or `GLOBAL`.
