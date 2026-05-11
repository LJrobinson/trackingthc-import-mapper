import { describe, expect, it } from "vitest";
import {
  NORMALIZED_TO_CANONICAL_FIELD,
  toCanonicalField,
} from "../src/normalized-to-canonical-field.js";

describe("normalized-to-canonical field translation", () => {
  const expectedMappings = {
    product_name: "product.name",
    category: "product.category",
    vendor: "vendor.name",
    package_id: "package.id",
    received_date: "package.receivedAt",
    quantity: "package.quantity",
    total_cost: "package.totalCost",
    unit_cost: "package.unitCost",
  } as const;

  it("returns the expected CanonicalField for every mapped normalized field", () => {
    for (const [normalizedField, canonicalField] of Object.entries(
      expectedMappings,
    )) {
      expect(toCanonicalField(normalizedField)).toBe(canonicalField);
    }
  });

  it("returns undefined for unknown or intentionally unmapped fields", () => {
    expect(toCanonicalField("unknown_field")).toBeUndefined();
    expect(toCanonicalField("sku")).toBeUndefined();
    expect(toCanonicalField("brand")).toBeUndefined();
    expect(toCanonicalField("quantity_received")).toBeUndefined();
    expect(toCanonicalField("quantity_remaining")).toBeUndefined();
    expect(toCanonicalField("retail_price")).toBeUndefined();
    expect(toCanonicalField("gross_margin_percent")).toBeUndefined();
    expect(toCanonicalField("source_file_name")).toBeUndefined();
    expect(toCanonicalField("imported_at")).toBeUndefined();
  });

  it("exposes only the expected normalized field keys", () => {
    expect(Object.keys(NORMALIZED_TO_CANONICAL_FIELD).sort()).toEqual(
      Object.keys(expectedMappings).sort(),
    );
  });
});
