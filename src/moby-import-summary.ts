import type { ImportRun, MappingProfile, ValidationIssue } from "moby-core";

export interface MobyImportSummary {
  mappingProfile: MappingProfile;
  importRun: ImportRun;
  validationIssues: ValidationIssue[];
}

export function createMobyImportSummary(args: {
  mappingProfile: MappingProfile;
  importRun: ImportRun;
  validationIssues: ValidationIssue[];
}): MobyImportSummary {
  return {
    mappingProfile: args.mappingProfile,
    importRun: args.importRun,
    validationIssues: args.validationIssues,
  };
}
