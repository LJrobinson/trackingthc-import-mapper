import { describe, expect, it } from "vitest";
import { toMobyInventoryPackage } from "../src/moby-inventory-package.js";

describe("moby InventoryPackage adapter", () => {
  it("converts a complete normalized row to an InventoryPackage", () => {
    const pkg = toMobyInventoryPackage({
      row: {
        product_name: "Blue Dream 3.5g",
        package_id: "1A406030000123",
        quantity: "20",
        total_cost: "400",
        unit_cost: "20",
        vendor: "Some Vendor",
      },
      rowNumber: 2,
      sourceFile: "samples/korona-export-example.csv",
      sourceSystem: "korona",
    });

    expect(pkg).toEqual({
      id: "package_1A406030000123",
      label: "1A406030000123",
      quantity: {
        value: 20,
        unit: "each",
      },
      unitCost: {
        amount: 20,
        currency: "USD",
      },
      totalCost: {
        amount: 400,
        currency: "USD",
      },
      externalReferences: [
        {
          system: "korona",
          externalId: "samples/korona-export-example.csv:2",
          label: "Normalized row reference",
        },
      ],
      metadata: {
        productName: "Blue Dream 3.5g",
        vendorName: "Some Vendor",
        rowNumber: 2,
        sourceFile: "samples/korona-export-example.csv",
      },
    });
  });

  it("maps package_id to id and label after trimming", () => {
    const pkg = toMobyInventoryPackage({
      row: {
        package_id: "  1A406030000123  ",
      },
    });

    expect(pkg.id).toBe("package_1A406030000123");
    expect(pkg.label).toBe("1A406030000123");
  });

  it("uses package_row_<rowNumber> when package_id is missing", () => {
    const pkg = toMobyInventoryPackage({
      row: {},
      rowNumber: 7,
    });

    expect(pkg.id).toBe("package_row_7");
    expect(pkg.label).toBeUndefined();
  });

  it("uses package_unidentified when package_id and rowNumber are missing", () => {
    const pkg = toMobyInventoryPackage({
      row: {},
    });

    expect(pkg.id).toBe("package_unidentified");
    expect(pkg.label).toBeUndefined();
  });

  it("parses quantity, unitCost, and totalCost as finite numbers", () => {
    const pkg = toMobyInventoryPackage({
      row: {
        quantity: " 10.5 ",
        unit_cost: " 2.25 ",
        total_cost: " 23.625 ",
      },
    });

    expect(pkg.quantity).toEqual({
      value: 10.5,
      unit: "each",
    });
    expect(pkg.unitCost).toEqual({
      amount: 2.25,
      currency: "USD",
    });
    expect(pkg.totalCost).toEqual({
      amount: 23.625,
      currency: "USD",
    });
  });

  it("omits invalid numeric fields", () => {
    const pkg = toMobyInventoryPackage({
      row: {
        quantity: "N/A",
        unit_cost: "Infinity",
        total_cost: "not a number",
      },
    });

    expect(pkg.quantity).toBeUndefined();
    expect(pkg.unitCost).toBeUndefined();
    expect(pkg.totalCost).toBeUndefined();
  });

  it("omits empty and whitespace-only numeric fields", () => {
    const pkg = toMobyInventoryPackage({
      row: {
        quantity: "",
        unit_cost: "   ",
        total_cost: "\t",
      },
    });

    expect(pkg.quantity).toBeUndefined();
    expect(pkg.unitCost).toBeUndefined();
    expect(pkg.totalCost).toBeUndefined();
  });

  it("does not throw when package_id is missing", () => {
    expect(() =>
      toMobyInventoryPackage({
        row: {
          quantity: "20",
        },
      }),
    ).not.toThrow();
  });

  it("uses sourceFile:rowNumber for external reference when both are provided", () => {
    const pkg = toMobyInventoryPackage({
      row: {},
      rowNumber: 4,
      sourceFile: "samples/korona-export-example.csv",
      sourceSystem: "korona",
    });

    expect(pkg.externalReferences).toEqual([
      {
        system: "korona",
        externalId: "samples/korona-export-example.csv:4",
        label: "Normalized row reference",
      },
    ]);
  });

  it("uses row:<rowNumber> for external reference when only rowNumber is provided", () => {
    const pkg = toMobyInventoryPackage({
      row: {},
      rowNumber: 4,
      sourceSystem: "korona",
    });

    expect(pkg.externalReferences?.[0]?.externalId).toBe("row:4");
  });

  it("uses sourceFile for external reference when only sourceFile is provided", () => {
    const pkg = toMobyInventoryPackage({
      row: {},
      sourceFile: "samples/korona-export-example.csv",
      sourceSystem: "korona",
    });

    expect(pkg.externalReferences?.[0]?.externalId).toBe(
      "samples/korona-export-example.csv",
    );
  });

  it("does not add externalReferences when sourceSystem is missing", () => {
    const pkg = toMobyInventoryPackage({
      row: {},
      rowNumber: 4,
      sourceFile: "samples/korona-export-example.csv",
    });

    expect(pkg.externalReferences).toBeUndefined();
  });

  it("includes productName, vendorName, rowNumber, and sourceFile metadata when present", () => {
    const pkg = toMobyInventoryPackage({
      row: {
        product_name: "Blue Dream 3.5g",
        vendor: "Some Vendor",
      },
      rowNumber: 2,
      sourceFile: "samples/korona-export-example.csv",
    });

    expect(pkg.metadata).toEqual({
      productName: "Blue Dream 3.5g",
      vendorName: "Some Vendor",
      rowNumber: 2,
      sourceFile: "samples/korona-export-example.csv",
    });
  });

  it("omits undefined metadata values", () => {
    const pkg = toMobyInventoryPackage({
      row: {
        product_name: "Blue Dream 3.5g",
        vendor: undefined,
      },
      sourceFile: undefined,
    });

    expect(pkg.metadata).toEqual({
      productName: "Blue Dream 3.5g",
    });
    expect(pkg.metadata).not.toHaveProperty("vendorName");
    expect(pkg.metadata).not.toHaveProperty("rowNumber");
    expect(pkg.metadata).not.toHaveProperty("sourceFile");
  });
});
