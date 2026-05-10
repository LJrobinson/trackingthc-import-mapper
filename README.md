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

## Future Paid Features

- save import templates
- save calculation runs
- compare reporting periods
- export finance-ready reports
- team access
- audit history
- POS-specific adapters
- compliance-system reconciliation# trackingthc-import-mapper
