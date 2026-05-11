# MOBY Bridge

Purpose: document how `trackingthc-import-mapper` connects to `moby-core` without changing the CLI's working file-based behavior.

`trackingthc-import-mapper` is the import CLI. It reads cannabis POS/export CSV files, applies a mapping JSON file, writes normalized outputs, records warnings, and optionally emits a MOBY JSON sidecar.

`moby-core` is the shared contract layer for the broader MOBY ecosystem. It defines portable types that other apps can consume without knowing the mapper's internal file formats.

The bridge keeps those responsibilities separate:

```txt
trackingthc-import-mapper
  owns CSV parsing, mapping validation, row normalization, warnings, and files

moby-core
  owns shared contracts such as MappingProfile, ImportRun, ValidationIssue, and InventoryPackage

bridge adapters
  convert local mapper artifacts into moby-core contracts
```

The goal is not to rewrite the CLI. The goal is to let the working CLI speak MOBY.

---

## Current Boundary

### `trackingthc-import-mapper` Owns Behavior

This repo owns:

```txt
CSV parsing
mapping JSON loading
mapping header validation
field normalization
unit_cost calculation
warning generation
normalized CSV writing
warnings CSV writing
Markdown summary writing
run manifest writing
run index writing
optional MOBY sidecar writing
CLI commands and flags
```

These are app behaviors and should stay in this repo.

### `moby-core` Owns Shared Contracts

`moby-core` owns portable shared types such as:

```txt
CanonicalField
MappingProfile
FieldMapping
ImportRun
ImportSummary
ValidationIssue
ExternalReference
InventoryPackage
Money
Quantity
```

These are ecosystem contracts. They should not contain CLI-specific file parsing, folder layout, or command behavior.

---

## Why The Bridge Exists

The CLI and `moby-core` intentionally use different dialects.

CLI normalized fields use snake_case headers that are useful in CSV files:

```txt
product_name
package_id
quantity
total_cost
unit_cost
vendor
```

`moby-core` canonical fields use domain dot paths that are useful in shared contracts:

```txt
product.name
package.id
package.quantity
package.totalCost
package.unitCost
vendor.name
```

The bridge maps between those dialects. Do not replace `normalized.csv` headers with MOBY dot paths; that would change the CLI's product surface.

---

## Bridge Coverage

Current adapters cover:

```txt
normalized field -> CanonicalField
MappingFile      -> MappingProfile
RunManifest      -> ImportRun
WarningRow       -> ValidationIssue
normalized row   -> InventoryPackage
MOBY pieces      -> MobyImportSummary
```

The optional sidecar summary currently includes:

```txt
schemaVersion
generatedBy
generatedAt
mappingProfile
importRun
validationIssues
packages
```

That makes `moby-import.json` a versioned contract payload rather than an unlabelled bundle of nested objects.

---

## Bridge Modules

### 1. Normalized Field To Canonical Field

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

Unknown fields return `undefined`. That is intentional; not every local field has a safe shared contract equivalent yet.

Examples intentionally not mapped unless `moby-core` gains exact contract fields:

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

---

### 2. MappingFile To MappingProfile

File:

```txt
src/moby-mapping-profile.ts
```

Purpose:

```txt
Convert the app's mapping JSON shape into a moby-core MappingProfile.
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
  name: "korona import mapping",
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

Unknown normalized fields become review items:

```ts
{
  sourceField: "Some Header",
  status: "needs_review",
  note: "No moby-core CanonicalField mapping exists for normalized field: some_field"
}
```

Mapping conversion should not throw just because a normalized field has no MOBY equivalent.

---

### 3. RunManifest To ImportRun

File:

```txt
src/moby-import-run.ts
```

Purpose:

```txt
Convert the app's persisted run manifest into a moby-core ImportRun.
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

The app's manifest stays unchanged. The adapter produces the portable contract shape.

---

### 4. WarningRow To ValidationIssue

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

Known warning-code field inference:

```txt
INVALID_QUANTITY         -> package.quantity
INVALID_TOTAL_COST       -> package.totalCost
UNIT_COST_NOT_CALCULATED -> package.unitCost
MISSING_PACKAGE_ID       -> package.id
MISSING_PRODUCT_NAME     -> product.name
```

Unknown warning codes should preserve code and message, omit `field`, and continue conversion.

---

### 5. Normalized Row To InventoryPackage

File:

```txt
src/moby-inventory-package.ts
```

Purpose:

```txt
Convert a normalized CSV row into a moby-core InventoryPackage.
```

Normalized row concept:

```ts
{
  product_name: "Blue Dream 3.5g",
  package_id: "1A406030000123",
  quantity: "20",
  total_cost: "$400.00",
  unit_cost: "20.00",
  vendor: "Some Vendor"
}
```

MOBY-compatible result concept:

```ts
{
  id: "package_1A406030000123",
  label: "1A406030000123",
  quantity: {
    value: 20,
    unit: "each"
  },
  unitCost: {
    amount: 20,
    currency: "USD"
  },
  totalCost: {
    amount: 400,
    currency: "USD"
  },
  metadata: {
    productName: "Blue Dream 3.5g",
    vendorName: "Some Vendor",
    rowNumber: 2,
    sourceFile: "samples/korona-export-money-example.csv"
  },
  externalReferences: [
    {
      system: "korona",
      externalId: "samples/korona-export-money-example.csv:2",
      label: "Normalized row reference"
    }
  ]
}
```

Package ID behavior:

```txt
package_id present                -> package_<trimmed package_id>
package_id missing + rowNumber    -> package_row_<rowNumber>
package_id missing + no rowNumber -> package_unidentified
```

Money parsing supports common POS/accounting formats:

```txt
400.00
$400.00
1,250.00
" $400.00 "
($42.00)
-42.00
```

Invalid money values, such as `N/A`, are omitted from `unitCost` or `totalCost` and remain visible through warnings and `validationIssues`.

---

### 6. MOBY Pieces To MobyImportSummary

File:

```txt
src/moby-import-summary.ts
```

Purpose:

```txt
Combine bridge outputs into the versioned sidecar summary written as moby-import.json.
```

Current summary shape:

```ts
{
  schemaVersion: "1.0";
  generatedBy: "trackingthc-import-mapper";
  generatedAt: string;
  mappingProfile: MappingProfile;
  importRun: ImportRun;
  validationIssues: ValidationIssue[];
  packages?: InventoryPackage[];
}
```

`schemaVersion`, `generatedBy`, and `generatedAt` are top-level metadata so consumers can display and validate the sidecar before drilling into packages or warnings.

---

## Design Rules

### 1. Do Not Change Working CLI Output Just To Match `moby-core`

The CLI output format is a product surface. These files should remain stable unless intentionally versioned:

```txt
normalized.csv
warnings.csv
summary.md
run-manifest.json
index.json
```

The bridge exists so these outputs can be represented in MOBY terms without breaking existing behavior.

### 2. Keep App-Specific Types Local

These should remain local unless there is a strong reason to promote them:

```txt
MappingFile
WarningRow
RunIndexEntry
RunManifest
```

They reflect this CLI's persisted file format and output behavior.

### 3. Prefer Adapters Over Refactors

Preferred flow:

```txt
local artifact -> adapter -> moby-core contract
```

This preserves CLI behavior while exposing portable shapes to downstream consumers.

### 4. Unknown Fields Should Become Review Items

Mapping conversion:

```txt
unknown normalized field -> FieldMapping status: needs_review
```

Warning conversion:

```txt
unknown warning code -> ValidationIssue without field
```

The bridge should be tolerant. Review workflows can decide what to do later.

### 5. Do Not Add New `moby-core` Primitives Casually

If a local app field does not map to `moby-core`, first ask:

```txt
Will at least two MOBY apps need this field or contract?
```

If no, keep it local. If yes, add it deliberately in `moby-core` with tests and docs.

---

## Current Tests

Bridge test files:

```txt
tests/normalized-to-canonical-field.test.ts
tests/moby-mapping-profile.test.ts
tests/moby-import-run.test.ts
tests/moby-validation-issue.test.ts
tests/moby-inventory-package.test.ts
tests/moby-import-summary.test.ts
```

CLI regression tests:

```txt
tests/cli.test.ts
```

Known passing checkpoint:

```txt
Test Files  7 passed (7)
Tests       45 passed (45)
```

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
coerce invalid money into zero
```

---

## Future Useful Slices

Potential next slices:

```txt
sample sidecar gallery
upload/local sidecar review in trackingthc.com
reconciliation prep
accounting export comparison
finance review workflow
```

Potential future flow:

```txt
moby-import.json packages
+ accounting package cost export
-> ReconciliationRun
-> ReconciliationIssue[]
-> finance review
```

---

## North Star

The CLI should continue to work as a simple file-based import mapper.

The bridge should make its artifacts understandable to the MOBY ecosystem:

```txt
operators get stable CSV and Markdown outputs
future apps get shared domain contracts
reviewers get schema metadata, validation issues, and package costs in one sidecar
```
