# TrackingTHC Import Mapper Demo Script

## Purpose

TrackingTHC Import Mapper is a prototype for converting messy cannabis POS, compliance, invoice, or finance exports into normalized operational-finance data.

The current prototype proves this workflow:

```text
CSV export
+ mapping JSON
= normalized finance-ready output
+ validation warnings
+ run manifest
+ file-based import history
```

This is the first wedge toward a cannabis operational finance and reconciliation layer.

---

## Product Promise

TrackingTHC Import Mapper turns messy cannabis exports into normalized outputs, flags untrusted rows, and keeps a file-based audit history of each successful import.

In plain English:

> Upload cursed export. Map columns. Calculate cost. Flag problems. Save the run.

---

## Current Milestone Summary

```text
v0.1 Manual mapping CLI ✅
v0.2 Validation warnings ✅
v0.3 Number parsing hardening ✅
v0.4 Mapping validation ✅
v0.5 Run manifest / audit seed ✅
v0.6 Run ID and status ✅
v0.7 Run directory / saved run folders ✅
v0.8 Run index / file-based import history ✅
```

---

## Demo Prerequisites

From the project root:

```powershell
G:\trackingthc-import-mapper
```

Install dependencies if needed:

```powershell
npm install
```

Main command shape:

```powershell
npm run import -- --csv <csv path> --map <mapping path> --out <output path> --warnings <warnings path> --manifest <manifest path>
```

Run-directory command shape:

```powershell
npm run import -- --csv <csv path> --map <mapping path> --run-dir output/runs --run-id <run id>
```

---

# Demo 1: Clean Import

## Goal

Show that a clean POS-style CSV can be normalized and used to calculate `unit_cost`.

## Command

```powershell
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv --warnings output/warnings.csv --manifest output/run-manifest.json
```

## Expected Terminal Output

```text
Run ID: <generated-run-id>
Rows processed: 2
Output written: output/normalized.csv
Unit costs calculated: 2
Warnings: 0
Warnings written: output/warnings.csv
Manifest written: output/run-manifest.json
```

## Validate Normalized Output

```powershell
Get-Content output/normalized.csv
```

Expected output:

```csv
product_name,package_id,quantity,total_cost,vendor,unit_cost
Blue Dream 3.5g,1A406030000123,20,400.00,Some Vendor,20.00
Gelato Pre-Roll,1A406030000456,50,250.00,Another Vendor,5.00
```

## What This Proves

The mapper can transform source headers into normalized TrackingTHC fields and calculate unit cost from valid source data.

---

# Demo 2: Cursed Import With Warnings

## Goal

Show that messy data does not crash the import. Bad rows are flagged in a separate warnings file.

## Command

```powershell
npm run import -- --csv samples/korona-export-cursed-example.csv --map samples/korona-mapping.json --out output/normalized-cursed.csv --warnings output/warnings-cursed.csv
```

## Expected Terminal Output

```text
Rows processed: 4
Output written: output/normalized-cursed.csv
Unit costs calculated: 1
Warnings: 7
Warnings written: output/warnings-cursed.csv
Manifest written: output/run-manifest.json
```

## Validate Warnings

```powershell
Get-Content output/warnings-cursed.csv
```

Expected warning types include:

```text
MISSING_PACKAGE_ID
ZERO_QUANTITY
INVALID_TOTAL_COST
MISSING_QUANTITY
UNIT_COST_NOT_CALCULATED
```

## What This Proves

Bad row data is recoverable. The import continues, clean values are processed, and questionable rows are isolated for review.

This is the beginning of the trust layer.

---

# Demo 3: Money Format / Accounting Number Parsing

## Goal

Show that common POS and accounting number formats are accepted.

Supported examples:

```text
$400.00
1,250.00
"1,250.00"
" $400.00 "
($42.00)
-42.00
```

## Command

```powershell
npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --out output/normalized-money.csv --warnings output/warnings-money.csv
```

## Expected Terminal Output

```text
Rows processed: 4
Output written: output/normalized-money.csv
Unit costs calculated: 3
Warnings: 2
Warnings written: output/warnings-money.csv
Manifest written: output/run-manifest.json
```

## Validate Warnings

```powershell
Get-Content output/warnings-money.csv
```

Expected output:

```csv
row_number,warning_code,message,product_name,package_id,quantity,total_cost
5,INVALID_TOTAL_COST,Total cost is not a valid number.,Bad Cost Example,1A406030000888,10,N/A
5,UNIT_COST_NOT_CALCULATED,Unit cost could not be calculated.,Bad Cost Example,1A406030000888,10,N/A
```

## What This Proves

The numeric parser handles real-world finance formatting instead of rejecting normal currency/accounting values.

---

# Demo 4: Bad Mapping Fails Fast

## Goal

Show that bad mapping setup stops the import before it can create untrusted output.

The bad mapping file intentionally uses:

```json
"Item Nam": "product_name"
```

instead of:

```json
"Item Name": "product_name"
```

## Command

```powershell
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping-bad-header.json --out output/normalized-bad-map.csv --warnings output/warnings-bad-map.csv --manifest output/manifest-bad-map.json
```

## Expected Terminal Output

```text
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
```

## Confirm No Files Were Written

```powershell
Test-Path output/normalized-bad-map.csv
Test-Path output/warnings-bad-map.csv
Test-Path output/manifest-bad-map.json
```

Expected:

```text
False
False
False
```

## What This Proves

Bad row data creates warnings. Bad mapping setup fails the run.

This prevents garbage output from looking official.

---

# Demo 5: Run Manifest / Audit Seed

## Goal

Show that each successful import can produce a run receipt.

## Command

```powershell
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv --warnings output/warnings.csv --manifest output/run-manifest.json
```

## Inspect Manifest

```powershell
Get-Content output/run-manifest.json
```

Expected shape:

```json
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
```

## What This Proves

The system records what source file, mapping file, output files, counts, and timestamp were involved in a successful import.

This is the first audit-ledger seed.

---

# Demo 6: Custom Run ID

## Goal

Show that a user or automation can assign a specific run ID.

## Command

```powershell
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv --warnings output/warnings.csv --manifest output/run-manifest.json --run-id clean-test-001
```

## Expected Terminal Output

```text
Run ID: clean-test-001
Rows processed: 2
Output written: output/normalized.csv
Unit costs calculated: 2
Warnings: 0
Warnings written: output/warnings.csv
Manifest written: output/run-manifest.json
```

## What This Proves

A successful import is no longer just a file operation. It is a named import event.

---

# Demo 7: Run Directory / Saved Run Folder

## Goal

Show that each import can write to its own run folder.

## Command

```powershell
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id clean-lap-001
```

## Expected Terminal Output

```text
Run ID: clean-lap-001
Rows processed: 2
Output written: output\runs\clean-lap-001\normalized.csv
Unit costs calculated: 2
Warnings: 0
Warnings written: output\runs\clean-lap-001\warnings.csv
Manifest written: output\runs\clean-lap-001\run-manifest.json
Run index updated: output\runs\index.json
```

## Validate Folder Contents

```powershell
Get-ChildItem output/runs/clean-lap-001
```

Expected files:

```text
normalized.csv
warnings.csv
run-manifest.json
```

## What This Proves

Each successful import can be stored as a file-based saved run.

This creates import history without needing a database yet.

---

# Demo 8: Run Index / Clipboard Mode

## Goal

Show that successful run folders are summarized in a master run index.

## Commands

```powershell
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id clipboard-test-001
```

```powershell
npm run import -- --csv samples/korona-export-money-example.csv --map samples/korona-mapping.json --run-dir output/runs --run-id clipboard-test-002
```

## Inspect Index

```powershell
Get-Content output/runs/index.json
```

Expected shape:

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
```

## Bad Mapping Should Not Update Index

```powershell
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping-bad-header.json --run-dir output/runs --run-id clipboard-bad-map
```

Expected behavior:

```text
Mapping validation failed.
No output written.
```

Then confirm `clipboard-bad-map` does not appear in:

```powershell
Get-Content output/runs/index.json
```

## What This Proves

The run index is a lightweight saved-runs system without a database.

The system keeps a high-level import history while each run folder preserves detailed outputs and receipts.

---

# Current Product Story

TrackingTHC Import Mapper started as a simple CSV transformation tool, but already demonstrates the core shape of a cannabis operational finance layer:

1. Accept messy exports.
2. Map source columns to normalized fields.
3. Calculate useful finance values.
4. Warn when data cannot be trusted.
5. Fail fast when the mapping itself is wrong.
6. Save each run with a manifest.
7. Maintain a file-based run index.

This is not a full POS, ERP, or compliance system.

It is the layer that helps explain what those systems exported.

---

# Pitch-Friendly Summary

TrackingTHC Import Mapper is a prototype cannabis data-normalization and audit tool.

It takes inconsistent POS-style CSV exports, maps them into a standard finance-ready structure, calculates package/unit cost, flags bad rows, prevents bad mappings from producing fake confidence, and stores every successful import as a saved run with a manifest and index.

The current version proves the wedge:

> Messy cannabis exports can be normalized, validated, calculated, and logged without requiring a direct POS or compliance API integration.

---

# Next Suggested Milestones

## v0.9 Mapping Auto-Suggest

Suggest normalized fields based on common source headers.

Example:

```text
Item Name -> product_name
Qty On Hand -> quantity
Total Cost -> total_cost
Package ID -> package_id
```

## v1.0 HTML or Markdown Report

Generate a human-readable report per run:

```text
report.md
```

or:

```text
report.html
```

Report sections:

- Run summary
- Source file
- Mapping file
- Row counts
- Warning counts
- Top warning types
- Output paths

## Future Web UI

The eventual web UI can wrap the existing engine:

```text
Upload CSV
Map Columns
Preview Normalized Data
Review Warnings
Export Report
View Saved Runs
```

The CLI is the engine.

The web app is the dashboard and steering wheel.

---

# Demo Closing Line

TrackingTHC Import Mapper is the first small engine inside a larger cannabis reconciliation platform.

It does not try to replace POS, compliance, or accounting systems.

It helps operators make sense of the messy exports those systems already produce.

