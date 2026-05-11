# MOBY Bridge

> Purpose: document how `trackingthc-import-mapper` connects to `moby-core` without changing the CLI’s working file-based behavior.

`trackingthc-import-mapper` is a working import CLI.

`moby-core` is the shared contract layer for the broader MOBY ecosystem.

This project now has a bridge between the two.

The CLI keeps its current outputs:

```txt
normalized.csv
warnings.csv
summary.md
run-manifest.json
index.json
```

The bridge adapters convert those local app artifacts into `moby-core` domain contracts:

```txt
MappingFile      -> MappingProfile
RunManifest      -> ImportRun
WarningRow       -> ValidationIssue
normalized field -> CanonicalField
```

The goal is not to rewrite the CLI.

The goal is to let the working CLI speak MOBY.

Clipboard goblin approved.

---

## Current Boundary

### trackingthc-import-mapper owns behavior

This repo owns:

```txt
CSV parsing
mapping JSON loading
field normalization
unit_cost calculation
warning generation
file writing
run directory creation
run manifest writing
run index writing
Markdown summary writing
CLI commands and flags
```

These are app behaviors.

They should stay here.

### moby-core owns shared contracts

`moby-core` owns portable shared types such as:

```txt
CanonicalField
MappingProfile
FieldMapping
ImportRun
ImportSummary
ValidationIssue
ExternalSystem
```

These are shared contracts.

They should not contain app-specific CLI behavior.

---

## Why the Bridge Exists

The CLI and `moby-core` intentionally use different dialects.

### CLI normalized fields

The CLI emits snake_case normalized output headers:

```txt
product_name
package_id
quantity
total_cost
unit_cost
vendor
```

These are useful for CSV output.

### moby-core canonical fields

`moby-core` uses domain dot paths:

```txt
product.name
package.id
package.quantity
package.totalCost
package.unitCost
vendor.name
```

These are useful for shared contracts.

The bridge maps between them.

Do not replace the CLI output headers with dot paths.

That would break the current product behavior.

---

## Bridge Modules

### 1. Normalized Field to Canonical Field

File:

```txt
src/normalized-to-canonical-field.ts
```

Purpose:

```txt
Convert local normalized output field names into moby-core CanonicalField values.
```

Current mappings:

```txt
product_name  -> product.name
category      -> product.category
vendor        -> vendor.name
package_id    -> package.id
received_date -> package.receivedAt
quantity      -> package.quantity
total_cost    -> package.totalCost
unit_cost     -> package.unitCost
```

Unknown fields return:

```txt
undefined
```

This is intentional.

Not every CLI normalized field has a safe `moby-core` canonical equivalent yet.

Examples intentionally not mapped yet:

```txt
sku
brand
quantity_received
quantity_remaining
retail_price
gross_margin_percent
source_file_name
imported_at
```

Do not force these into nearby fields unless `moby-core` gains an exact contract field.

---

### 2. MappingFile to MappingProfile

File:

```txt
src/moby-mapping-profile.ts
```

Purpose:

```txt
Convert the app’s mapping JSON shape into a moby-core MappingProfile.
```

Current app mapping shape:

```json
{
  "source_system": "korona",
  "fields": {
    "Item Name": "product_name",
    "Package ID": "package_id",
    "Qty On Hand": "quantity",
    "Total Cost": "total_cost",
    "Vendor": "vendor"
  }
}
```

MOBY-compatible result concept:

```ts
{
  id: "mapping-profile-id",
  name: "Mapping Profile Name",
  source: "korona",
  createdAt: "2026-05-10T20:00:00.000Z",
  mappings: [
    {
      sourceField: "Item Name",
      canonicalField: "product.name",
      status: "mapped"
    },
    {
      sourceField: "Package ID",
      canonicalField: "package.id",
      status: "mapped"
    }
  ]
}
```

Unknown normalized fields become:

```ts
{
  sourceField: "Some Header",
  status: "needs_review",
  note: "No moby-core CanonicalField mapping exists for normalized field: some_field"
}
```

This is intentional.

Unknown fields should not throw.

They should be marked for review.

---

### 3. Run Manifest to ImportRun

File:

```txt
src/moby-import-run.ts
```

Purpose:

```txt
Convert the app’s persisted run manifest into a moby-core ImportRun.
```

Current app manifest shape is snake_case:

```json
{
  "run_id": "summary-test-001",
  "status": "success",
  "source_system": "korona",
  "source_file": "samples/korona-export-money-example.csv",
  "mapping_file": "samples/korona-mapping.json",
  "output_file": "output/runs/summary-test-001/normalized.csv",
  "warnings_file": "output/runs/summary-test-001/warnings.csv",
  "rows_processed": 4,
  "unit_costs_calculated": 3,
  "warnings": 2,
  "ran_at": "2026-05-10T01:01:30.889Z"
}
```

MOBY-compatible result concept:

```ts
{
  id: "summary-test-001",
  source: "korona",
  status: "completed_with_warnings",
  filename: "samples/korona-export-money-example.csv",
  startedAt: "2026-05-10T01:01:30.889Z",
  completedAt: "2026-05-10T01:01:30.889Z",
  summary: {
    rowCount: 4,
    successCount: 4,
    warningCount: 2,
    errorCount: 0
  },
  metadata: {
    sourceFile: "samples/korona-export-money-example.csv",
    mappingFile: "samples/korona-mapping.json",
    outputFile: "output/runs/summary-test-001/normalized.csv",
    warningsFile: "output/runs/summary-test-001/warnings.csv",
    unitCostsCalculated: 3,
    originalStatus: "success"
  }
}
```

Status mapping:

```txt
success + warnings = 0 -> completed
success + warnings > 0 -> completed_with_warnings
failed                  -> failed
anything else           -> completed_with_warnings
```

The app’s manifest stays unchanged.

The adapter produces the portable contract shape.

---

### 4. WarningRow to ValidationIssue

File:

```txt
src/moby-validation-issue.ts
```

Purpose:

```txt
Convert app-specific warning rows into moby-core ValidationIssue objects.
```

Local warning rows include review columns:

```txt
rowNumber
code
message
productName
packageId
quantity
totalCost
```

MOBY-compatible result concept:

```ts
{
  code: "INVALID_TOTAL_COST",
  severity: "warning",
  message: "Total cost is not a valid number.",
  rowNumber: 5,
  field: "package.totalCost",
  metadata: {
    productName: "Bad Cost Example",
    packageId: "1A406030000888",
    quantity: "10",
    totalCost: "N/A"
  }
}
```

Known warning code field inference:

```txt
INVALID_QUANTITY         -> package.quantity
INVALID_TOTAL_COST       -> package.totalCost
UNIT_COST_NOT_CALCULATED -> package.unitCost
MISSING_PACKAGE_ID       -> package.id
MISSING_PRODUCT_NAME     -> product.name
```

Unknown warning codes:

```txt
do not throw
omit field
preserve code and message
```

Metadata behavior:

```txt
include productName, packageId, quantity, totalCost when present
omit undefined metadata fields
```

---

## Design Rules

### 1. Do not change working CLI output just to match moby-core

The CLI output format is a product surface.

These must remain stable unless intentionally versioned:

```txt
normalized.csv
warnings.csv
summary.md
run-manifest.json
index.json
```

The bridge exists so these outputs can be represented in MOBY terms without breaking existing behavior.

### 2. Keep app-specific types local

These should remain local unless there is a strong reason to promote them:

```txt
MappingFile
WarningRow
RunIndexEntry
RunManifest
```

Reason:

```txt
They reflect this CLI’s persisted file format and output behavior.
```

`moby-core` types should remain portable.

### 3. Prefer adapters over refactors

Good:

```txt
local artifact -> adapter -> moby-core contract
```

Risky:

```txt
rewrite local artifact to be moby-core contract directly
```

The first preserves behavior.

The second can break CLI output and tests.

### 4. Unknown fields should become review items, not crashes

For mapping conversion:

```txt
unknown normalized field -> FieldMapping status: needs_review
```

For warning conversion:

```txt
unknown warning code -> ValidationIssue without field
```

The bridge should be tolerant.

The review workflow can decide what to do later.

### 5. Do not add new moby-core primitives from this repo casually

If a local app field does not map to `moby-core`, do not immediately modify `moby-core`.

First ask:

```txt
Will at least two MOBY apps need this field or contract?
```

If no, keep it local.

If yes, add it deliberately in `moby-core` with tests and docs.

---

## Current Tests

Bridge test files:

```txt
tests/normalized-to-canonical-field.test.ts
tests/moby-mapping-profile.test.ts
tests/moby-import-run.test.ts
tests/moby-validation-issue.test.ts
```

CLI regression tests:

```txt
tests/cli.test.ts
```

Current intended verification:

```txt
npm run build
npm test
```

Known passing checkpoint:

```txt
5 test files passed
23 tests passed
```

---

## Current Bridge Coverage

The project can now express:

```txt
MappingFile      -> MappingProfile
RunManifest      -> ImportRun
WarningRow       -> ValidationIssue
normalized field -> CanonicalField
```

This gives the CLI a MOBY-compatible contract layer while preserving existing file outputs.

---

## What Not To Do

Do not:

```txt
replace normalized.csv headers with dot-path canonical fields
change mapping JSON format to use moby-core dot paths directly
remove app-specific manifest fields
change warnings.csv columns to match ValidationIssue exactly
merge all bridge files into cli.ts
move CLI behavior into moby-core
add real API clients to moby-core
add database persistence to moby-core
```

Those are raccoon doors.

Keep them closed.

---

## Future Useful Slices

### 1. Create a combined MOBY import summary helper

Potential file:

```txt
src/moby-import-summary.ts
```

Possible purpose:

```txt
Combine MappingProfile, ImportRun, and ValidationIssue[] into one review object.
```

This should still be additive.

No CLI behavior change required.

### 2. Export MOBY sidecar JSON

Optional future CLI flag:

```txt
--moby-json <path>
```

Potential output:

```json
{
  "mappingProfile": {},
  "importRun": {},
  "validationIssues": []
}
```

This would let the CLI emit a portable MOBY artifact.

Do not add this until the bridge adapters are stable.

### 3. Add reconciliation preparation

Potential future bridge:

```txt
normalized.csv rows -> InventoryPackage[]
```

Then later:

```txt
InventoryPackage[] + accounting export -> ReconciliationRun
```

This is the path toward TrackingTHC reconciliation workflows.

---

## North Star

The CLI should continue to work as a simple file-based import mapper.

The bridge should make its artifacts understandable to the MOBY ecosystem.

That means:

```txt
operators get stable CSV outputs
future apps get shared domain contracts
Codex gets fewer chances to put a raccoon in the engine bay
```

Clipboard goblin approved.
