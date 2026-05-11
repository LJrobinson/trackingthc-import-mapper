import { describe, expect, it } from "vitest";
import {
  inferValidationField,
  toMobyValidationIssue,
} from "../src/moby-validation-issue.js";

describe("moby ValidationIssue adapter", () => {
  it("maps a basic warning to a ValidationIssue with warning severity", () => {
    expect(
      toMobyValidationIssue({
        rowNumber: 4,
        code: "INVALID_TOTAL_COST",
        message: "Total cost is not a valid number.",
      }),
    ).toMatchObject({
      code: "INVALID_TOTAL_COST",
      severity: "warning",
      message: "Total cost is not a valid number.",
      rowNumber: 4,
      field: "package.totalCost",
    });
  });

  it("includes review metadata when present", () => {
    const issue = toMobyValidationIssue({
      rowNumber: 2,
      code: "INVALID_QUANTITY",
      message: "Quantity is not a valid number.",
      productName: "Blue Dream 3.5g",
      packageId: "1A406030000123",
      quantity: "N/A",
      totalCost: "400.00",
    });

    expect(issue.metadata).toEqual({
      productName: "Blue Dream 3.5g",
      packageId: "1A406030000123",
      quantity: "N/A",
      totalCost: "400.00",
    });
  });

  it("omits undefined review fields from metadata", () => {
    const issue = toMobyValidationIssue({
      rowNumber: 3,
      code: "MISSING_PACKAGE_ID",
      message: "Package ID is missing.",
      productName: "Gelato Pre-Roll",
      packageId: undefined,
      quantity: "50",
    });

    expect(issue.metadata).toEqual({
      productName: "Gelato Pre-Roll",
      quantity: "50",
    });
    expect(issue.metadata).not.toHaveProperty("packageId");
    expect(issue.metadata).not.toHaveProperty("totalCost");
  });

  it("infers expected moby-core field strings for known warning codes", () => {
    expect(inferValidationField("INVALID_QUANTITY")).toBe(
      "package.quantity",
    );
    expect(inferValidationField("INVALID_TOTAL_COST")).toBe(
      "package.totalCost",
    );
    expect(inferValidationField("UNIT_COST_NOT_CALCULATED")).toBe(
      "package.unitCost",
    );
    expect(inferValidationField("MISSING_PACKAGE_ID")).toBe("package.id");
    expect(inferValidationField("MISSING_PRODUCT_NAME")).toBe("product.name");
  });

  it("omits field for unknown warning codes", () => {
    const issue = toMobyValidationIssue({
      rowNumber: 6,
      code: "UNKNOWN_WARNING",
      message: "Something needs review.",
    });

    expect(issue.field).toBeUndefined();
  });

  it("does not throw on unknown warning codes", () => {
    expect(() =>
      toMobyValidationIssue({
        rowNumber: 7,
        code: "UNKNOWN_WARNING",
        message: "Something needs review.",
      }),
    ).not.toThrow();
  });
});
