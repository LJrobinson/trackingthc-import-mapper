import type { ExternalSystem, FieldMapping, MappingProfile } from "moby-core";
import { toCanonicalField } from "./normalized-to-canonical-field.js";

export interface MappingFile {
  source_system: ExternalSystem;
  fields: Record<string, string>;
}

export function toMobyMappingProfile(args: {
  mapping: MappingFile;
  id: string;
  name: string;
  createdAt: string;
}): MappingProfile {
  return {
    id: args.id,
    name: args.name,
    source: args.mapping.source_system,
    createdAt: args.createdAt,
    mappings: Object.entries(args.mapping.fields).map(
      ([sourceField, normalizedField]): FieldMapping => {
        const canonicalField = toCanonicalField(normalizedField);

        if (!canonicalField) {
          return {
            sourceField,
            status: "needs_review",
            note: `No moby-core CanonicalField mapping exists for normalized field: ${normalizedField}`,
          };
        }

        return {
          sourceField,
          canonicalField,
          status: "mapped",
        };
      },
    ),
  };
}
