import { describe, expect, it } from "vitest";
import type { ImportRun, MappingProfile, ValidationIssue } from "moby-core";
import { createMobyImportSummary } from "../src/moby-import-summary.js";

const mappingProfile: MappingProfile = {
  id: "korona-profile",
  name: "Korona Mapping",
  source: "korona",
  createdAt: "2026-05-10T20:00:00.000Z",
  mappings: [
    {
      sourceField: "Item Name",
      canonicalField: "product.name",
      status: "mapped",
    },
  ],
};

const importRun: ImportRun = {
  id: "korona-run-001",
  source: "korona",
  status: "completed_with_warnings",
  filename: "samples/korona-export-example.csv",
  startedAt: "2026-05-10T20:00:00.000Z",
  completedAt: "2026-05-10T20:00:00.000Z",
  summary: {
    rowCount: 2,
    successCount: 2,
    warningCount: 1,
    errorCount: 0,
  },
};

const validationIssues: ValidationIssue[] = [
  {
    code: "MISSING_PACKAGE_ID",
    severity: "warning",
    message: "Package ID is missing.",
    field: "package.id",
    rowNumber: 3,
  },
];

describe("MOBY import summary helper", () => {
  it("returns the provided mappingProfile", () => {
    const summary = createMobyImportSummary({
      mappingProfile,
      importRun,
      validationIssues,
    });

    expect(summary.mappingProfile).toBe(mappingProfile);
  });

  it("returns the provided importRun", () => {
    const summary = createMobyImportSummary({
      mappingProfile,
      importRun,
      validationIssues,
    });

    expect(summary.importRun).toBe(importRun);
  });

  it("returns the provided validationIssues", () => {
    const summary = createMobyImportSummary({
      mappingProfile,
      importRun,
      validationIssues,
    });

    expect(summary.validationIssues).toBe(validationIssues);
  });

  it("does not clone or mutate the inputs", () => {
    const summary = createMobyImportSummary({
      mappingProfile,
      importRun,
      validationIssues,
    });

    expect(summary.mappingProfile).toBe(mappingProfile);
    expect(summary.importRun).toBe(importRun);
    expect(summary.validationIssues).toBe(validationIssues);
    expect(mappingProfile.mappings).toHaveLength(1);
    expect(importRun.summary.warningCount).toBe(1);
    expect(validationIssues).toHaveLength(1);
  });
});
