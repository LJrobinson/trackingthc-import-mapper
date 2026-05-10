# TrackingTHC Import Mapper

TrackingTHC Import Mapper is a prototype module for converting messy cannabis POS, compliance, invoice, or finance exports into normalized operational-finance data.

The first goal is simple:

Upload or provide a CSV, map the source columns to standard fields, calculate package/unit cost, and export a finance-readable report.

## Problem

Cannabis operators often rely on multiple disconnected systems, including POS, compliance platforms, accounting tools, spreadsheets, and vendor invoices.

Each system exports data differently.

This makes it difficult to consistently calculate:

- package cost
- unit cost
- COGS
- margin
- inventory value
- reconciliation differences
- monthly finance reports

## First Use Case

Given a POS export CSV, the system should allow a user to map source columns into normalized TrackingTHC fields.

Example:

- Product Name
- SKU
- Package ID
- Quantity
- Unit Retail Price
- Total Cost
- Vendor
- Category
- Date

After mapping, the system should calculate useful outputs such as:

- unit cost
- total inventory value
- gross margin estimate
- package-level cost summary

## First Prototype Goal

The first prototype does not need authentication, payments, dashboards, or integrations.

It only needs to prove:

1. A CSV can be loaded.
2. The user can map columns.
3. The mapped data can be normalized.
4. Calculations can run.
5. A report can be exported.

## CLI Prototype

Run the TypeScript CLI with a CSV file, mapping JSON file, and output path:

```bash
npm run cli -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv
```

To write validation warnings to a custom path, add `--warnings`:

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv --warnings output/warnings.csv
```

If `--warnings` is omitted, warnings are written to `output/warnings.csv`.

To write a run manifest to a custom path, add `--manifest`:

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv --warnings output/warnings.csv --manifest output/run-manifest.json
```

If `--manifest` is omitted, the manifest is written to `output/run-manifest.json` after a successful import.

To set a specific run ID in the manifest, add `--run-id`:

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv --warnings output/warnings.csv --manifest output/run-manifest.json --run-id manual-korona-run-001
```

To write each successful import into a run-specific directory, add `--run-dir`:

```bash
npm run import -- --csv samples/korona-export-example.csv --map samples/korona-mapping.json --run-dir output/runs
```

With `--run-dir`, outputs are written under `<run-dir>/<run_id>/` as `normalized.csv`, `warnings.csv`, and `run-manifest.json`. It takes precedence over explicit `--out`, `--warnings`, and `--manifest` paths.

When `--run-dir` is used, the CLI also appends a summary entry to `<run-dir>/index.json` for file-based run history.

Example mapping:

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

### Mapping Validation

The CLI validates that every source header in `mapping.fields` exists in the input CSV before writing output. If a mapped source header is missing, the import stops, prints the missing and available headers, and does not write the normalized or warnings CSV files.

The sample `samples/korona-mapping-bad-header.json` intentionally maps `Item Nam` instead of `Item Name` to show this failure case.

When `quantity` and `total_cost` are present, the CLI adds `unit_cost` to the normalized CSV. Common currency and accounting number formats are supported, including `$400.00`, `1,250.00`, and `($42.00)`.

## Future Paid Features

- save import templates
- save calculation runs
- compare reporting periods
- export finance-ready reports
- team access
- audit history
- POS-specific adapters
- compliance-system reconciliation# trackingthc-import-mapper
