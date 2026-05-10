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

