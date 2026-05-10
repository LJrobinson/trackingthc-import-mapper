#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CliArgs = {
  csv: string;
  map: string;
  out?: string;
  warnings?: string;
  manifest?: string;
  runId?: string;
  runDir?: string;
};

type MappingFile = {
  source_system?: string;
  fields: Record<string, string>;
};

type NormalizedRow = {
  values: string[];
  unitCostCalculated: boolean;
  warnings: WarningRow[];
};

type WarningCode =
  | "MISSING_PACKAGE_ID"
  | "MISSING_QUANTITY"
  | "INVALID_QUANTITY"
  | "ZERO_QUANTITY"
  | "MISSING_TOTAL_COST"
  | "INVALID_TOTAL_COST"
  | "UNIT_COST_NOT_CALCULATED";

type WarningRow = {
  rowNumber: number;
  code: WarningCode;
  message: string;
  productName: string;
  packageId: string;
  quantity: string;
  totalCost: string;
};

type RunInfo = {
  runId: string;
  ranAt: string;
};

type OutputPaths = {
  out: string;
  warnings: string;
  manifest: string;
};

type RunCounts = {
  rowsProcessed: number;
  unitCostsCalculated: number;
  warnings: number;
};

type RunIndexEntry = {
  run_id: string;
  status: "success";
  source_system: string;
  rows_processed: number;
  unit_costs_calculated: number;
  warnings: number;
  ran_at: string;
  manifest_file: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const csvText = await readFile(args.csv, "utf8");
  const mapping = await readMapping(args.map);

  const parsed = parseCsv(csvText);
  if (parsed.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const [headers, ...rows] = parsed;
  validateMappingHeaders(headers, mapping);

  const outputHeaders = getOutputHeaders(mapping);
  const normalizedRows = rows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((cell) => cell.trim() !== ""))
    .map(({ row, rowNumber }) =>
      normalizeRow(headers, row, mapping, outputHeaders, rowNumber),
    );
  const unitCostsCalculated = normalizedRows.filter(
    (row) => row.unitCostCalculated,
  ).length;
  const warnings = normalizedRows.flatMap((row) => row.warnings);
  const runInfo = createRunInfo(mapping.source_system, args.runId);
  const outputPaths = resolveOutputPaths(args, runInfo.runId);
  const counts = {
    rowsProcessed: normalizedRows.length,
    unitCostsCalculated,
    warnings: warnings.length,
  };

  await mkdir(path.dirname(path.resolve(outputPaths.out)), { recursive: true });
  await writeFile(
    outputPaths.out,
    toCsv([outputHeaders, ...normalizedRows.map((row) => row.values)]),
    "utf8",
  );

  await mkdir(path.dirname(path.resolve(outputPaths.warnings)), {
    recursive: true,
  });
  await writeFile(outputPaths.warnings, toWarningsCsv(warnings), "utf8");

  await writeRunManifest(
    args,
    outputPaths,
    mapping,
    counts,
    runInfo,
  );
  const runIndexPath = args.runDir
    ? await updateRunIndex(args.runDir, outputPaths, mapping, counts, runInfo)
    : undefined;

  console.log(`Run ID: ${runInfo.runId}`);
  console.log(`Rows processed: ${normalizedRows.length}`);
  console.log(`Output written: ${outputPaths.out}`);
  console.log(`Unit costs calculated: ${unitCostsCalculated}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Warnings written: ${outputPaths.warnings}`);
  console.log(`Manifest written: ${outputPaths.manifest}`);
  if (runIndexPath) {
    console.log(`Run index updated: ${runIndexPath}`);
  }
}

function parseArgs(argv: string[]): CliArgs {
  const values: Partial<CliArgs> = {};

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (!flag || !value) {
      usage();
    }

    if (flag === "--csv") {
      values.csv = value;
    } else if (flag === "--map") {
      values.map = value;
    } else if (flag === "--out") {
      values.out = value;
    } else if (flag === "--warnings") {
      values.warnings = value;
    } else if (flag === "--manifest") {
      values.manifest = value;
    } else if (flag === "--run-id") {
      values.runId = value;
    } else if (flag === "--run-dir") {
      values.runDir = value;
    } else {
      usage();
    }
  }

  const csv = values.csv;
  const map = values.map;

  if (!csv || !map || (!values.out && !values.runDir)) {
    usage();
  }

  return {
    csv,
    map,
    out: values.out,
    warnings: values.warnings,
    manifest: values.manifest,
    runId: values.runId,
    runDir: values.runDir,
  };
}

function usage(): never {
  throw new Error(
    "Usage: trackingthc-import --csv <path> --map <path> (--out <path> | --run-dir <path>) [--warnings <path>] [--manifest <path>] [--run-id <value>]",
  );
}

async function readMapping(filePath: string): Promise<MappingFile> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as MappingFile;

  if (!parsed.fields || typeof parsed.fields !== "object") {
    throw new Error("Mapping file must include a fields object.");
  }

  return parsed;
}

function getOutputHeaders(mapping: MappingFile): string[] {
  const headers = Object.values(mapping.fields);
  const canCalculateUnitCost =
    headers.includes("quantity") && headers.includes("total_cost");

  if (canCalculateUnitCost && !headers.includes("unit_cost")) {
    headers.push("unit_cost");
  }

  return headers;
}

function validateMappingHeaders(headers: string[], mapping: MappingFile): void {
  const missingHeaders = Object.keys(mapping.fields).filter(
    (sourceHeader) => !headers.includes(sourceHeader),
  );

  if (missingHeaders.length === 0) {
    return;
  }

  throw new Error(formatMappingValidationError(missingHeaders, headers));
}

function formatMappingValidationError(
  missingHeaders: string[],
  headers: string[],
): string {
  return [
    "Mapping validation failed.",
    "",
    "Missing source headers:",
    ...missingHeaders.map((header) => `- ${header}`),
    "",
    "Available CSV headers:",
    ...headers.map((header) => `- ${header}`),
    "",
    "No output written.",
  ].join("\n");
}

function normalizeRow(
  headers: string[],
  row: string[],
  mapping: MappingFile,
  outputHeaders: string[],
  rowNumber: number,
): NormalizedRow {
  const sourceRow = Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ""]),
  );
  const normalized: Record<string, string> = {};
  let unitCostCalculated = false;

  for (const [sourceField, targetField] of Object.entries(mapping.fields)) {
    normalized[targetField] = sourceRow[sourceField] ?? "";
  }

  if (!normalized.unit_cost) {
    const quantity = parseNumericValue(normalized.quantity);
    const totalCost = parseNumericValue(normalized.total_cost);

    if (quantity !== undefined && totalCost !== undefined && quantity !== 0) {
      normalized.unit_cost = (totalCost / quantity).toFixed(2);
      unitCostCalculated = true;
    }
  }

  return {
    values: outputHeaders.map((header) => normalized[header] ?? ""),
    unitCostCalculated,
    warnings: getWarnings(rowNumber, normalized, unitCostCalculated),
  };
}

function parseNumericValue(value: string | undefined): number | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const unquoted =
    trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  const isAccountingNegative =
    unquoted.startsWith("(") && unquoted.endsWith(")");
  const numberText = isAccountingNegative
    ? unquoted.slice(1, -1).trim()
    : unquoted;
  const cleaned = numberText.replace(/[$,]/g, "").trim();

  if (!cleaned || cleaned === "-") {
    return undefined;
  }

  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) {
    return undefined;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return isAccountingNegative ? -Math.abs(parsed) : parsed;
}

function getWarnings(
  rowNumber: number,
  normalized: Record<string, string>,
  unitCostCalculated: boolean,
): WarningRow[] {
  const warnings: WarningRow[] = [];
  const packageId = normalized.package_id ?? "";
  const quantity = normalized.quantity ?? "";
  const totalCost = normalized.total_cost ?? "";
  const quantityStatus = getNumberStatus(quantity);
  const totalCostStatus = getNumberStatus(totalCost);

  if (isBlank(packageId)) {
    warnings.push(
      warning(
        rowNumber,
        "MISSING_PACKAGE_ID",
        "Package ID is missing.",
        normalized,
      ),
    );
  }

  if (quantityStatus === "missing") {
    warnings.push(
      warning(
        rowNumber,
        "MISSING_QUANTITY",
        "Quantity is missing.",
        normalized,
      ),
    );
  } else if (quantityStatus === "invalid") {
    warnings.push(
      warning(
        rowNumber,
        "INVALID_QUANTITY",
        "Quantity is not a valid number.",
        normalized,
      ),
    );
  } else if (quantityStatus.value === 0) {
    warnings.push(
      warning(rowNumber, "ZERO_QUANTITY", "Quantity is zero.", normalized),
    );
  }

  if (totalCostStatus === "missing") {
    warnings.push(
      warning(
        rowNumber,
        "MISSING_TOTAL_COST",
        "Total cost is missing.",
        normalized,
      ),
    );
  } else if (totalCostStatus === "invalid") {
    warnings.push(
      warning(
        rowNumber,
        "INVALID_TOTAL_COST",
        "Total cost is not a valid number.",
        normalized,
      ),
    );
  }

  if (!unitCostCalculated) {
    const unitCostBlocked =
      quantityStatus === "missing" ||
      quantityStatus === "invalid" ||
      totalCostStatus === "missing" ||
      totalCostStatus === "invalid" ||
      (typeof quantityStatus === "object" && quantityStatus.value === 0);

    if (unitCostBlocked) {
      warnings.push(
        warning(
          rowNumber,
          "UNIT_COST_NOT_CALCULATED",
          "Unit cost could not be calculated.",
          normalized,
        ),
      );
    }
  }

  return warnings;
}

function warning(
  rowNumber: number,
  code: WarningCode,
  message: string,
  normalized: Record<string, string>,
): WarningRow {
  return {
    rowNumber,
    code,
    message,
    productName: normalized.product_name ?? "",
    packageId: normalized.package_id ?? "",
    quantity: normalized.quantity ?? "",
    totalCost: normalized.total_cost ?? "",
  };
}

function getNumberStatus(
  value: string | undefined,
): "missing" | "invalid" | { value: number } {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "missing";
  }

  const parsed = parseNumericValue(trimmed);
  return parsed === undefined ? "invalid" : { value: parsed };
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === "";
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toCsv(rows: string[][]): string {
  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function toWarningsCsv(warnings: WarningRow[]): string {
  const rows = warnings.map((item) => [
    String(item.rowNumber),
    item.code,
    item.message,
    item.productName,
    item.packageId,
    item.quantity,
    item.totalCost,
  ]);

  return toCsv([
    [
      "row_number",
      "warning_code",
      "message",
      "product_name",
      "package_id",
      "quantity",
      "total_cost",
    ],
    ...rows,
  ]);
}

function createRunInfo(
  sourceSystem: string | undefined,
  providedRunId: string | undefined,
): RunInfo {
  const ranAtDate = new Date();
  const sourceSystemLabel = sourceSystem?.trim() || "unknown";

  return {
    runId:
      providedRunId ?? `${formatRunTimestamp(ranAtDate)}-${sourceSystemLabel}`,
    ranAt: ranAtDate.toISOString(),
  };
}

function formatRunTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = padDatePart(date.getUTCMonth() + 1);
  const day = padDatePart(date.getUTCDate());
  const hour = padDatePart(date.getUTCHours());
  const minute = padDatePart(date.getUTCMinutes());
  const second = padDatePart(date.getUTCSeconds());

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function resolveOutputPaths(args: CliArgs, runId: string): OutputPaths {
  if (args.runDir) {
    const runPath = path.join(args.runDir, runId);

    return {
      out: path.join(runPath, "normalized.csv"),
      warnings: path.join(runPath, "warnings.csv"),
      manifest: path.join(runPath, "run-manifest.json"),
    };
  }

  if (!args.out) {
    usage();
  }

  return {
    out: args.out,
    warnings: args.warnings ?? "output/warnings.csv",
    manifest: args.manifest ?? "output/run-manifest.json",
  };
}

async function writeRunManifest(
  args: CliArgs,
  outputPaths: OutputPaths,
  mapping: MappingFile,
  counts: RunCounts,
  runInfo: RunInfo,
): Promise<void> {
  const manifest = {
    run_id: runInfo.runId,
    status: "success",
    source_system: mapping.source_system ?? "",
    source_file: args.csv,
    mapping_file: args.map,
    output_file: outputPaths.out,
    warnings_file: outputPaths.warnings,
    rows_processed: counts.rowsProcessed,
    unit_costs_calculated: counts.unitCostsCalculated,
    warnings: counts.warnings,
    ran_at: runInfo.ranAt,
  };

  await mkdir(path.dirname(path.resolve(outputPaths.manifest)), {
    recursive: true,
  });
  await writeFile(
    outputPaths.manifest,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function updateRunIndex(
  runDir: string,
  outputPaths: OutputPaths,
  mapping: MappingFile,
  counts: RunCounts,
  runInfo: RunInfo,
): Promise<string> {
  const indexPath = path.join(runDir, "index.json");
  const existingEntries = await readRunIndex(indexPath);
  const entry: RunIndexEntry = {
    run_id: runInfo.runId,
    status: "success",
    source_system: mapping.source_system ?? "",
    rows_processed: counts.rowsProcessed,
    unit_costs_calculated: counts.unitCostsCalculated,
    warnings: counts.warnings,
    ran_at: runInfo.ranAt,
    manifest_file: outputPaths.manifest,
  };

  await writeFile(
    indexPath,
    `${JSON.stringify([...existingEntries, entry], null, 2)}\n`,
    "utf8",
  );

  return indexPath;
}

async function readRunIndex(indexPath: string): Promise<RunIndexEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("Run index must be a JSON array.");
    }

    return parsed as RunIndexEntry[];
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function escapeCsvCell(cell: string): string {
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }

  return cell;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
