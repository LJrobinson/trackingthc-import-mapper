# TrackingTHC Import Mapper

`trackingthc-import-mapper` is a TypeScript CLI for cannabis import normalization. It converts messy POS, inventory, and accounting CSV exports into normalized, reviewable files that finance, inventory, and operations teams can inspect together.

The project creates a trust layer between operational exports and reconciliation workflows:

```txt
CSV export + mapping JSON
-> normalized.csv
-> warnings.csv
-> summary.md
-> run-manifest.json
-> moby-run-manifest.json for run-directory imports
-> index.json
-> optional moby-import.json
```

It is intentionally focused. This is not a full POS, not a production SaaS, and not a compliance submission tool. It is a working, tested MVP/portfolio-grade ingestion layer for turning uncertain spreadsheet data into auditable import artifacts.

---

## Why It Exists

Cannabis operators often inherit data from disconnected systems:

```txt
POS exports
vendor invoices
accounting spreadsheets
inventory counts
compliance systems
```

Those files usually do not agree cleanly. Teams still need to answer practical questions:

```txt
What package did this row describe?
What was the total cost?
Can unit cost be calculated?
Which rows are incomplete or malformed?
What source file and mapping produced this output?
Can finance trust this import yet?
```

This CLI makes the import process repeatable. It normalizes mapped fields, calculates unit costs where possible, records warnings where trust breaks down, writes a run manifest, and can emit a versioned MOBY JSON sidecar for downstream review.

---

## Current Status

```txt
Status: Working MVP
Language: TypeScript
Runtime: Node.js
Test runner: Vitest
Current documentation milestone: v1.6 - MOBY Run Manifest Sidecar
Verification: run the local test and build commands after changes
```

The core behavior is covered by tests, but the project should still be treated as an ingestion prototype rather than production infrastructure.

---

## Quick Start

Install dependencies:

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Build TypeScript:

```bash
npm run build
```

Run a basic import:

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv
```

---

## Example Commands

### Basic Import

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv
```

Produces a normalized CSV and default support files:

```txt
output/normalized.csv
output/warnings.csv
output/summary.md
output/run-manifest.json
```

### Import With Warnings

```bash
npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --out output/normalized-money.csv --warnings output/warnings-money.csv
```

Bad row data does not crash the run. It is written to `warnings.csv` for review while valid rows continue through the pipeline.

### Run Directory Import

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id clean-lap-001
```

Creates a saved run folder:

```txt
output/runs/clean-lap-001/
  normalized.csv
  warnings.csv
  summary.md
  run-manifest.json
  moby-run-manifest.json

output/runs/index.json
```

`run-manifest.json` remains the existing mapper-local audit file. `moby-run-manifest.json` is an additional MOBY-compatible run manifest sidecar for downstream tools.

### MOBY JSON Sidecar Export

```bash
npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id moby-sidecar-test-001 --moby-json output/runs/moby-sidecar-test-001/moby-import.json
```

Adds:

```txt
output/runs/moby-sidecar-test-001/moby-import.json
```

The sidecar is the portable bridge artifact for MOBY-aware consumers such as `trackingthc.com/import-review`.

---

## Core Outputs

### `normalized.csv`

Clean normalized output for finance and reconciliation work.

```csv
product_name,package_id,quantity,total_cost,vendor,unit_cost
Blue Dream 3.5g,1A406030000123,20,400.00,Some Vendor,20.00
Gelato Pre-Roll,1A406030000456,50,250.00,Another Vendor,5.00
```

### `warnings.csv`

Rows that imported but need review.

```csv
row_number,warning_code,message,product_name,package_id,quantity,total_cost
5,INVALID_TOTAL_COST,Total cost is not a valid number.,Bad Cost Example,1A406030000888,10,N/A
5,UNIT_COST_NOT_CALCULATED,Unit cost could not be calculated.,Bad Cost Example,1A406030000888,10,N/A
```

### `summary.md`

A human-readable import report with run ID, status, source system, rows processed, warning counts, output paths, and finance review notes.

### `run-manifest.json`

The machine-readable audit record for one successful import.

```json
{
  "run_id": "summary-test-001",
  "status": "success",
  "source_system": "korona",
  "source_file": "samples/korona-export-money-example.csv",
  "mapping_file": "samples/korona-mapping.json",
  "output_file": "output/runs/summary-test-001/normalized.csv",
  "warnings_file": "output/runs/summary-test-001/warnings.csv",
  "summary_file": "output/runs/summary-test-001/summary.md",
  "rows_processed": 4,
  "unit_costs_calculated": 3,
  "warnings": 2,
  "ran_at": "2026-05-10T01:01:30.889Z"
}
```

### `index.json`

A file-based import history when using `--run-dir`.

```json
[
  {
    "run_id": "clipboard-test-001",
    "status": "success",
    "source_system": "korona",
    "rows_processed": 2,
    "unit_costs_calculated": 2,
    "warnings": 0,
    "ran_at": "2026-05-10T01:01:06.162Z",
    "manifest_file": "output/runs/clipboard-test-001/run-manifest.json",
    "summary_file": "output/runs/clipboard-test-001/summary.md"
  }
]
```

### `moby-run-manifest.json`

An automatically generated MOBY-compatible run manifest sidecar for `--run-dir` imports. It does not replace `run-manifest.json`; it describes the same run using the shared `MobyRunManifest` contract from `moby-core`.

It includes:

```txt
schemaVersion
runId
runType
generatedBy
generatedAt
status
sources
artifacts
warnings
summary
metadata
```

The artifact list points at the files in the saved run, including `normalized.csv`, `warnings.csv`, `summary.md`, the existing `run-manifest.json`, `../index.json`, itself, and `moby-import.json` when that optional sidecar was requested with `--moby-json`.

### `moby-import.json`

An optional versioned sidecar for MOBY ecosystem consumers.

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

---

## Mapping JSON

Mapping files map source CSV headers to normalized output fields.

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

This means:

```txt
CSV column "Item Name" becomes normalized field "product_name"
CSV column "Package ID" becomes normalized field "package_id"
CSV column "Qty On Hand" becomes normalized field "quantity"
CSV column "Total Cost" becomes normalized field "total_cost"
CSV column "Vendor" becomes normalized field "vendor"
```

Bad mapping setup fails fast before outputs are written. If the mapping references a CSV header that does not exist, the import stops with a clear error and does not create normalized output, warnings, manifest, summary, run folder, or index updates.

Bad row data is different. It produces warnings where possible so the import remains reviewable.

---

## Normalized Fields

Common normalized fields include:

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

Unknown normalized fields become reviewable mapping entries instead of crashing sidecar generation.

---

## Validation And Money Parsing

The CLI calculates `unit_cost` when both `quantity` and `total_cost` are valid:

```txt
unit_cost = total_cost / quantity
```

Money parsing supports common POS and accounting formats:

```txt
400.00
$400.00
1,250.00
" $400.00 "
($42.00)
-42.00
```

Invalid values remain unresolved:

```txt
N/A
abc
empty string
whitespace-only values
```

That is deliberate. The mapper should not invent financial values. Invalid cost data is omitted from MOBY package money fields and surfaced through warnings and `validationIssues` so finance can resolve it with source context.

---

## MOBY Ecosystem

The project sits between shared contracts and the TrackingTHC review experience:

```txt
moby-core
  defines shared contracts
  MappingProfile, ImportRun, ValidationIssue, InventoryPackage, MobyRunManifest

trackingthc-import-mapper
  consumes those contracts
  converts local CSV import artifacts into versioned MOBY JSON sidecars and run manifests

trackingthc.com
  consumes and displays sidecars at /import-review
  gives reviewers a clearer view of imports, warnings, schema metadata, and package costs
```

The design rule is simple:

```txt
local artifact -> adapter -> MOBY contract
```

The CLI keeps its practical file outputs. The MOBY bridge gives future apps a stable contract payload.

---

## MOBY JSON Sidecar

`moby-import.json` currently includes:

```txt
schemaVersion
generatedBy
generatedAt
mappingProfile
importRun
validationIssues
packages
```

### Schema Metadata

The top-level metadata identifies which sidecar contract was emitted and when:

```json
{
  "schemaVersion": "1.0",
  "generatedBy": "trackingthc-import-mapper",
  "generatedAt": "2026-05-10T19:25:43.000Z"
}
```

`trackingthc.com/import-review` can display this metadata so reviewers know which generator and schema produced the file.

### `mappingProfile`

Describes how source CSV headers map into MOBY canonical fields.

### `importRun`

Describes the import event: source system, filename, run status, row counts, warning counts, and local artifact metadata.

### `validationIssues`

Contains warnings adapted into MOBY review issues, including fields such as `package.totalCost`, `package.quantity`, or `package.unitCost` when the warning code can be inferred.

### `packages`

Contains `InventoryPackage` entities derived from normalized rows.

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

If `total_cost` is invalid, `package.totalCost` is omitted and the reason appears in `validationIssues`.

---

## MOBY Bridge Modules

```txt
src/normalized-to-canonical-field.ts
src/moby-mapping-profile.ts
src/moby-import-run.ts
src/moby-validation-issue.ts
src/moby-inventory-package.ts
src/moby-import-summary.ts
src/moby-run-manifest.ts
```

Current bridge coverage:

```txt
normalized field -> CanonicalField
MappingFile      -> MappingProfile
RunManifest      -> ImportRun
WarningRow       -> ValidationIssue
normalized row   -> InventoryPackage
MOBY pieces      -> MobyImportSummary
run output files -> MobyRunManifest
```

---

## Scripts

```bash
npm run import
npm run cli
npm run build
npm test
```

Run CLI with explicit output:

```bash
npm run import -- --csv <path> --map <path> --out <path>
```

Run CLI with saved run directory:

```bash
npm run import -- --csv <path> --map <path> --run-dir output/runs --run-id my-run-001
```

Run-directory imports also write `moby-run-manifest.json` beside the existing run outputs.

Run CLI with MOBY sidecar:

```bash
npm run import -- --csv <path> --map <path> --run-dir output/runs --run-id my-run-001 --moby-json output/runs/my-run-001/moby-import.json
```

`moby-import.json` remains optional and is written only when `--moby-json` is provided. When present, it is referenced from `moby-run-manifest.json`.

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
  moby-run-manifest.ts
  moby-validation-issue.ts
  normalized-to-canonical-field.ts

tests/
  cli.test.ts
  moby-import-run.test.ts
  moby-import-summary.test.ts
  moby-inventory-package.test.ts
  moby-mapping-profile.test.ts
  moby-run-manifest.test.ts
  moby-validation-issue.test.ts
  normalized-to-canonical-field.test.ts
```

---

## Current Milestones

```txt
v1.4   - InventoryPackage entities in MOBY sidecar
v1.4.1 - Hardened money parsing for package costs
v1.5   - Versioned MOBY sidecar metadata
v1.6   - MOBY Run Manifest sidecar for saved run directories
```

### v1.4 - Packages In The MOBY Sidecar

The sidecar now includes `packages[]` populated with MOBY `InventoryPackage` entities from normalized rows.

### v1.4.1 - Hardened Money Parsing

MOBY package costs now support common POS/accounting money strings. Invalid values like `N/A` stay unresolved, are omitted from `package.totalCost`, and remain visible through warnings and validation issues.

### v1.5 - Versioned Sidecar Metadata

The sidecar now includes top-level `schemaVersion`, `generatedBy`, and `generatedAt` fields. `trackingthc.com/import-review` can display this metadata alongside package and warning details.

### v1.6 - MOBY Run Manifest Sidecar

Saved run directories now include `moby-run-manifest.json`, an additive `MobyRunManifest` sidecar that lists run sources, generated artifacts, warning metadata, summary counts, and module metadata without changing existing output files.

---

## Roadmap

Near-term next slices:

```txt
sample sidecar gallery
upload/local sidecar review in trackingthc.com
reconciliation prep
accounting export comparison
finance review workflow
```

Potential future flow:

```txt
moby-import.json
+ accounting export
-> ReconciliationRun
-> ReconciliationIssue[]
-> finance review
```

The path from this CLI to the broader TrackingTHC platform is intentionally incremental: normalize the import, preserve audit context, expose a portable sidecar, then build review and reconciliation workflows on top.

---

## Design Philosophy

### Keep The CLI Practical

Operators need files they can inspect:

```txt
CSV
Markdown
JSON manifest
```

### Keep Contracts Portable

Future apps need stable shapes:

```txt
MappingProfile
ImportRun
ValidationIssue
InventoryPackage
```

### Prefer Adapters Over Rewrites

```txt
local artifact -> adapter -> MOBY contract
```

The working CLI should not be rewritten just to match shared contract names.

### Fail Fast On Bad Setup

Bad mapping configuration stops the import before outputs are written.

### Warn On Bad Row Data

Bad rows remain reviewable when the import can continue safely.

### Preserve Auditability

Every successful run should preserve:

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
a production SaaS
a compliance submission system
a database-backed app
a vendor API connector
a Metrc, Dutchie, or Korona replacement
```

It is a focused import normalization tool that gives messy cannabis operational exports enough structure to support review, reconciliation, and finance-readable reporting.
