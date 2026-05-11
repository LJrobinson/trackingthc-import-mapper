import type { CanonicalField } from "moby-core";

export const NORMALIZED_TO_CANONICAL_FIELD = {
  product_name: "product.name",
  category: "product.category",
  vendor: "vendor.name",
  package_id: "package.id",
  received_date: "package.receivedAt",
  quantity: "package.quantity",
  total_cost: "package.totalCost",
  unit_cost: "package.unitCost",
} as const satisfies Record<string, CanonicalField>;

type NormalizedCanonicalField = keyof typeof NORMALIZED_TO_CANONICAL_FIELD;

export function toCanonicalField(
  field: string,
): CanonicalField | undefined {
  if (
    !Object.prototype.hasOwnProperty.call(
      NORMALIZED_TO_CANONICAL_FIELD,
      field,
    )
  ) {
    return undefined;
  }

  return NORMALIZED_TO_CANONICAL_FIELD[field as NormalizedCanonicalField];
}
