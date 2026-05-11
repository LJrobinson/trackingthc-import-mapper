import path from "node:path";
import type {
  ExternalSystem,
  MobyArtifact,
  MobyRunManifest,
  MobyRunStatus,
  MobyWarning,
} from "moby-core";
import { inferValidationField } from "./moby-validation-issue.js";

export const MOBY_RUN_MANIFEST_FILE_NAME = "moby-run-manifest.json";

export interface MapperRunWarning {
  rowNumber?: number;
  code: string;
  message: string;
  productName?: string;
  packageId?: string;
  quantity?: string;
  totalCost?: string;
}

export interface MapperRunManifestInput {
  runId: string;
  ranAt: string;
  sourceSystem?: ExternalSystem;
  sourceFile: string;
  mappingFile: string;
  outputFile: string;
  warningsFile: string;
  summaryFile: string;
  legacyManifestFile: string;
  indexFile: string;
  mobyImportFile?: string;
  mobyRunManifestFile: string;
  rowsProcessed: number;
  unitCostsCalculated: number;
  warningCount: number;
  warnings: MapperRunWarning[];
}

export function toMobyRunStatus(warningCount: number): MobyRunStatus {
  return warningCount > 0 ? "completed_with_warnings" : "completed";
}

export function createMobyRunManifest(
  input: MapperRunManifestInput,
): MobyRunManifest {
  const sourceSystem = input.sourceSystem ?? "csv";
  const artifacts = toMobyArtifacts(input);

  return {
    schemaVersion: "1.0",
    runId: input.runId,
    runType: "trackingthc_import",
    generatedBy: "trackingthc-import-mapper",
    generatedAt: input.ranAt,
    status: toMobyRunStatus(input.warningCount),
    startedAt: input.ranAt,
    completedAt: input.ranAt,
    sources: [
      {
        system: sourceSystem,
        name: `${sourceSystem} import source`,
        fileName: path.basename(input.sourceFile),
        filePath: input.sourceFile,
        receivedAt: input.ranAt,
        metadata: {
          mappingFile: input.mappingFile,
        },
      },
    ],
    artifacts,
    warnings: input.warnings.map(toMobyRunWarning),
    summary: {
      processedCount: input.rowsProcessed,
      successCount: input.rowsProcessed,
      warningCount: input.warningCount,
      errorCount: 0,
      artifactCount: artifacts.length,
      metadata: {
        unitCostsCalculated: input.unitCostsCalculated,
      },
    },
    metadata: {
      sourceFile: input.sourceFile,
      mappingFile: input.mappingFile,
      outputFile: input.outputFile,
      warningsFile: input.warningsFile,
      summaryFile: input.summaryFile,
      legacyRunManifestFile: input.legacyManifestFile,
      runIndexFile: input.indexFile,
      ...(input.mobyImportFile ? { mobyImportFile: input.mobyImportFile } : {}),
      mobyRunManifestFile: input.mobyRunManifestFile,
    },
  };
}

export function toMobyRunWarning(warning: MapperRunWarning): MobyWarning {
  const field = inferValidationField(warning.code);
  const metadata = getWarningMetadata(warning);

  return {
    code: warning.code,
    severity: "warning",
    message: warning.message,
    artifactId: "artifact_warnings_csv",
    ...(field ? { field } : {}),
    ...(warning.rowNumber !== undefined ? { rowNumber: warning.rowNumber } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

function toMobyArtifacts(input: MapperRunManifestInput): MobyArtifact[] {
  const baseDir = path.dirname(path.resolve(input.mobyRunManifestFile));
  const artifacts: MobyArtifact[] = [
    artifact(baseDir, {
      id: "artifact_normalized_csv",
      role: "output",
      filePath: input.outputFile,
      format: "csv",
      label: "Normalized output",
      mediaType: "text/csv",
    }),
    artifact(baseDir, {
      id: "artifact_warnings_csv",
      role: "warnings",
      filePath: input.warningsFile,
      format: "csv",
      label: "Import warnings",
      mediaType: "text/csv",
    }),
    artifact(baseDir, {
      id: "artifact_summary_md",
      role: "summary",
      filePath: input.summaryFile,
      format: "markdown",
      label: "Human review summary",
      mediaType: "text/markdown",
    }),
    artifact(baseDir, {
      id: "artifact_run_manifest_json",
      role: "manifest",
      filePath: input.legacyManifestFile,
      format: "json",
      label: "Mapper run manifest",
      mediaType: "application/json",
    }),
    artifact(baseDir, {
      id: "artifact_run_index_json",
      role: "other",
      filePath: input.indexFile,
      format: "json",
      label: "Run index",
      mediaType: "application/json",
      metadata: {
        kind: "run_index",
      },
    }),
  ];

  if (input.mobyImportFile) {
    artifacts.push(
      artifact(baseDir, {
        id: "artifact_moby_import_json",
        role: "sidecar",
        filePath: input.mobyImportFile,
        format: "json",
        label: "MOBY import sidecar",
        mediaType: "application/json",
      }),
    );
  }

  artifacts.push(
    artifact(baseDir, {
      id: "artifact_moby_run_manifest_json",
      role: "manifest",
      filePath: input.mobyRunManifestFile,
      format: "json",
      label: "MOBY run manifest",
      mediaType: "application/json",
    }),
  );

  return artifacts;
}

function artifact(
  baseDir: string,
  args: Omit<MobyArtifact, "path"> & { filePath: string },
): MobyArtifact {
  const { filePath, ...artifactArgs } = args;

  return {
    ...artifactArgs,
    path: toPortableRelativePath(baseDir, filePath),
  };
}

function toPortableRelativePath(baseDir: string, filePath: string): string {
  const relativePath = path.relative(baseDir, path.resolve(filePath));
  const portablePath = relativePath.replace(/\\/g, "/");

  return portablePath || path.basename(filePath);
}

function getWarningMetadata(
  warning: MapperRunWarning,
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
