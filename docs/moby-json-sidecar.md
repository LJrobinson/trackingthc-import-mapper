# MOBY JSON Sidecar

Purpose: document the optional `moby-import.json` payload emitted by `trackingthc-import-mapper`.

The MOBY JSON sidecar is a portable import artifact created only when the CLI is run with:

```txt
--moby-json <path>
```

The normal CLI outputs remain unchanged. Depending on flags, they include:

```txt
normalized.csv
warnings.csv
summary.md
run-manifest.json
index.json
```

The sidecar gives MOBY-aware consumers, including `trackingthc.com/import-review`, one versioned payload that describes the mapping profile, import run, validation issues, and package entities produced by the import.

---

## Example Command

```txt
npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id moby-sidecar-test-001 --moby-json output/runs/moby-sidecar-test-001/moby-import.json
```

Expected console line:

```txt
MOBY JSON written: output/runs/moby-sidecar-test-001/moby-import.json
```

---

## Payload Shape

Current sidecar shape:

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

JSON outline:

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

The top-level schema metadata is part of the current contract. It lets consumers distinguish one sidecar format from another without inspecting every nested object.

---

## Top-Level Metadata

### `schemaVersion`

The sidecar schema version emitted by this mapper. Current value:

```txt
1.0
```

### `generatedBy`

The generator name. Current value:

```txt
trackingthc-import-mapper
```

### `generatedAt`

The timestamp when the sidecar was generated. The CLI uses the same run timestamp as the import manifest so reviewers can connect the sidecar to the run folder.

`trackingthc.com/import-review` displays this schema metadata so reviewers can see which generator and schema produced the loaded sidecar.

---

## Source Bridge Modules

The sidecar is built from local CLI artifacts using bridge adapters:

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
normalized row   -> InventoryPackage
MOBY pieces      -> MobyImportSummary
```

The CLI still owns CSV parsing, mapping validation, normalization, warning generation, and file writing. The bridge adapts those outputs into MOBY-compatible contracts.

---

## `mappingProfile`

`mappingProfile` describes how source CSV headers map into MOBY canonical fields.

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

Unknown normalized fields become review entries:

```json
{
  "sourceField": "Some Header",
  "status": "needs_review",
  "note": "No moby-core CanonicalField mapping exists for normalized field: some_field"
}
```

Unknown fields should not crash sidecar generation.

---

## `importRun`

`importRun` describes the import event using MOBY portable shape. It is adapted from the local `run-manifest.json`.

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

The local run manifest remains app-specific. The sidecar adapts it into MOBY shape.

---

## `validationIssues`

`validationIssues` contains MOBY-compatible warnings adapted from `warnings.csv` rows.

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

Unknown warning codes should preserve code and message, omit `field`, and continue sidecar generation.

---

## `packages`

`packages` contains MOBY `InventoryPackage` entities adapted from normalized rows.

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
  "metadata": {
    "productName": "Blue Dream 3.5g",
    "vendorName": "Some Vendor",
    "rowNumber": 2,
    "sourceFile": "samples/korona-export-example.csv"
  },
  "externalReferences": [
    {
      "system": "korona",
      "externalId": "samples/korona-export-example.csv:2",
      "label": "Normalized row reference"
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

Quantity behavior:

```txt
valid quantity   -> { value, unit: "each" }
invalid quantity -> quantity omitted
missing quantity -> quantity omitted
```

Money behavior:

```txt
valid unit_cost   -> unitCost USD money
valid total_cost  -> totalCost USD money
invalid/missing   -> omitted
```

Supported money formats include:

```txt
400.00
$400.00
1,250.00
" $400.00 "
($42.00)
-42.00
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

## Invalid Money Behavior

Invalid money values are intentionally not coerced.

For a row like:

```csv
product_name,package_id,quantity,total_cost,vendor,unit_cost
Bad Cost Example,1A406030000888,10,N/A,Some Vendor,
```

The generated package omits `totalCost`:

```json
{
  "id": "package_1A406030000888",
  "label": "1A406030000888",
  "quantity": {
    "value": 10,
    "unit": "each"
  },
  "metadata": {
    "productName": "Bad Cost Example",
    "vendorName": "Some Vendor",
    "rowNumber": 5,
    "sourceFile": "samples/korona-export-money-example.csv"
  }
}
```

The reason is preserved in `validationIssues`:

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

`trackingthc.com/import-review` renders missing money values as `—` so reviewers can distinguish unresolved values from zero-dollar values.

---

## What This File Is For

Future TrackingTHC apps can ingest `moby-import.json` and understand:

```txt
which file was imported
which source system it came from
which sidecar schema was generated
how fields were mapped
what warnings occurred
what package entities were produced
which rows/packages need review
```

This avoids forcing future apps to understand the CLI's internal file formats.

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

Do not change these files just to fit MOBY shape:

```txt
normalized.csv
warnings.csv
summary.md
run-manifest.json
index.json
```

Use adapters.

### 3. Sidecar changes are contract changes

Additive changes are preferred. Breaking changes should be reflected in `schemaVersion`.

### 4. Unknown fields should become reviewable

Unknown mappings should use `needs_review`. Unknown warning codes should preserve code/message and omit inferred field.

### 5. Invalid package numbers should be omitted

Invalid quantities or money values should not throw from sidecar generation and should not be replaced with invented values.

---

## Current Verification Checkpoint

Known passing checkpoint:

```txt
Test Files  7 passed (7)
Tests       45 passed (45)
```

The tests cover:

```txt
default behavior when --moby-json is omitted
sidecar file creation when requested
schema metadata
mappingProfile
importRun
validationIssues
packages
package cost parsing
package metadata
package externalReferences
normal successful-run outputs
```

---

## Future Consumers

Potential future consumers:

```txt
trackingthc.com import review
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

The sidecar lets the import mapper remain a practical CLI while producing a portable ecosystem artifact.
