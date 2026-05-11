import { describe, expect, it } from "vitest";
import {
  type MapperRunManifest,
  toMobyImportRun,
  toMobyImportStatus,
} from "../src/moby-import-run.js";

const baseManifest: MapperRunManifest = {
  run_id: "korona-run-001",
  status: "success",
  source_system: "korona",
  source_file: "samples/korona-export-example.csv",
  mapping_file: "samples/korona-mapping.json",
  output_file: "output/runs/korona-run-001/normalized.csv",
  warnings_file: "output/runs/korona-run-001/warnings.csv",
  rows_processed: 2,
  unit_costs_calculated: 2,
  warnings: 0,
  ran_at: "2026-05-10T20:00:00.000Z",
};

describe("moby ImportRun adapter", () => {
  it("maps success with zero warnings to completed", () => {
    expect(toMobyImportStatus({ ...baseManifest, warnings: 0 })).toBe(
      "completed",
    );
  });

  it("maps success with warnings to completed_with_warnings", () => {
    expect(toMobyImportStatus({ ...baseManifest, warnings: 2 })).toBe(
      "completed_with_warnings",
    );
  });

  it("maps failed status to failed", () => {
    expect(toMobyImportStatus({ ...baseManifest, status: "failed" })).toBe(
      "failed",
    );
  });

  it("maps unknown status to completed_with_warnings", () => {
    expect(toMobyImportStatus({ ...baseManifest, status: "partial" })).toBe(
      "completed_with_warnings",
    );
  });

  it("maps manifest fields to ImportRun fields", () => {
    const run = toMobyImportRun(baseManifest);

    expect(run).toMatchObject({
      id: "korona-run-001",
      source: "korona",
      status: "completed",
      filename: "samples/korona-export-example.csv",
      startedAt: "2026-05-10T20:00:00.000Z",
      completedAt: "2026-05-10T20:00:00.000Z",
      summary: {
        rowCount: 2,
        successCount: 2,
        warningCount: 0,
        errorCount: 0,
      },
    });
  });

  it("preserves file paths and original status in metadata", () => {
    const run = toMobyImportRun({
      ...baseManifest,
      status: "success",
      warnings: 1,
      unit_costs_calculated: 1,
    });

    expect(run.metadata).toEqual({
      sourceFile: "samples/korona-export-example.csv",
      mappingFile: "samples/korona-mapping.json",
      outputFile: "output/runs/korona-run-001/normalized.csv",
      warningsFile: "output/runs/korona-run-001/warnings.csv",
      unitCostsCalculated: 1,
      originalStatus: "success",
    });
  });
});
