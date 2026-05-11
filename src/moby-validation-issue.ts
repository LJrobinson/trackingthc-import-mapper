import type { ValidationIssue } from "moby-core";

export interface MapperWarningRow {
  rowNumber: number;
  code: string;
  message: string;
  productName?: string;
  packageId?: string;
  quantity?: string;
  totalCost?: string;
}

export function inferValidationField(code: string): string | undefined {
  if (code === "INVALID_QUANTITY") {
    return "package.quantity";
  }

  if (code === "INVALID_TOTAL_COST") {
    return "package.totalCost";
  }

  if (code === "UNIT_COST_NOT_CALCULATED") {
    return "package.unitCost";
  }

  if (code === "MISSING_PACKAGE_ID") {
    return "package.id";
  }

  if (code === "MISSING_PRODUCT_NAME") {
    return "product.name";
  }

  return undefined;
}

export function toMobyValidationIssue(
  warning: MapperWarningRow,
): ValidationIssue {
  const field = inferValidationField(warning.code);
  const metadata = getReviewMetadata(warning);

  return {
    code: warning.code,
    severity: "warning",
    message: warning.message,
    rowNumber: warning.rowNumber,
    ...(field ? { field } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

function getReviewMetadata(
  warning: MapperWarningRow,
): Record<string, string> {
  const metadata: Record<string, string> = {};

  if (warning.productName !== undefined) {
    metadata.productName = warning.productName;
  }

  if (warning.packageId !== undefined) {
    metadata.packageId = warning.packageId;
  }

  if (warning.quantity !== undefined) {
    metadata.quantity = warning.quantity;
  }

  if (warning.totalCost !== undefined) {
    metadata.totalCost = warning.totalCost;
  }

  return metadata;
}
