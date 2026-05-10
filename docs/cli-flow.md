# CLI Flow

## Goal

The first prototype should prove that a CSV can be transformed into normalized TrackingTHC data using a mapping file.

## Command Shape

trackingthc-import --csv samples/korona-export-example.csv --map samples/korona-mapping.json --out output/normalized.csv

## Steps

1. Read CSV file.
2. Read mapping JSON.
3. Match source CSV headers to normalized field names.
4. Create normalized rows.
5. Calculate unit_cost when total_cost and quantity are present.
6. Write normalized CSV output.

## Not Yet Included

- login
- database
- web upload
- saved user accounts
- payments
- integrations
- automatic mapping
- dashboards