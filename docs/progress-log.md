# Progress Log

## v0.1 - Manual Mapping CLI

Status: Working

The CLI can:

- read a source CSV
- read a mapping JSON file
- normalize mapped fields
- calculate unit_cost
- write a normalized CSV
- print a summary

Example command:

npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv

Example output:

Rows processed: 2
Output written: output/normalized.csv
Unit costs calculated: 2

Validated output:

product_name,package_id,quantity,total_cost,vendor,unit_cost
Blue Dream 3.5g,1A406030000123,20,400.00,Some Vendor,20.00
Gelato Pre-Roll,1A406030000456,50,250.00,Another Vendor,5.00

Next target:

v0.2 - Validate required fields and warn about bad rows.

## v0.2 - Validation Warnings / Roll Cage

Status: Working

Added validation warnings for bad or incomplete rows.

The CLI now supports:

--warnings <path>

Clean sample result:

Rows processed: 2
Output written: output/normalized.csv
Unit costs calculated: 2
Warnings: 0
Warnings written: output/warnings.csv

Cursed sample result:

Rows processed: 4
Output written: output/normalized-cursed.csv
Unit costs calculated: 1
Warnings: 7
Warnings written: output/warnings-cursed.csv

Validated behavior:

- clean files produce normalized output with no warnings
- cursed files still produce output
- invalid rows are flagged instead of crashing the import
- unit_cost is only calculated when quantity and total_cost are valid
- warnings are exported to a separate CSV for review

Product insight:

TrackingTHC Import Mapper is not just calculating values. It is creating a trust layer between messy cannabis operational exports and finance-readable reporting.

Next target:

v0.3 - Currency and number parsing hardening.

## v0.3 - Number Parsing / Fuel System

Status: Working

Added hardened numeric parsing for common POS/accounting formats.

Supported formats now include:

- 400.00
- $400.00
- 1,250.00
- "1,250.00"
- " $400.00 "
- ($42.00)
- -42.00

Rejected formats still include:

- N/A
- abc
- empty string
- whitespace-only values

Validated sample:

npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --out output/normalized-money.csv --warnings output/warnings-money.csv

Result:

Rows processed: 4
Output written: output/normalized-money.csv
Unit costs calculated: 3
Warnings: 2
Warnings written: output/warnings-money.csv

Warnings validated:

row_number,warning_code,message,product_name,package_id,quantity,total_cost
5,INVALID_TOTAL_COST,Total cost is not a valid number.,Bad Cost Example,1A406030000888,10,N/A
5,UNIT_COST_NOT_CALCULATED,Unit cost could not be calculated.,Bad Cost Example,1A406030000888,10,N/A

Next target:

v0.4 - Mapping validation and missing header detection.

## v0.4 - Mapping Validation / Pre-Flight Checklist

Status: Working

Added mapping validation before normalization or file writes.

The CLI now checks that every source header in mapping.fields exists in the source CSV headers.

If a mapped source header is missing, the import fails before writing output.

Validated bad mapping command:

npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping-bad-header.json --out output/normalized-bad-map.csv --warnings output/warnings-bad-map.csv

Result:

Mapping validation failed.

Missing source headers:
- Item Nam

Available CSV headers:
- Item Name
- Package ID
- Qty On Hand
- Total Cost
- Vendor

No output written.

File write validation:

Test-Path output/normalized-bad-map.csv
False

Test-Path output/warnings-bad-map.csv
False

Product insight:

Bad row data should generate warnings. Bad mapping setup should fail fast because the entire import run cannot be trusted.

## v0.5 - Run Manifest / Audit Ledger Seed

Status: Working

Added an optional run manifest JSON output.

The CLI now supports:

--manifest <path>

If --manifest is not provided, it defaults to:

output/run-manifest.json

Validated clean command:

npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv --warnings output/warnings.csv --manifest output/run-manifest.json

Result:

Rows processed: 2
Output written: output/normalized.csv
Unit costs calculated: 2
Warnings: 0
Warnings written: output/warnings.csv
Manifest written: output/run-manifest.json

Validated manifest:

{
  "source_system": "korona",
  "source_file": "samples/korona-export-example.csv",
  "mapping_file": "samples/korona-mapping.json",
  "output_file": "output/normalized.csv",
  "warnings_file": "output/warnings.csv",
  "rows_processed": 2,
  "unit_costs_calculated": 2,
  "warnings": 0,
  "ran_at": "2026-05-10T00:45:49.609Z"
}

Validated bad mapping behavior:

When mapping validation fails, no normalized output, warnings file, or manifest is written.

Product insight:

The run manifest is the first audit-ledger seed. It records what source file, mapping file, output files, counts, and timestamp were involved in a successful import run.

## v0.6 - Run ID and Status

Status: Working

Added a run_id and status to each successful import manifest.

The CLI now supports:

--run-id <value>

If --run-id is provided, that exact value is used.

If --run-id is omitted, the CLI generates a readable run ID using:

YYYYMMDD-HHMMSS-source_system

Validated auto-generated run ID:

Run ID: 20260510-005001-korona

Validated manifest:

{
  "run_id": "20260510-005001-korona",
  "status": "success",
  "source_system": "korona",
  "source_file": "samples/korona-export-example.csv",
  "mapping_file": "samples/korona-mapping.json",
  "output_file": "output/normalized.csv",
  "warnings_file": "output/warnings.csv",
  "rows_processed": 2,
  "unit_costs_calculated": 2,
  "warnings": 0,
  "ran_at": "2026-05-10T00:50:01.863Z"
}

Validated custom run ID:

--run-id clean-test-001

Result:

Run ID: clean-test-001

Validated bad mapping behavior:

Mapping validation failures still produce no manifest.

Product insight:

A run_id turns each import from a loose file operation into a named import event. This is the foundation for saved runs, import history, audit trails, and reconciliation workflows.

## v0.7 - Run Directory / File-Based Import History

Status: Working

Added optional --run-dir support.

When --run-dir is provided, the CLI creates a run-specific folder using the run_id:

output/runs/<run_id>/

The run folder contains:

- normalized.csv
- warnings.csv
- run-manifest.json

Validated auto-generated run folder:

npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --run-dir output/runs

Result:

Run ID: 20260510-005355-korona
Rows processed: 2
Output written: output\runs\20260510-005355-korona\normalized.csv
Unit costs calculated: 2
Warnings: 0
Warnings written: output\runs\20260510-005355-korona\warnings.csv
Manifest written: output\runs\20260510-005355-korona\run-manifest.json

Validated run folder contents:

- normalized.csv
- warnings.csv
- run-manifest.json

Validated custom run ID:

--run-id clean-lap-001

Created:

output/runs/clean-lap-001/

Validated bad mapping behavior:

Bad mapping does not create:

output/runs/bad-map-lap/

Product insight:

--run-dir turns individual imports into file-based saved runs. Each successful import now has its own folder, output, warnings, manifest, run ID, and timestamp. This is the first practical version of import history without a database.

## v0.8 - Run Index / Clipboard Mode

Status: Working

Added a run index for file-based import history.

When --run-dir is provided, the CLI now updates:

<run-dir>/index.json

Each successful run appends a summary entry:

- run_id
- status
- source_system
- rows_processed
- unit_costs_calculated
- warnings
- ran_at
- manifest_file

Validated first indexed run:

Run ID: clipboard-test-001
Rows processed: 2
Unit costs calculated: 2
Warnings: 0
Run index updated: output\runs\index.json

Validated second indexed run:

Run ID: clipboard-test-002
Rows processed: 4
Unit costs calculated: 3
Warnings: 2
Run index updated: output\runs\index.json

Validated index output:

[
  {
    "run_id": "clipboard-test-001",
    "status": "success",
    "source_system": "korona",
    "rows_processed": 2,
    "unit_costs_calculated": 2,
    "warnings": 0,
    "ran_at": "2026-05-10T01:01:06.162Z",
    "manifest_file": "output\\runs\\clipboard-test-001\\run-manifest.json"
  },
  {
    "run_id": "clipboard-test-002",
    "status": "success",
    "source_system": "korona",
    "rows_processed": 4,
    "unit_costs_calculated": 3,
    "warnings": 2,
    "ran_at": "2026-05-10T01:01:30.889Z",
    "manifest_file": "output\\runs\\clipboard-test-002\\run-manifest.json"
  }
]

Validated bad mapping behavior:

A failed mapping validation does not create a run folder or update index.json.

Product insight:

index.json creates a lightweight saved-runs system without a database. This is the first practical import history layer for TrackingTHC.

## v0.9 - Markdown Summary Report

Status: Working

Added a human-readable Markdown summary report for each successful import.

The CLI now writes:

- normalized CSV
- warnings CSV
- summary.md
- run-manifest.json
- run index entry when --run-dir is used

Validated command:

npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id summary-test-001

Result:

Run ID: summary-test-001
Rows processed: 4
Output written: output\runs\summary-test-001\normalized.csv
Unit costs calculated: 3
Warnings: 2
Warnings written: output\runs\summary-test-001\warnings.csv
Summary written: output\runs\summary-test-001\summary.md
Manifest written: output\runs\summary-test-001\run-manifest.json
Run index updated: output\runs\index.json

Validated summary:

- includes run ID
- includes status
- includes source system
- includes rows processed
- includes unit costs calculated
- includes warning count
- includes output file paths
- includes warning summary table
- includes finance review notes

Finance review note for warned imports:

This import completed successfully, but 2 warning(s) require review before the output should be treated as fully trusted.

Product insight:

summary.md is the first finance-readable stakeholder artifact. It explains the import outcome and trust boundary without requiring the user to inspect raw CSV or JSON files.

## v1.0 - Core Lock Tests

Status: Working

Added Vitest test coverage for the core CLI workflows.

Validated test command:

npm test

Result:

Test Files  1 passed (1)
Tests       3 passed (3)

Covered workflows:

- clean import writes run-dir outputs
- money-format import calculates valid unit costs and reports warning totals
- bad mapping fails fast without creating run outputs

Product insight:

The core import mapper behavior is now protected by automated tests. Future changes can be checked against the current working prototype behavior.





## v1.1 - MOBY Bridge Layer

Status: Working

Added a MOBY bridge layer that lets the file-based import mapper express its artifacts using moby-core contracts without changing existing CLI behavior.

Bridge coverage:

- normalized field -> CanonicalField
- MappingFile -> MappingProfile
- RunManifest -> ImportRun
- WarningRow -> ValidationIssue
- MOBY import pieces -> MobyImportSummary

Validated commands:

npm run build
npm test

Validated result:

Test Files  6 passed (6)
Tests       27 passed (27)

Product insight:

The import mapper now preserves its practical file-based workflow while exposing a portable MOBY-compatible contract layer. This creates the first real cross-repo integration between trackingthc-import-mapper and moby-core without rewriting the working CLI.

## v1.2 - Optional MOBY JSON Sidecar Export

Status: Working

Added an optional MOBY JSON sidecar export.

The CLI now supports:

--moby-json <path>

When omitted, existing CLI behavior is unchanged and no MOBY JSON file is written.

When provided after a successful import, the CLI writes a portable MOBY-compatible JSON artifact containing:

- mappingProfile
- importRun
- validationIssues

The MOBY JSON sidecar is built from the bridge layer:

- toMobyMappingProfile(...)
- toMobyImportRun(...)
- toMobyValidationIssue(...)
- createMobyImportSummary(...)

Validated command:

npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id moby-sidecar-test-001 --moby-json output/runs/moby-sidecar-test-001/moby-import.json

Expected output includes:

MOBY JSON written: output/runs/moby-sidecar-test-001/moby-import.json

Validated result:

Test Files  6 passed (6)
Tests       28 passed (28)

Product insight:

The import mapper now remains a practical file-based CLI while also emitting a portable MOBY contract artifact. This allows future TrackingTHC apps to ingest import results without needing to understand the CLI’s internal file formats.

## v1.3 - Normalized Rows to InventoryPackage Bridge

Status: Working

Added a MOBY bridge adapter that converts normalized import rows into moby-core InventoryPackage objects.

The adapter supports:

- package_id -> id and label
- quantity -> Quantity with unit each
- total_cost -> USD totalCost
- unit_cost -> USD unitCost
- product_name -> metadata.productName
- vendor -> metadata.vendorName

ID fallback behavior:

- package_id present -> package_<trimmed package_id>
- package_id missing + rowNumber -> package_row_<rowNumber>
- package_id missing + no rowNumber -> package_unidentified

External reference behavior:

- sourceSystem + sourceFile + rowNumber -> sourceFile:rowNumber
- sourceSystem + rowNumber -> row:<rowNumber>
- sourceSystem + sourceFile -> sourceFile
- no sourceSystem -> no externalReferences

Validated commands:

npm run build
npm test

Validated result:

Test Files  7 passed (7)
Tests       42 passed (42)

Product insight:

The import mapper can now translate normalized CSV rows into MOBY domain entities without changing the existing CLI output format. This is the first bridge from file-based import output into reusable inventory objects that future TrackingTHC reconciliation workflows can consume.

## v1.4 - InventoryPackage Entities in MOBY JSON Sidecar

Status: Working

Extended the optional MOBY JSON sidecar export to include InventoryPackage entities converted from normalized import rows.

The MOBY JSON sidecar now contains:

- mappingProfile
- importRun
- validationIssues
- packages

Packages are built from normalized row data using the MOBY bridge adapter:

toMobyInventoryPackage(...)

Each package can include:

- id
- label
- quantity
- unitCost
- totalCost
- metadata with productName, vendorName, rowNumber, and sourceFile
- externalReferences with a normalized row reference

Default CLI behavior remains unchanged when --moby-json is omitted.

Validated commands:

npm run build
npm test

Validated result:

Test Files  7 passed (7)
Tests       45 passed (45)

Product insight:

The import mapper now emits a portable MOBY artifact containing both import metadata and reusable inventory package entities. This makes moby-import.json a practical ingestion payload for future TrackingTHC apps and reconciliation workflows.

## v1.4.1 - Hardened MOBY Money Parsing

Status: Working

Fixed MOBY sidecar package cost parsing so `InventoryPackage.totalCost` is included when `total_cost` contains common POS/accounting money formats.

Supported total_cost formats now include:

- 400.00
- $400.00
- 1,250.00
- " $400.00 "
- ($42.00)
- -42.00

Invalid values are still omitted from `InventoryPackage.totalCost` and surfaced through `validationIssues` instead of being coerced into misleading values.

Validated behavior:

- valid money-formatted `total_cost` values render as `package.totalCost` in `moby-import.json`
- invalid `total_cost` values such as `N/A` omit `totalCost`
- bad cost rows remain unresolved and explain themselves through validation issues
- `unitCost` behavior remains intact
- quantity parsing remains strict
- the `trackingthc.com` import review viewer confirmed the fix by displaying generated package totals correctly

Validated commands:

npm run build
npm test

Product insight:

The MOBY sidecar now preserves real-world cannabis POS/accounting money formats while still refusing invalid values. This keeps the import payload truthful: good cost data becomes structured `InventoryPackage` money, while bad cost data remains visibly unresolved for review.

## v1.5 - Versioned MOBY JSON Sidecar Metadata

Status: Working

Added top-level schema metadata to the optional MOBY JSON sidecar.

The sidecar now includes:

- schemaVersion
- generatedBy
- generatedAt
- mappingProfile
- importRun
- validationIssues
- packages

Current top-level shape:

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

Validated behavior:

- `schemaVersion` identifies the sidecar contract version
- `generatedBy` identifies the generator as `trackingthc-import-mapper`
- `generatedAt` records the import generation timestamp
- packages remain available as `InventoryPackage` entities
- validation issues remain available for row-level review
- `trackingthc.com` displays schema metadata in the import review experience

Product insight:

The MOBY sidecar is now safer for cross-app ingestion. `trackingthc.com` can display which generator and schema produced a sidecar before reviewers inspect mappings, warnings, or package costs.
