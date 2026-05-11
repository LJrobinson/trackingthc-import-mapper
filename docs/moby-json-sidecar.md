# MOBY JSON Sidecar

> Purpose: document the optional `moby-import.json` payload emitted by `trackingthc-import-mapper`.

The MOBY JSON sidecar is an optional portable artifact created by the CLI when the user provides:

```txt
--moby-json <path>
```

It allows the file-based import mapper to keep producing its normal operator-friendly files while also emitting a structured MOBY-compatible payload for future TrackingTHC apps.

This is the bridge from:

```txt
working CLI outputs
```

to:

```txt
MOBY ecosystem ingestion payload
```

Tiny goblin payload confirmed.

---

## Current CLI Behavior

Default behavior is unchanged.

If `--moby-json` is omitted, the CLI writes the normal files only:

```txt
normalized.csv
warnings.csv
summary.md
run-manifest.json
index.json
```

No MOBY JSON file is written.

If `--moby-json <path>` is provided after a successful import, the CLI additionally writes:

```txt
moby-import.json
```

Example command:

```txt
npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id moby-sidecar-test-001 --moby-json output/runs/moby-sidecar-test-001/moby-import.json
```

Expected console line:

```txt
MOBY JSON written: output/runs/moby-sidecar-test-001/moby-import.json
```

---

## Payload Shape

The current sidecar shape is:

```ts
{
  mappingProfile: MappingProfile;
  importRun: ImportRun;
  validationIssues: ValidationIssue[];
  packages?: InventoryPackage[];
}
```

In JSON form:

```json
{
  "mappingProfile": {},
  "importRun": {},
  "validationIssues": [],
  "packages": []
}
```

The `packages` key is included when package entities are generated from normalized rows.

---

## Source Bridge Modules

The sidecar is built using the local MOBY bridge layer:

```txt
src/normalized-to-canonical-field.ts
src/moby-mapping-profile.ts
src/moby-import-run.ts
src/moby-validation-issue.ts
src/moby-inventory-package.ts
src/moby-import-summary.ts
```

Bridge flow:

```txt
MappingFile      -> MappingProfile
RunManifest      -> ImportRun
WarningRow       -> ValidationIssue
Normalized row   -> InventoryPackage
MOBY pieces      -> MobyImportSummary
```

The CLI still owns file parsing and output behavior.

The bridge adapts those outputs into MOBY-compatible contracts.

---

## `mappingProfile`

The `mappingProfile` describes how source CSV headers map into MOBY canonical fields.

Example source mapping JSON:

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

Example MOBY mapping output:

```json
{
  "id": "moby-sidecar-test-001-mapping-profile",
  "name": "korona import mapping",
  "source": "korona",
  "createdAt": "2026-05-10T19:03:29.000Z",
  "mappings": [
    {
      "sourceField": "Item Name",
      "canonicalField": "product.name",
      "status": "mapped"
    },
    {
      "sourceField": "Package ID",
      "canonicalField": "package.id",
      "status": "mapped"
    },
    {
      "sourceField": "Qty On Hand",
      "canonicalField": "package.quantity",
      "status": "mapped"
    },
    {
      "sourceField": "Total Cost",
      "canonicalField": "package.totalCost",
      "status": "mapped"
    },
    {
      "sourceField": "Vendor",
      "canonicalField": "vendor.name",
      "status": "mapped"
    }
  ]
}
```

Known normalized-to-canonical mappings:

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

Unknown normalized fields become:

```json
{
  "sourceField": "Some Header",
  "status": "needs_review",
  "note": "No moby-core CanonicalField mapping exists for normalized field: some_field"
}
```

Unknown fields should not crash sidecar generation.

They should create reviewable mapping entries.

---

## `importRun`

The `importRun` describes the import event using MOBY portable shape.

It is adapted from the local run manifest.

Example:

```json
{
  "id": "moby-sidecar-test-001",
  "source": "korona",
  "status": "completed_with_warnings",
  "filename": "samples/korona-export-money-example.csv",
  "startedAt": "2026-05-10T19:03:29.000Z",
  "completedAt": "2026-05-10T19:03:29.000Z",
  "summary": {
    "rowCount": 4,
    "successCount": 4,
    "warningCount": 2,
    "errorCount": 0
  },
  "metadata": {
    "sourceFile": "samples/korona-export-money-example.csv",
    "mappingFile": "samples/korona-mapping.json",
    "outputFile": "output/runs/moby-sidecar-test-001/normalized.csv",
    "warningsFile": "output/runs/moby-sidecar-test-001/warnings.csv",
    "unitCostsCalculated": 3,
    "originalStatus": "success"
  }
}
```

Status conversion rules:

```txt
success + warnings = 0 -> completed
success + warnings > 0 -> completed_with_warnings
failed                  -> failed
anything else           -> completed_with_warnings
```

The local `run-manifest.json` format remains unchanged.

The sidecar adapts it into MOBY shape.

---

## `validationIssues`

The `validationIssues` array contains MOBY-compatible warnings adapted from warning rows.

Example:

```json
{
  "code": "INVALID_TOTAL_COST",
  "severity": "warning",
  "message": "Total cost is not a valid number.",
  "field": "package.totalCost",
  "rowNumber": 5,
  "metadata": {
    "productName": "Bad Cost Example",
    "packageId": "1A406030000888",
    "quantity": "10",
    "totalCost": "N/A"
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

Unknown warning codes:

```txt
do not throw
omit field
preserve code and message
```

Metadata behavior:

```txt
include productName when present
include packageId when present
include quantity when present
include totalCost when present
omit undefined metadata keys
```

---

## `packages`

The `packages` array contains MOBY `InventoryPackage` entities adapted from normalized rows.

Example normalized CSV row:

```csv
product_name,package_id,quantity,total_cost,vendor,unit_cost
Blue Dream 3.5g,1A406030000123,20,400.00,Some Vendor,20.00
```

Example sidecar package:

```json
{
  "id": "package_1A406030000123",
  "label": "1A406030000123",
  "quantity": {
    "value": 20,
    "unit": "each"
  },
  "unitCost": {
    "amount": 20,
    "currency": "USD"
  },
  "totalCost": {
    "amount": 400,
    "currency": "USD"
  },
  "externalReferences": [
    {
      "system": "korona",
      "externalId": "samples/korona-export-example.csv:2",
      "label": "Normalized row reference"
    }
  ],
  "metadata": {
    "productName": "Blue Dream 3.5g",
    "vendorName": "Some Vendor",
    "rowNumber": 2,
    "sourceFile": "samples/korona-export-example.csv"
  }
}
```

Package ID behavior:

```txt
package_id present               -> package_<trimmed package_id>
package_id missing + rowNumber   -> package_row_<rowNumber>
package_id missing + no rowNumber -> package_unidentified
```

Label behavior:

```txt
package_id present -> label = package_id
package_id missing -> label omitted
```

Numeric parsing behavior:

```txt
trim value
Number(value)
accept only finite numbers
omit invalid values
do not throw
```

Quantity behavior:

```txt
quantity valid -> { value, unit: "each" }
quantity invalid/missing -> omitted
```

Money behavior:

```txt
unit_cost valid  -> unitCost USD money
total_cost valid -> totalCost USD money
invalid/missing  -> omitted
```

External reference behavior:

```txt
sourceSystem + sourceFile + rowNumber -> sourceFile:rowNumber
sourceSystem + rowNumber              -> row:<rowNumber>
sourceSystem + sourceFile             -> sourceFile
no sourceSystem                       -> no externalReferences
```

Metadata behavior:

```txt
product_name -> metadata.productName
vendor       -> metadata.vendorName
rowNumber    -> metadata.rowNumber
sourceFile   -> metadata.sourceFile
```

Undefined metadata values are omitted.

---

## What This File Is For

Future TrackingTHC apps can ingest `moby-import.json` and immediately understand:

```txt
which file was imported
which source system it came from
how fields were mapped
what warnings occurred
what package entities were produced
which rows/packages need review
```

This avoids forcing future apps to understand every CLI implementation detail.

They can consume the sidecar as a portable contract payload.

---

## What This File Is Not

The MOBY JSON sidecar is not:

```txt
a database dump
a replacement for normalized.csv
a replacement for warnings.csv
a replacement for run-manifest.json
a vendor API response
a writeback payload
a compliance submission
```

It is a portable import artifact.

---

## Design Rules

### 1. Default CLI behavior stays unchanged

Do not write `moby-import.json` unless `--moby-json` is explicitly provided.

### 2. Existing output files stay stable

Do not change:

```txt
normalized.csv
warnings.csv
summary.md
run-manifest.json
index.json
```

just to fit MOBY shape.

Use adapters.

### 3. The sidecar can evolve, but carefully

Because future apps may ingest this file, changes to the sidecar should be treated as contract changes.

Additive changes are preferred.

Breaking changes should be versioned.

### 4. Unknown fields should become reviewable, not fatal

Unknown mappings should use:

```txt
needs_review
```

Unknown warning codes should preserve code/message and omit inferred field.

Invalid package numbers should be omitted, not thrown.

Validation belongs elsewhere.

### 5. Do not put vendor API behavior here

This sidecar is produced from local import artifacts.

It should not call:

```txt
Metrc
Korona
Dutchie
QuickBooks
Weedmaps
Leafly
```

No raccoon API doors.

---

## Current Verification

Known passing checkpoint:

```txt
npm run build
npm test
```

Result:

```txt
Test Files  7 passed (7)
Tests       45 passed (45)
```

The tests verify:

```txt
default behavior when --moby-json is omitted
sidecar file creation when requested
mappingProfile exists
importRun exists
validationIssues exist
warnings convert to ValidationIssue
packages exist
packages include expected InventoryPackage fields
package metadata is included
package externalReferences include normalized row reference
normal successful-run outputs still exist
```

---

## Future Consumers

Potential future consumers:

```txt
trackingthc.com dashboard
reconciliation engine
finance review workflow
import history viewer
audit trail viewer
vendor/package matching tools
```

Potential ingestion flow:

```txt
moby-import.json
-> importRun
-> mappingProfile
-> validationIssues
-> packages
-> review workflow
-> reconciliation
```

This is the path from file-based import mapper to TrackingTHC platform behavior.

---

## Future Useful Slices

### v1.5 option: sidecar schema/version metadata

Potential addition:

```json
{
  "schemaVersion": "1.0",
  "generatedBy": "trackingthc-import-mapper",
  "generatedAt": "2026-05-10T19:25:43.000Z",
  "mappingProfile": {},
  "importRun": {},
  "validationIssues": [],
  "packages": []
}
```

This would make the sidecar safer for future app ingestion.

### v1.6 option: reconciliation prep

Potential flow:

```txt
moby-import.json packages
+ accounting package cost export
-> ReconciliationRun
-> ReconciliationIssue[]
```

This is where the finance goblins start paying attention.

---

## North Star

The MOBY JSON sidecar lets the import mapper remain a practical CLI while also producing a portable ecosystem artifact.

Operators get files they understand.

Future apps get contracts they can ingest.

The raccoons get nothing.

Clipboard goblin approved.
