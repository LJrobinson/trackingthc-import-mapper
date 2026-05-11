import type { ExternalSystem, ImportRun, ImportStatus } from "moby-core";

export interface MapperRunManifest {
  run_id: string;
  status: string;
  source_system: ExternalSystem;
  source_file: string;
  mapping_file: string;
  output_file: string;
  warnings_file: string;
  rows_processed: number;
  unit_costs_calculated: number;
  warnings: number;
  ran_at: string;
}

export function toMobyImportStatus(
  manifest: MapperRunManifest,
): ImportStatus {
  if (manifest.status === "success") {
    return manifest.warnings > 0 ? "completed_with_warnings" : "completed";
  }

  if (manifest.status === "failed") {
    return "failed";
  }

  return "completed_with_warnings";
}

export function toMobyImportRun(manifest: MapperRunManifest): ImportRun {
  return {
    id: manifest.run_id,
    source: manifest.source_system,
    status: toMobyImportStatus(manifest),
    filename: manifest.source_file,
    startedAt: manifest.ran_at,
    completedAt: manifest.ran_at,
    summary: {
      rowCount: manifest.rows_processed,
      successCount: manifest.rows_processed,
      warningCount: manifest.warnings,
      errorCount: 0,
    },
    metadata: {
      sourceFile: manifest.source_file,
      mappingFile: manifest.mapping_file,
      outputFile: manifest.output_file,
      warningsFile: manifest.warnings_file,
      unitCostsCalculated: manifest.unit_costs_calculated,
      originalStatus: manifest.status,
    },
  };
}
