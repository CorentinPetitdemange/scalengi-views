import { validateConfiguration, type ViewConfiguration } from "./configuration";
import type { ViewDataset } from "./types";
import type { ViewDefinition } from "./view-registry";

/** Input is an authorized, validated host projection; this is not an access-control filter. */
export function prepareViewReport(
  definition: ViewDefinition,
  data: ViewDataset,
  configuration?: ViewConfiguration,
): { data: ViewDataset; configuration: ViewConfiguration } {
  if (!configuration && definition.report?.configuration !== "automatic") {
    throw new Error(definition.report?.reason ?? "Cette vue nécessite une structure fournie par le référentiel.");
  }
  const prepared = structuredClone(configuration ?? definition.createDefaultConfiguration());
  // A report never falls back to demonstration content, including an empty projection.
  delete prepared.exampleData;
  const errors = validateConfiguration(prepared, definition.id);
  if (errors.length) throw new Error(errors[0]);
  return { data, configuration: prepared };
}
