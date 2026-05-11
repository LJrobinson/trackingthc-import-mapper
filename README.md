# TrackingTHC Import Mapper

> Cannabis retail imports are messy. This tool turns vendor/POS exports into normalized, finance-readable, audit-friendly data.

`trackingthc-import-mapper` is a TypeScript CLI for taking operational cannabis CSV exports and converting them into consistent normalized outputs.

It started with one practical question:

> How do we turn messy package cost exports into something finance, inventory, and operations can actually trust?

The current answer:

```txt
CSV export
+ mapping JSON
-> normalized.csv
-> warnings.csv
-> summary.md
-> run-manifest.json
-> index.json
-> optional moby-import.json
```

This is not a full POS. This is the baby ingestion layer that can grow into TrackingTHC.

Clipboard goblin approved. 😈🏁

---

## Why This Exists

Cannabis operators often have important business data split across disconnected systems:

```txt
POS
compliance system
vendor invoices
accounting exports
spreadsheets
inventory counts
```

That creates repeated pain:

```txt
What did we buy?
What did it cost?
What is the unit cost?
What package does this belong to?
Why does accounting disagree with inventory?
Which rows are bad?
Can finance trust this file?
```

This CLI creates a repeatable import process with normalized fields, warning detection, run history, human-readable summaries, and portable MOBY JSON output.

---

## Current Status

```txt
Status: Working
Version milestone: v1.4 - MOBY packages sidecar
Tests: 45 passing
Language: TypeScript
Runtime: Node.js
Test runner: Vitest
```

Validated checkpoint:

```txt
Test Files  7 passed (7)
Tests       45 passed (45)
```

---

## What It Does

The CLI currently supports:

```txt
read a source CSV
read a mapping JSON file
normalize mapped fields
calculate unit_cost
validate rows and generate warnings
write normalized CSV
write warnings CSV
write Markdown summary report
write run manifest JSON
write run index JSON
optionally write MOBY-compatible JSON sidecar
```

---

## Core Outputs

A successful run can produce:

```txt
normalized.csv
warnings.csv
summary.md
run-manifest.json
index.json
moby-import.json
```

### `normalized.csv`

Clean normalized output for downstream finance/reconciliation work.

```csv
product_name,package_id,quantity,total_cost,vendor,unit_cost
Blue Dream 3.5g,1A406030000123,20,400.00,Some Vendor,20.00
Gelato Pre-Roll,1A406030000456,50,250.00,Another Vendor,5.00
```

### `warnings.csv`

Review file for rows that imported but need attention.

```csv
row_number,warning_code,message,product_name,package_id,quantity,total_cost
5,INVALID_TOTAL_COST,Total cost is not a valid number.,Bad Cost Example,1A406030000888,10,N/A
5,UNIT_COST_NOT_CALCULATED,Unit cost could not be calculated.,Bad Cost Example,1A406030000888,10,N/A
```

### `summary.md`

Human-readable finance/operator summary including run ID, status, source system, rows processed, unit costs calculated, warning count, output paths, and finance review notes.

### `run-manifest.json`

Machine-readable record of the import run.

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

### `index.json`

File-based import history when using `--run-dir`.

```json
{
  "run_id": "clipboard-test-001",
  "status": "success",
  "source_system": "korona",
  "rows_processed": 2,
  "unit_costs_calculated": 2,
  "warnings": 0,
  "ran_at": "2026-05-10T01:01:06.162Z",
  "manifest_file": "output/runs/clipboard-test-001/run-manifest.json"
}
```

### `moby-import.json`

Optional MOBY-compatible sidecar artifact containing:

```txt
mappingProfile
importRun
validationIssues
packages
```

This is the bridge into the broader MOBY ecosystem.

---

## Quick Start

```bash
npm install
npm test
npm run build
```

Run the CLI:

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv
```

---

## Example: Basic Import

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv
```

Example result:

```txt
Rows processed: 2
Output written: output/normalized.csv
Unit costs calculated: 2
```

---

## Example: Import With Warnings

```bash
npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --out output/normalized-money.csv --warnings output/warnings-money.csv
```

Example result:

```txt
Rows processed: 4
Output written: output/normalized-money.csv
Unit costs calculated: 3
Warnings: 2
Warnings written: output/warnings-money.csv
```

---

## Example: Run Directory Mode

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id clean-lap-001
```

Creates:

```txt
output/runs/clean-lap-001/
  normalized.csv
  warnings.csv
  summary.md
  run-manifest.json

output/runs/index.json
```

---

## Example: MOBY JSON Sidecar

```bash
npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id moby-sidecar-test-001 --moby-json output/runs/moby-sidecar-test-001/moby-import.json
```

Example result includes:

```txt
MOBY JSON written: output/runs/moby-sidecar-test-001/moby-import.json
```

The sidecar contains:

```json
{
  "mappingProfile": {},
  "importRun": {},
  "validationIssues": [],
  "packages": []
}
```

This lets future TrackingTHC apps ingest one portable import payload without needing to understand every CLI implementation detail.

---

## Mapping JSON

Mappings are source CSV header to normalized output field.

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

This says:

```txt
CSV column "Item Name" becomes normalized field "product_name"
CSV column "Package ID" becomes normalized field "package_id"
CSV column "Qty On Hand" becomes normalized field "quantity"
CSV column "Total Cost" becomes normalized field "total_cost"
CSV column "Vendor" becomes normalized field "vendor"
```

---

## Normalized Fields

Currently supported/common normalized fields include:

```txt
product_name
package_id
quantity
total_cost
unit_cost
vendor
category
received_date
```

Known MOBY canonical mappings:

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

Unknown fields become reviewable mapping entries instead of crashing.

No raccoon doors.

---

## Validation and Warning Behavior

Bad row data should generate warnings.

Bad mapping setup should fail fast.

Example warning concepts:

```txt
INVALID_QUANTITY
INVALID_TOTAL_COST
UNIT_COST_NOT_CALCULATED
MISSING_PACKAGE_ID
MISSING_PRODUCT_NAME
```

Supported numeric parsing includes:

```txt
400.00
$400.00
1,250.00
"1,250.00"
" $400.00 "
($42.00)
-42.00
```

Rejected formats include:

```txt
N/A
abc
empty string
whitespace-only values
```

If `quantity` and `total_cost` are valid, the CLI calculates:

```txt
unit_cost = total_cost / quantity
```

If values are invalid, the row can still be emitted with warnings for review.

---

## Bad Mapping Behavior

If the mapping JSON references a source header that does not exist in the CSV, the import fails before writing outputs.

Example:

```txt
Mapping validation failed.

Missing source headers:
- Item Nam

Available CSV headers:
- Item Name
- Package ID
- Qty On Hand
- Total Cost
- Vendor
```

No normalized output, warnings file, manifest, summary, run folder, or index update should be created for failed mapping validation.

Bad row data is reviewable. Bad mapping setup is not trustworthy.

---

## MOBY Bridge

This project consumes `moby-core` as a local/shared contract dependency.

`moby-core` provides portable shared types such as:

```txt
CanonicalField
MappingProfile
ImportRun
ValidationIssue
InventoryPackage
```

This repo keeps its CLI-specific file formats local and uses bridge adapters to convert them into MOBY-compatible contracts.

Bridge coverage:

```txt
normalized field -> CanonicalField
MappingFile      -> MappingProfile
RunManifest      -> ImportRun
WarningRow       -> ValidationIssue
normalized row   -> InventoryPackage
MOBY pieces      -> MobyImportSummary
```

Bridge files:

```txt
src/normalized-to-canonical-field.ts
src/moby-mapping-profile.ts
src/moby-import-run.ts
src/moby-validation-issue.ts
src/moby-inventory-package.ts
src/moby-import-summary.ts
```

The important design rule:

> Do not rewrite the working CLI to match MOBY. Adapt the working CLI into MOBY contracts.

---

## MOBY JSON Sidecar Shape

Current shape:

```ts
{
  mappingProfile: MappingProfile;
  importRun: ImportRun;
  validationIssues: ValidationIssue[];
  packages?: InventoryPackage[];
}
```

Example package entity:

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

This makes `moby-import.json` useful for future TrackingTHC dashboards, import history, finance review, inventory reconciliation, package cost review, and audit trails.

---

## Project Structure

```txt
docs/
  moby-bridge.md
  moby-json-sidecar.md
  normalized-fields.md
  progress-log.md

samples/
  korona-export-example.csv
  korona-export-money-example.csv
  korona-mapping.json

src/
  cli.ts
  moby-import-run.ts
  moby-import-summary.ts
  moby-inventory-package.ts
  moby-mapping-profile.ts
  moby-validation-issue.ts
  normalized-to-canonical-field.ts

tests/
  cli.test.ts
  moby-import-run.test.ts
  moby-import-summary.test.ts
  moby-inventory-package.test.ts
  moby-mapping-profile.test.ts
  moby-validation-issue.test.ts
  normalized-to-canonical-field.test.ts
```

---

## Scripts

```bash
npm run import
npm run cli
npm run build
npm test
```

---

## Development Commands

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

Run CLI:

```bash
npm run import -- --csv <path> --map <path> --out <path>
```

Run CLI with run directory:

```bash
npm run import -- --csv <path> --map <path> --run-dir output/runs --run-id my-run-001
```

Run CLI with MOBY sidecar:

```bash
npm run import -- --csv <path> --map <path> --run-dir output/runs --run-id my-run-001 --moby-json output/runs/my-run-001/moby-import.json
```

---

## Current Milestones

```txt
v0.1 - Manual Mapping CLI
v0.2 - Validation Warnings / Roll Cage
v0.3 - Number Parsing / Fuel System
v0.4 - Mapping Validation / Pre-Flight Checklist
v0.5 - Run Manifest / Audit Ledger Seed
v0.6 - Run ID and Status
v0.7 - Run Directory / File-Based Import History
v0.8 - Run Index / Clipboard Mode
v0.9 - Markdown Summary Report
v1.0 - Core Lock Tests
v1.1 - MOBY Bridge Layer
v1.2 - Optional MOBY JSON Sidecar Export
v1.3 - Normalized Rows to InventoryPackage Bridge
v1.4 - InventoryPackage Entities in MOBY JSON Sidecar
```

---

## Roadmap

Near-term possibilities:

```txt
v1.5 - Sidecar schema/version metadata
v1.6 - Reconciliation prep
v1.7 - Accounting export comparison
v1.8 - ReconciliationIssue generation
v1.9 - Import review workflow
```

Potential future flow:

```txt
moby-import.json
+ accounting export
-> ReconciliationRun
-> ReconciliationIssue[]
-> finance review
```

This is the path from import mapper to TrackingTHC reconciliation engine.

---

## Design Philosophy

### Keep the CLI practical

Operators need files they can inspect:

```txt
CSV
Markdown
JSON manifest
```

### Keep contracts portable

Future apps need stable shapes:

```txt
MappingProfile
ImportRun
ValidationIssue
InventoryPackage
```

### Prefer adapters over rewrites

Do this:

```txt
local artifact -> adapter -> MOBY contract
```

Do not do this:

```txt
rewrite working CLI output just to match framework types
```

### Fail fast on bad setup

Bad mapping config should stop the import before outputs are written.

### Warn on bad row data

Bad rows should be reviewable when possible.

### Preserve auditability

Every successful run should have:

```txt
run ID
source system
source file
mapping file
outputs
counts
timestamp
```

---

## What This Is Not

This is not:

```txt
a full POS
a full ERP
a compliance submission system
a database-backed app
a vendor API connector
a Metrc/Dutchie/Korona replacement
```

It is a focused ingestion and normalization tool.

That is the wedge.

---

## Why It Matters

Cannabis operators often cannot answer basic financial/inventory questions without manual spreadsheet archaeology.

This project creates the first layer of structure:

```txt
import messy export
normalize fields
calculate unit cost
flag bad rows
record run history
emit portable MOBY payload
```

That is the foundation for:

```txt
COGS
unit cost
package cost
inventory valuation
margin review
variance detection
reconciliation workflows
finance-readable reporting
```

Tiny goblin. Real chassis. Ceramic shine. 🏎️🏁
