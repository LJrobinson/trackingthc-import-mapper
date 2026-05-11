import type {
  ImportRun,
  InventoryPackage,
  MappingProfile,
  ValidationIssue,
} from "moby-core";

export interface MobyImportSummary {
  schemaVersion: "1.0";
  generatedBy: "trackingthc-import-mapper";
  generatedAt: string;
  mappingProfile: MappingProfile;
  importRun: ImportRun;
  validationIssues: ValidationIssue[];
  packages?: InventoryPackage[];
}

export function createMobyImportSummary(args: {
  mappingProfile: MappingProfile;
  importRun: ImportRun;
  validationIssues: ValidationIssue[];
  packages?: InventoryPackage[];
  generatedAt?: string;
}): MobyImportSummary {
  return {
    schemaVersion: "1.0",
    generatedBy: "trackingthc-import-mapper",
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    mappingProfile: args.mappingProfile,
    importRun: args.importRun,
    validationIssues: args.validationIssues,
    ...(args.packages ? { packages: args.packages } : {}),
  };
}
