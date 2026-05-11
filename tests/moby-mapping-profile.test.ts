import { describe, expect, it } from "vitest";
import { toMobyMappingProfile } from "../src/moby-mapping-profile.js";

describe("moby MappingProfile adapter", () => {
  it("converts known Korona normalized fields to moby-core canonical fields", () => {
    const profile = toMobyMappingProfile({
      mapping: {
        source_system: "korona",
        fields: {
          "Item Name": "product_name",
          "Package ID": "package_id",
          "Qty On Hand": "quantity",
          "Total Cost": "total_cost",
          Vendor: "vendor",
        },
      },
      id: "korona-profile",
      name: "Korona Mapping",
      createdAt: "2026-05-10T20:00:00.000Z",
    });

    expect(profile.mappings).toEqual([
      {
        sourceField: "Item Name",
        canonicalField: "product.name",
        status: "mapped",
      },
      {
        sourceField: "Package ID",
        canonicalField: "package.id",
        status: "mapped",
      },
      {
        sourceField: "Qty On Hand",
        canonicalField: "package.quantity",
        status: "mapped",
      },
      {
        sourceField: "Total Cost",
        canonicalField: "package.totalCost",
        status: "mapped",
      },
      {
        sourceField: "Vendor",
        canonicalField: "vendor.name",
        status: "mapped",
      },
    ]);
  });

  it("marks unknown normalized fields as needs_review without throwing", () => {
    const profile = toMobyMappingProfile({
      mapping: {
        source_system: "korona",
        fields: {
          SKU: "sku",
        },
      },
      id: "korona-profile",
      name: "Korona Mapping",
      createdAt: "2026-05-10T20:00:00.000Z",
    });

    expect(profile.mappings).toEqual([
      {
        sourceField: "SKU",
        status: "needs_review",
        note: "No moby-core CanonicalField mapping exists for normalized field: sku",
      },
    ]);
  });

  it("preserves source_system as the MappingProfile source", () => {
    const profile = toMobyMappingProfile({
      mapping: {
        source_system: "korona",
        fields: {},
      },
      id: "korona-profile",
      name: "Korona Mapping",
      createdAt: "2026-05-10T20:00:00.000Z",
    });

    expect(profile.source).toBe("korona");
  });

  it("preserves id, name, and createdAt", () => {
    const profile = toMobyMappingProfile({
      mapping: {
        source_system: "korona",
        fields: {},
      },
      id: "korona-profile",
      name: "Korona Mapping",
      createdAt: "2026-05-10T20:00:00.000Z",
    });

    expect(profile.id).toBe("korona-profile");
    expect(profile.name).toBe("Korona Mapping");
    expect(profile.createdAt).toBe("2026-05-10T20:00:00.000Z");
  });

  it("preserves source CSV headers in generated mappings", () => {
    const profile = toMobyMappingProfile({
      mapping: {
        source_system: "korona",
        fields: {
          "Item Name": "product_name",
          "Package ID": "package_id",
        },
      },
      id: "korona-profile",
      name: "Korona Mapping",
      createdAt: "2026-05-10T20:00:00.000Z",
    });

    expect(profile.mappings.map((mapping) => mapping.sourceField)).toEqual([
      "Item Name",
      "Package ID",
    ]);
  });
});
