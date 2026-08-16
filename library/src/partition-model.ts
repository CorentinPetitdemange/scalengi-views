import { withExampleData, type ConfigurationItem, type ViewConfiguration } from "./configuration";
import { datasetWith, normalizeDataset } from "./dataset";
import { sampleDataset } from "./sample-data";
import type { PartitionItem, PartitionRelation, ViewDataset } from "./types";

export const PARTITION_VIEW_TYPE = "partition-view";

const text = (key: string, label: string, required = true) => ({ key, label, type: "text" as const, required });
const identifier = (key: string, label: string, required = true) => ({ key, label, type: "text" as const, required, identifier: true });
const textarea = (key: string, label: string) => ({ key, label, type: "textarea" as const });
const color = (key = "color", label = "Couleur") => ({ key, label, type: "color" as const });
const select = (key: string, label: string, choices: Array<{ value: string; label: string }>) => ({ key, label, type: "select" as const, required: true, choices });
const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "element";

const levelFields = [
  identifier("id", "Identifiant"), text("label", "Libellé"), text("plural", "Libellé pluriel"),
  identifier("parentLevelId", "Niveau parent", false),
  select("role", "Rendu", [{ value: "container", label: "Conteneur" }, { value: "card", label: "Carte" }, { value: "reference", label: "Référence liée" }]),
  textarea("description", "Description"), color(),
];

const attributeFields = [
  identifier("id", "Identifiant"), text("label", "Libellé"), identifier("levelId", "Niveau concerné"),
  select("type", "Type", [{ value: "text", label: "Texte" }, { value: "number", label: "Nombre" }, { value: "choice", label: "Liste de valeurs" }]),
  select("display", "Affichage", [{ value: "text", label: "Texte" }, { value: "badge", label: "Badge" }, { value: "metric", label: "Indicateur" }]),
  identifier("vocabularyId", "Vocabulaire", false), text("suffix", "Suffixe", false),
];

const vocabularyFields = [
  identifier("id", "Identifiant"), identifier("vocabularyId", "Vocabulaire"), text("value", "Valeur"), text("label", "Libellé"), color(),
];

function baseConfiguration(label: string, preset: string, levels: ConfigurationItem[], attributes: ConfigurationItem[], vocabularies: ConfigurationItem[]): ViewConfiguration {
  return {
    version: 1,
    viewType: PARTITION_VIEW_TYPE,
    label,
    options: { preset, showDescriptions: true, showReferences: true },
    sections: [
      { id: "levels", title: "Niveaux du découpage", description: "Ajoutez, retirez et ordonnez librement les niveaux. Un niveau peut contenir des éléments, afficher des cartes ou servir de référence liée.", itemLabel: "niveau", minItems: 1, maxItems: 16, fields: levelFields, items: levels },
      { id: "attributes", title: "Informations affichées", description: "Définissez les informations portées par les cartes de chaque niveau.", itemLabel: "information", maxItems: 40, fields: attributeFields, items: attributes },
      { id: "vocabularies", title: "Valeurs contrôlées", description: "Définissez les statuts et catégories proposés dans le modèle Excel, avec leur couleur.", itemLabel: "valeur", maxItems: 200, fields: vocabularyFields, items: vocabularies },
    ],
  };
}

export function capabilityPartitionData(source: ViewDataset = sampleDataset): ViewDataset {
  const domains = [...new Set(source.capabilities.map((item) => item.domain))];
  const items: PartitionItem[] = [
    ...domains.map((domain) => ({ id: `domain-${slug(domain)}`, name: domain, levelId: "domain", description: "", values: {} })),
    ...source.capabilities.map((capability) => ({ id: `capability-${capability.id}`, name: capability.name, levelId: "capability", parentId: `domain-${slug(capability.domain)}`, description: "", values: { maturity: capability.maturity, criticality: capability.criticality, owner: capability.owner } })),
    ...source.applications.map((application) => ({ id: `application-${application.id}`, name: application.name, levelId: "application", description: "", values: { health: application.health, lifecycle: application.lifecycle } })),
  ];
  const relations: PartitionRelation[] = source.capabilities.flatMap((capability) => capability.applicationIds.map((applicationId) => ({ id: `coverage-${capability.id}-${applicationId}`, sourceId: `capability-${capability.id}`, targetId: `application-${applicationId}`, type: "coverage" })));
  return datasetWith({ partitionItems: items, partitionRelations: relations });
}

export function urbanPartitionData(source: ViewDataset = sampleDataset): ViewDataset {
  const items: PartitionItem[] = [
    ...source.urbanZones.map((item) => ({ id: `zone-${item.id}`, name: item.name, levelId: "zone", description: item.description, values: {} })),
    ...source.urbanDistricts.map((item) => ({ id: `district-${item.id}`, name: item.name, levelId: "district", parentId: `zone-${item.zoneId}`, description: item.description, values: {} })),
    ...source.urbanBlocks.map((item) => ({ id: `block-${item.id}`, name: item.name, levelId: "block", parentId: `district-${item.districtId}`, description: "", values: { status: item.status, owner: item.owner } })),
    ...source.applications.filter((item) => item.urbanBlockId).map((item) => ({ id: `application-${item.id}`, name: item.name, levelId: "application", parentId: `block-${item.urbanBlockId}`, description: "", values: { health: item.health, lifecycle: item.lifecycle } })),
  ];
  return datasetWith({ partitionItems: items });
}

export function createCapabilityPartitionConfiguration(source: ViewDataset = sampleDataset): ViewConfiguration {
  const configuration = baseConfiguration("Capacités fonctionnelles", "capabilities", [
    { id: "domain", label: "Domaine", plural: "Domaines", parentLevelId: "", role: "container", description: "Grands ensembles fonctionnels.", color: "#2563eb" },
    { id: "capability", label: "Capacité", plural: "Capacités", parentLevelId: "domain", role: "card", description: "Aptitudes fonctionnelles du SI.", color: "#7c3aed" },
    { id: "application", label: "Application", plural: "Applications", parentLevelId: "", role: "reference", description: "Applications qui couvrent les capacités.", color: "#059669" },
  ], [
    { id: "maturity", label: "Maturité", levelId: "capability", type: "number", display: "metric", vocabularyId: "", suffix: "/5" },
    { id: "criticality", label: "Criticité", levelId: "capability", type: "choice", display: "badge", vocabularyId: "criticality", suffix: "" },
    { id: "owner", label: "Responsable", levelId: "capability", type: "text", display: "text", vocabularyId: "", suffix: "" },
    { id: "health", label: "Santé", levelId: "application", type: "choice", display: "badge", vocabularyId: "health", suffix: "" },
    { id: "lifecycle", label: "Cycle de vie", levelId: "application", type: "choice", display: "text", vocabularyId: "lifecycle", suffix: "" },
  ], [
    { id: "criticality-low", vocabularyId: "criticality", value: "Faible", label: "Faible", color: "#22c55e" },
    { id: "criticality-medium", vocabularyId: "criticality", value: "Moyenne", label: "Moyenne", color: "#f59e0b" },
    { id: "criticality-high", vocabularyId: "criticality", value: "Forte", label: "Forte", color: "#ef4444" },
    { id: "health-healthy", vocabularyId: "health", value: "healthy", label: "Sain", color: "#22c55e" },
    { id: "health-watch", vocabularyId: "health", value: "watch", label: "À surveiller", color: "#f59e0b" },
    { id: "health-critical", vocabularyId: "health", value: "critical", label: "Critique", color: "#ef4444" },
    ...["Investir", "Maintenir", "Migrer", "Retirer"].map((value) => ({ id: `lifecycle-${slug(value)}`, vocabularyId: "lifecycle", value, label: value, color: "#64748b" })),
  ]);
  return withExampleData(configuration, capabilityPartitionData(source));
}

export function createUrbanPartitionConfiguration(source: ViewDataset = sampleDataset, labels?: Partial<Record<"zone" | "district" | "block" | "application", { label: string; plural: string }>>): ViewConfiguration {
  const named = (id: "zone" | "district" | "block" | "application", label: string, plural: string) => labels?.[id] ?? { label, plural };
  const zone = named("zone", "Zone", "Zones"); const district = named("district", "Quartier", "Quartiers"); const block = named("block", "Îlot", "Îlots"); const application = named("application", "Application", "Applications");
  const configuration = baseConfiguration("POS urbain", "urban-pos", [
    { id: "zone", ...zone, parentLevelId: "", role: "container", description: "Grands ensembles du POS.", color: "#2563eb" },
    { id: "district", ...district, parentLevelId: "zone", role: "container", description: "Sous-ensembles fonctionnels.", color: "#7c3aed" },
    { id: "block", ...block, parentLevelId: "district", role: "container", description: "Unités d’urbanisation.", color: "#059669" },
    { id: "application", ...application, parentLevelId: "block", role: "card", description: "Applications positionnées dans le découpage.", color: "#d97706" },
  ], [
    { id: "status", label: "Statut", levelId: "block", type: "choice", display: "badge", vocabularyId: "urban-status", suffix: "" },
    { id: "owner", label: "Responsable", levelId: "block", type: "text", display: "text", vocabularyId: "", suffix: "" },
    { id: "health", label: "Santé", levelId: "application", type: "choice", display: "badge", vocabularyId: "health", suffix: "" },
    { id: "lifecycle", label: "Cycle de vie", levelId: "application", type: "choice", display: "text", vocabularyId: "lifecycle", suffix: "" },
  ], [
    ...["Cible", "À rationaliser", "À construire"].map((value, index) => ({ id: `urban-status-${index + 1}`, vocabularyId: "urban-status", value, label: value, color: ["#22c55e", "#f59e0b", "#2563eb"][index] })),
    { id: "health-healthy", vocabularyId: "health", value: "healthy", label: "Sain", color: "#22c55e" },
    { id: "health-watch", vocabularyId: "health", value: "watch", label: "À surveiller", color: "#f59e0b" },
    { id: "health-critical", vocabularyId: "health", value: "critical", label: "Critique", color: "#ef4444" },
    ...["Investir", "Maintenir", "Migrer", "Retirer"].map((value) => ({ id: `lifecycle-${slug(value)}`, vocabularyId: "lifecycle", value, label: value, color: "#64748b" })),
  ]);
  return withExampleData(configuration, urbanPartitionData(source));
}

export function createBlankPartitionConfiguration(): ViewConfiguration {
  return baseConfiguration("Structure vierge", "blank", [], [], []);
}

export function migrateLegacyPartition(type: string, rawData: ViewDataset, configuration?: ViewConfiguration) {
  const data = normalizeDataset(rawData);
  if (type === "pos") {
    const domains = configuration?.sections.find((section) => section.id === "domains")?.items ?? [];
    const mappedData = { ...data, capabilities: data.capabilities.map((capability) => ({ ...capability, domain: String(domains.find((domain) => domain.id === capability.domain)?.label ?? capability.domain) })) };
    const next = createCapabilityPartitionConfiguration(mappedData);
    const criticalities = configuration?.sections.find((section) => section.id === "criticalities")?.items;
    if (criticalities?.length) next.sections.find((section) => section.id === "vocabularies")!.items = next.sections.find((section) => section.id === "vocabularies")!.items.filter((item) => item.vocabularyId !== "criticality").concat(criticalities.map((item, index) => ({ id: `criticality-${index + 1}`, vocabularyId: "criticality", value: String(item.id), label: String(item.label ?? item.id), color: ["#22c55e", "#f59e0b", "#ef4444"][index % 3] })));
    if (configuration?.exampleData) { const legacyExample = normalizeDataset(configuration.exampleData); next.exampleData = capabilityPartitionData({ ...legacyExample, capabilities: legacyExample.capabilities.map((capability) => ({ ...capability, domain: String(domains.find((domain) => domain.id === capability.domain)?.label ?? capability.domain) })) }); }
    return { data: capabilityPartitionData(mappedData), configuration: next };
  }
  const configuredLevels = configuration?.sections.find((section) => section.id === "levels")?.items ?? [];
  const labels = configuredLevels.length ? Object.fromEntries(["zone", "district", "block", "application"].map((id) => { const item = configuredLevels.find((candidate) => candidate.id === id); return [id, { label: String(item?.label ?? id), plural: String(item?.plural ?? item?.label ?? id) }]; })) as Partial<Record<"zone" | "district" | "block" | "application", { label: string; plural: string }>> : undefined;
  const next = createUrbanPartitionConfiguration(data, labels);
  const statuses = configuration?.sections.find((section) => section.id === "blockStatuses")?.items;
  if (statuses?.length) next.sections.find((section) => section.id === "vocabularies")!.items = next.sections.find((section) => section.id === "vocabularies")!.items.filter((item) => item.vocabularyId !== "urban-status").concat(statuses.map((item, index) => ({ id: `urban-status-${index + 1}`, vocabularyId: "urban-status", value: String(item.id), label: String(item.label ?? item.id), color: ["#22c55e", "#f59e0b", "#2563eb", "#ef4444"][index % 4] })));
  if (configuration?.exampleData) next.exampleData = urbanPartitionData(normalizeDataset(configuration.exampleData));
  return { data: urbanPartitionData(data), configuration: next };
}
