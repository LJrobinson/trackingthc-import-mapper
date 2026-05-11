import type {
  ExternalReference,
  ExternalSystem,
  InventoryPackage,
  Money,
  Quantity,
} from "moby-core";

export interface NormalizedPackageRow {
  product_name?: string;
  package_id?: string;
  quantity?: string;
  total_cost?: string;
  unit_cost?: string;
  vendor?: string;
}

export function toMobyInventoryPackage(args: {
  row: NormalizedPackageRow;
  rowNumber?: number;
  sourceFile?: string;
  sourceSystem?: ExternalSystem;
}): InventoryPackage {
  const packageId = getTrimmedPackageId(args.row);
  const quantity = toQuantity(args.row.quantity);
  const unitCost = toMoney(args.row.unit_cost);
  const totalCost = toMoney(args.row.total_cost);
  const externalReferences = toExternalReferences(args);
  const metadata = toMetadata(args);

  return {
    id: getPackageId(packageId, args.rowNumber),
    ...(packageId ? { label: packageId } : {}),
    ...(quantity ? { quantity } : {}),
    ...(unitCost ? { unitCost } : {}),
    ...(totalCost ? { totalCost } : {}),
    ...(externalReferences ? { externalReferences } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function getTrimmedPackageId(row: NormalizedPackageRow): string | undefined {
  const packageId = row.package_id?.trim();
  return packageId ? packageId : undefined;
}

function getPackageId(
  packageId: string | undefined,
  rowNumber: number | undefined,
): string {
  if (packageId) {
    return `package_${packageId}`;
  }

  if (rowNumber !== undefined) {
    return `package_row_${rowNumber}`;
  }

  return "package_unidentified";
}

function parseFiniteNumber(value: string | undefined): number | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function toQuantity(value: string | undefined): Quantity | undefined {
  const parsed = parseFiniteNumber(value);

  if (parsed === undefined) {
    return undefined;
  }

  return {
    value: parsed,
    unit: "each",
  };
}

function toMoney(value: string | undefined): Money | undefined {
  const parsed = parseFiniteNumber(value);

  if (parsed === undefined) {
    return undefined;
  }

  return {
    amount: parsed,
    currency: "USD",
  };
}

function toExternalReferences(args: {
  row: NormalizedPackageRow;
  rowNumber?: number;
  sourceFile?: string;
  sourceSystem?: ExternalSystem;
}): ExternalReference[] | undefined {
  if (
    !args.sourceSystem ||
    (args.rowNumber === undefined && args.sourceFile === undefined)
  ) {
    return undefined;
  }

  return [
    {
      system: args.sourceSystem,
      externalId: getExternalId(args),
      label: "Normalized row reference",
    },
  ];
}

function getExternalId(args: {
  rowNumber?: number;
  sourceFile?: string;
}): string {
  if (args.sourceFile !== undefined && args.rowNumber !== undefined) {
    return `${args.sourceFile}:${args.rowNumber}`;
  }

  if (args.rowNumber !== undefined) {
    return `row:${args.rowNumber}`;
  }

  return args.sourceFile ?? "";
}

function toMetadata(args: {
  row: NormalizedPackageRow;
  rowNumber?: number;
  sourceFile?: string;
}): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};

  if (args.row.product_name !== undefined) {
    metadata.productName = args.row.product_name;
  }

  if (args.row.vendor !== undefined) {
    metadata.vendorName = args.row.vendor;
  }

  if (args.rowNumber !== undefined) {
    metadata.rowNumber = args.rowNumber;
  }

  if (args.sourceFile !== undefined) {
    metadata.sourceFile = args.sourceFile;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
