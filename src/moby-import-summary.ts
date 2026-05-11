import type {
  ImportRun,
  InventoryPackage,
  MappingProfile,
  ValidationIssue,
} from "moby-core";

export interface MobyImportSummary {
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
}): MobyImportSummary {
  return {
    mappingProfile: args.mappingProfile,
    importRun: args.importRun,
    validationIssues: args.validationIssues,
    ...(args.packages ? { packages: args.packages } : {}),
  };
}
