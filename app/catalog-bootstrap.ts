import type { InstallationProfile } from "./auth-client";

export type CatalogBootstrapAction = "none" | "mark-only" | "seed-demo";

export function catalogBootstrapAction(
  profile: InstallationProfile,
  alreadyInitialized: boolean,
  legacyInitialized: boolean,
  existingInstanceCount: number,
): CatalogBootstrapAction {
  if (alreadyInitialized) return "none";
  if (legacyInitialized || existingInstanceCount > 0 || profile === "standard") return "mark-only";
  return "seed-demo";
}
