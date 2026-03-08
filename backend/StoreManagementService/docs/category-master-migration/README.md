# Category Master Migration Template

## Files
- `generate-category-master-migration-template.js`
- `category_master_migration_template.xlsx`

## Sheet
- Fill only: `category_master`

## Headers
- `row_no`
- `row_type` (`HEAD` / `GROUP` / `CATEGORY`)
- `head_name`
- `group_name`
- `category_name`
- `serialized_required` (`TRUE` / `FALSE`, required for `CATEGORY` rows)

## APIs
- `POST /api/v1/migration/category-master/validate`
- `POST /api/v1/migration/category-master/execute`

Use form-data key: `file` (xlsx)

## Behavior
- `validate`: checks full file and reports row-level status.
- `execute`: transactional all-or-none. If any row fails, full batch is rolled back.
