import { describe, expect, it } from "vitest";
import {
  createMobyRunManifest,
  type MapperRunManifestInput,
  toMobyRunStatus,
} from "../src/moby-run-manifest.js";

const baseInput: MapperRunManifestInput = {
  runId: "import-run-001",
  ranAt: "2026-05-10T20:00:00.000Z",
  sourceSystem: "korona",
  sourceFile: "samples/korona-export-example.csv",
  mappingFile: "samples/korona-mapping.json",
  outputFile: "output/runs/import-run-001/normalized.csv",
  warningsFile: "output/runs/import-run-001/warnings.csv",
  summaryFile: "output/runs/import-run-001/summary.md",
  legacyManifestFile: "output/runs/import-run-001/run-manifest.json",
  indexFile: "output/runs/index.json",
  mobyRunManifestFile: "output/runs/import-run-001/moby-run-manifest.json",
  rowsProcessed: 4,
  unitCostsCalculated: 3,
  warningCount: 0,
  warnings: [],
};

describe("MOBY run manifest adapter", () => {
  it("maps status with and without warnings", () => {
    expect(toMobyRunStatus(0)).toBe("completed");
    expect(toMobyRunStatus(2)).toBe("completed_with_warnings");
  });

  it("creates artifacts without the optional MOBY import sidecar", () => {
    const manifest = createMobyRunManifest(baseInput);

    expect(manifest.artifacts.map((artifact) => artifact.id)).toEqual([
      "artifact_normalized_csv",
      "artifact_warnings_csv",
      "artifact_summary_md",
      "artifact_run_manifest_json",
      "artifact_run_index_json",
      "artifact_moby_run_manifest_json",
    ]);
    expect(artifactById(manifest, "artifact_normalized_csv")).toMatchObject({
      role: "output",
      path: "normalized.csv",
      format: "csv",
      mediaType: "text/csv",
    });
    expect(artifactById(manifest, "artifact_warnings_csv")).toMatchObject({
      role: "warnings",
      path: "warnings.csv",
      format: "csv",
    });
    expect(artifactById(manifest, "artifact_summary_md")).toMatchObject({
      role: "summary",
      path: "summary.md",
      format: "markdown",
    });
    expect(artifactById(manifest, "artifact_run_manifest_json")).toMatchObject({
      role: "manifest",
      path: "run-manifest.json",
      format: "json",
    });
    expect(artifactById(manifest, "artifact_run_index_json")).toMatchObject({
      role: "other",
      path: "../index.json",
      format: "json",
      metadata: {
        kind: "run_index",
      },
    });
    expect(
      artifactById(manifest, "artifact_moby_run_manifest_json"),
    ).toMatchObject({
      role: "manifest",
      path: "moby-run-manifest.json",
      format: "json",
    });
    expect(artifactById(manifest, "artifact_moby_import_json")).toBeUndefined();
  });

  it("includes the optional MOBY import sidecar artifact when provided", () => {
    const manifest = createMobyRunManifest({
      ...baseInput,
      mobyImportFile: "output/runs/import-run-001/moby-import.json",
    });

    expect(artifactById(manifest, "artifact_moby_import_json")).toMatchObject({
      role: "sidecar",
      path: "moby-import.json",
      format: "json",
      mediaType: "application/json",
    });
  });

  it("maps warnings with artifact links, row metadata, field, and review metadata", () => {
    const manifest = createMobyRunManifest({
      ...baseInput,
      warningCount: 1,
      warnings: [
        {
          rowNumber: 5,
          code: "INVALID_TOTAL_COST",
          message: "Total cost is not a valid number.",
          productName: "Bad Cost Example",
          packageId: "1A406030000888",
          quantity: "10",
          totalCost: "N/A",
        },
      ],
    });

    expect(manifest.warnings[0]).toMatchObject({
      code: "INVALID_TOTAL_COST",
      severity: "warning",
      message: "Total cost is not a valid number.",
      artifactId: "artifact_warnings_csv",
      field: "package.totalCost",
      rowNumber: 5,
      metadata: {
        productName: "Bad Cost Example",
        packageId: "1A406030000888",
        quantity: "10",
        totalCost: "N/A",
      },
    });
  });

  it("sets summary artifactCount from the generated artifact list", () => {
    const manifest = createMobyRunManifest({
      ...baseInput,
      mobyImportFile: "output/runs/import-run-001/moby-import.json",
    });

    expect(manifest.summary.artifactCount).toBe(manifest.artifacts.length);
  });
});

function artifactById(
  manifest: ReturnType<typeof createMobyRunManifest>,
  artifactId: string,
) {
  return manifest.artifacts.find((artifact) => artifact.id === artifactId);
}
