import readXlsxFile, { type CellValue, type Sheet } from "read-excel-file/browser";
import type { Application, ArchitectureElement, ArchitectureRelation, Capability, Collaborator, Feedback, PartitionItem, PartitionRelation, Process, Responsibility, TogafItem, TogafPhase, UrbanBlock, UrbanDistrict, UrbanisationIndicator, UrbanZone, Verbatim } from "./types";
import type { ViewImportResult } from "./view-registry";
import { optionOf, sectionOf, validateConfiguration, type ConfigurationItem, type ViewConfiguration } from "./configuration";
import { createDefaultConfiguration } from "./builtin-configurations";
import { createEmptyDataset } from "./dataset";
import { capabilityPartitionData, urbanPartitionData } from "./partition-model";

type RecordRow = Record<string, CellValue | null>;

const MAX_WORKBOOK_BYTES = 15 * 1024 * 1024;
const MAX_WORKBOOK_SHEETS = 32;
const MAX_SHEET_ROWS = 25_000;
const MAX_SHEET_COLUMNS = 100;
const MAX_CELL_TEXT = 32_767;

const asText = (value: CellValue | null) => {
  const text = value == null ? "" : String(value).trim();
  if (text.length > MAX_CELL_TEXT) throw new Error(`Une cellule dépasse la taille maximale de ${MAX_CELL_TEXT} caractères.`);
  return text;
};
const asDateText = (value: CellValue | null) => value instanceof Date ? value.toISOString().slice(0, 10) : asText(value);
const makeInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const makeSlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function readWorkbook(file: File) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Seuls les fichiers .xlsx sont acceptés.");
  if (file.size > MAX_WORKBOOK_BYTES) throw new Error("Le fichier Excel dépasse la taille maximale de 15 Mo.");
  const sheets = await readXlsxFile(file);
  if (sheets.length > MAX_WORKBOOK_SHEETS) throw new Error(`Le classeur ne peut pas contenir plus de ${MAX_WORKBOOK_SHEETS} feuilles.`);
  return sheets;
}

function inferredUrbanisationGroup(label: string) {
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  if (/donnee|referentiel|moa/.test(normalized)) return "Données & référentiels";
  if (/cartograph|diffusion|description des flux/.test(normalized)) return "Cartographies";
  if (/cible|migration|strategie|revision/.test(normalized)) return "Transformation & cibles";
  if (/regle|conformite|application des regles/.test(normalized)) return "Règles & conformité";
  if (/echange|operationnalite|risque/.test(normalized)) return "Socle & échanges";
  return "Gouvernance";
}

function score(value: CellValue | null, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) throw new Error(`Diagnostic : ${label} doit être compris entre 0 et 5.`);
  return parsed;
}

function recordsFromSheet(sheets: Sheet[], sheetName: string, requiredColumns: string[]) {
  const sheet = sheets.find((item) => item.sheet.toLocaleLowerCase("fr") === sheetName.toLocaleLowerCase("fr"));
  if (!sheet) throw new Error(`Feuille manquante : ${sheetName}.`);
  const [header = [], ...rows] = sheet.data;
  if (header.length > MAX_SHEET_COLUMNS) throw new Error(`Feuille ${sheetName} : maximum ${MAX_SHEET_COLUMNS} colonnes.`);
  if (rows.length > MAX_SHEET_ROWS) throw new Error(`Feuille ${sheetName} : maximum ${MAX_SHEET_ROWS} lignes.`);
  const columns = header.map(asText);
  if (columns.some((column) => !column)) throw new Error(`Feuille ${sheetName} : les en-têtes de colonnes ne peuvent pas être vides.`);
  if (new Set(columns).size !== columns.length) throw new Error(`Feuille ${sheetName} : les en-têtes de colonnes doivent être uniques.`);
  const missing = requiredColumns.filter((column) => !columns.includes(column));
  if (missing.length) throw new Error(`Feuille ${sheetName} : colonnes manquantes (${missing.join(", ")}).`);
  return rows.filter((row) => row.some((cell) => cell != null && asText(cell) !== "")).map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null])) as RecordRow);
}

function ensureUniqueIds(items: Array<{ id: string }>, label: string) {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id) throw new Error(`${label} : chaque ligne doit avoir un id.`);
    if (ids.has(item.id)) throw new Error(`${label} : l’id ${item.id} est utilisé plusieurs fois.`);
    ids.add(item.id);
  }
}

export async function importCollaboratorExcel(file: File): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const collaboratorRows = recordsFromSheet(sheets, "Collaborateurs", ["id", "nom", "fonction", "initiales"]);
  const processRows = recordsFromSheet(sheets, "Processus", ["id", "nom", "statut"]);
  const responsibilityRows = recordsFromSheet(sheets, "Responsabilites", ["id", "collaborateur_id", "processus_id", "role"]);
  const feedbackRows = recordsFromSheet(sheets, "Retours", ["id", "processus_id", "element_id", "contenu", "date_creation"]);
  const statuses: Process["status"][] = ["Actif", "À revoir", "En transformation"];
  const roles: Responsibility["kind"][] = ["Pilote", "Contributeur", "Validation", "Consulté"];

  const collaborators: Collaborator[] = collaboratorRows.map((row) => {
    const name = asText(row.nom);
    return { id: asText(row.id), name, role: asText(row.fonction), initials: asText(row.initiales) || makeInitials(name) };
  });
  const processes: Process[] = processRows.map((row) => {
    const status = asText(row.statut) as Process["status"];
    if (!statuses.includes(status)) throw new Error(`Processus : statut invalide "${status}".`);
    return { id: asText(row.id), name: asText(row.nom), status };
  });
  const responsibilities: Responsibility[] = responsibilityRows.map((row) => {
    const kind = asText(row.role) as Responsibility["kind"];
    if (!roles.includes(kind)) throw new Error(`Responsabilites : rôle invalide "${kind}".`);
    return { id: asText(row.id), collaboratorId: asText(row.collaborateur_id), processId: asText(row.processus_id), kind };
  });
  const feedbacks: Feedback[] = feedbackRows.map((row) => ({
    id: asText(row.id), processId: asText(row.processus_id), elementId: asText(row.element_id) || undefined,
    content: asText(row.contenu), createdAt: row.date_creation instanceof Date ? row.date_creation.toISOString() : asText(row.date_creation),
  }));
  ensureUniqueIds(collaborators, "Collaborateurs");
  ensureUniqueIds(processes, "Processus");
  ensureUniqueIds(responsibilities, "Responsabilites");
  ensureUniqueIds(feedbacks, "Retours");
  const collaboratorIds = new Set(collaborators.map((item) => item.id));
  const processIds = new Set(processes.map((item) => item.id));
  for (const responsibility of responsibilities) {
    if (!collaboratorIds.has(responsibility.collaboratorId)) throw new Error(`Responsabilites : collaborateur inconnu ${responsibility.collaboratorId}.`);
    if (!processIds.has(responsibility.processId)) throw new Error(`Responsabilites : processus inconnu ${responsibility.processId}.`);
  }
  for (const feedback of feedbacks) {
    if (!processIds.has(feedback.processId)) throw new Error(`Retours : processus inconnu ${feedback.processId}.`);
    if (!feedback.content) throw new Error(`Retours : le contenu est obligatoire.`);
  }
  return { data: { ...createEmptyDataset(), collaborators, processes, responsibilities, feedbacks }, rowCount: collaborators.length + processes.length + responsibilities.length + feedbacks.length, warnings: [] };
}

export async function importPartitionExcel(file: File, configuration?: ViewConfiguration): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const hasElements = sheets.some((sheet) => sheet.sheet.toLocaleLowerCase("fr") === "elements");
  if (!hasElements && optionOf<string>(configuration, "preset", "") === "capabilities") {
    const legacy = await importPosExcel(file);
    return { ...legacy, data: capabilityPartitionData(legacy.data), warnings: [...legacy.warnings, "Ancien modèle Capacités reconnu et converti vers la Vue en découpage."] };
  }
  if (!hasElements && optionOf<string>(configuration, "preset", "") === "urban-pos") {
    const legacy = await importUrbanPosExcel(file);
    return { ...legacy, data: urbanPartitionData(legacy.data), warnings: [...legacy.warnings, "Ancien modèle POS reconnu et converti vers la Vue en découpage."] };
  }
  const levels = sectionOf(configuration, "levels")?.items ?? [];
  const attributes = sectionOf(configuration, "attributes")?.items ?? [];
  const vocabularies = sectionOf(configuration, "vocabularies")?.items ?? [];
  if (!levels.length) throw new Error("Structure : ajoutez au moins un niveau avant d’importer des données.");
  const attributeIds = attributes.map((item) => String(item.id));
  const rows = recordsFromSheet(sheets, "Elements", ["id", "nom", "niveau", "parent_id", "description", ...attributeIds]);
  const relationRows = recordsFromSheet(sheets, "Relations", ["id", "source_id", "cible_id", "type"]);
  const levelById = new Map(levels.map((item) => [String(item.id), item]));
  const items: PartitionItem[] = rows.map((row, index) => {
    const levelId = asText(row.niveau);
    if (!levelById.has(levelId)) throw new Error(`Elements : niveau inconnu "${levelId}" à la ligne ${index + 2}.`);
    const values = Object.fromEntries(attributes.map((attribute) => {
      const raw = row[attribute.id];
      if (raw == null || asText(raw) === "") return [attribute.id, ""];
      if (attribute.type === "number") {
        const value = Number(raw); if (!Number.isFinite(value)) throw new Error(`Elements : ${String(attribute.label ?? attribute.id)} doit être un nombre à la ligne ${index + 2}.`); return [attribute.id, value];
      }
      if (attribute.type === "choice") {
        const allowed = vocabularies.filter((item) => item.vocabularyId === attribute.vocabularyId);
        const input = asText(raw); const match = allowed.find((item) => String(item.value ?? item.id) === input || String(item.label ?? item.value ?? item.id) === input);
        if (allowed.length && !match) throw new Error(`Elements : valeur invalide "${input}" pour ${String(attribute.label ?? attribute.id)} à la ligne ${index + 2}.`);
        return [attribute.id, String(match?.value ?? match?.id ?? input)];
      }
      return [attribute.id, asText(raw)];
    }));
    return { id: asText(row.id), name: asText(row.nom), levelId, parentId: asText(row.parent_id) || undefined, description: asText(row.description), values };
  });
  const relations: PartitionRelation[] = relationRows.map((row) => ({ id: asText(row.id), sourceId: asText(row.source_id), targetId: asText(row.cible_id), type: asText(row.type) || "lié à" }));
  ensureUniqueIds(items, "Elements"); ensureUniqueIds(relations, "Relations");
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    const level = levelById.get(item.levelId)!; const parentLevelId = String(level.parentLevelId ?? ""); const role = String(level.role ?? "card");
    if (role !== "reference" && parentLevelId && !item.parentId) throw new Error(`Elements : ${item.id} doit référencer un parent du niveau ${parentLevelId}.`);
    if (item.parentId) { const parent = byId.get(item.parentId); if (!parent) throw new Error(`Elements : parent inconnu ${item.parentId}.`); if (parentLevelId && parent.levelId !== parentLevelId) throw new Error(`Elements : le parent de ${item.id} doit appartenir au niveau ${parentLevelId}.`); }
  }
  for (const relation of relations) { if (!byId.has(relation.sourceId)) throw new Error(`Relations : source inconnue ${relation.sourceId}.`); if (!byId.has(relation.targetId)) throw new Error(`Relations : cible inconnue ${relation.targetId}.`); if (relation.sourceId === relation.targetId) throw new Error(`Relations : ${relation.id} relie un élément à lui-même.`); }
  const roots = items.filter((item) => { const level = levelById.get(item.levelId); return level?.role !== "reference" && !item.parentId; });
  const warnings = roots.length > 12 ? ["Le découpage contient plus de 12 racines ; utilisez le plein écran ou un filtre pour préserver la lisibilité."] : [];
  return { data: { ...createEmptyDataset(), partitionItems: items, partitionRelations: relations }, rowCount: items.length + relations.length, warnings };
}

export async function importPosExcel(file: File, configuration?: ViewConfiguration): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const capabilityRows = recordsFromSheet(sheets, "Capacites", ["id", "nom", "domaine", "maturite", "criticite", "responsable"]);
  const applicationRows = recordsFromSheet(sheets, "Applications", ["id", "nom", "sante", "cycle_de_vie"]);
  const coverageRows = recordsFromSheet(sheets, "Couverture", ["capacite_id", "application_id"]);
  const healthMap: Record<string, Application["health"]> = { Sain: "healthy", "À surveiller": "watch", Critique: "critical" };
  const lifecycles: Application["lifecycle"][] = ["Investir", "Maintenir", "Migrer", "Retirer"];
  const criticalities = (sectionOf(configuration, "criticalities")?.items.map((item) => item.id) ?? ["Faible", "Moyenne", "Forte"]) as Capability["criticality"][];
  const domains = sectionOf(configuration, "domains")?.items.map((item) => item.id) ?? [];

  const applications: Application[] = applicationRows.map((row) => {
    const healthLabel = asText(row.sante);
    const lifecycle = asText(row.cycle_de_vie) as Application["lifecycle"];
    if (!healthMap[healthLabel]) throw new Error(`Applications : santé invalide "${healthLabel}".`);
    if (!lifecycles.includes(lifecycle)) throw new Error(`Applications : cycle de vie invalide "${lifecycle}".`);
    return { id: asText(row.id), name: asText(row.nom), health: healthMap[healthLabel], lifecycle };
  });
  const coverage = coverageRows.map((row) => ({ capabilityId: asText(row.capacite_id), applicationId: asText(row.application_id) }));
  const capabilities: Capability[] = capabilityRows.map((row) => {
    const maturity = Number(row.maturite);
    const criticality = asText(row.criticite) as Capability["criticality"];
    if (!Number.isInteger(maturity) || maturity < 1 || maturity > 5) throw new Error(`Capacites : la maturité doit être comprise entre 1 et 5.`);
    const domain = asText(row.domaine);
    if (domains.length && !domains.includes(domain)) throw new Error(`Capacites : domaine invalide "${domain}". Utilisez une valeur définie dans la structure.`);
    if (criticalities.length && !criticalities.includes(criticality)) throw new Error(`Capacites : criticité invalide "${criticality}".`);
    const id = asText(row.id);
    return { id, name: asText(row.nom), domain, maturity, criticality, owner: asText(row.responsable), applicationIds: coverage.filter((item) => item.capabilityId === id).map((item) => item.applicationId) };
  });
  ensureUniqueIds(applications, "Applications");
  ensureUniqueIds(capabilities, "Capacites");
  const capabilityIds = new Set(capabilities.map((item) => item.id));
  const applicationIds = new Set(applications.map((item) => item.id));
  for (const item of coverage) {
    if (!capabilityIds.has(item.capabilityId)) throw new Error(`Couverture : capacité inconnue ${item.capabilityId}.`);
    if (!applicationIds.has(item.applicationId)) throw new Error(`Couverture : application inconnue ${item.applicationId}.`);
  }
  const warnings = capabilities.filter((item) => item.applicationIds.length === 0).length ? ["Certaines capacités ne sont couvertes par aucune application."] : [];
  return { data: { ...createEmptyDataset(), applications, capabilities }, rowCount: applications.length + capabilities.length + coverage.length, warnings };
}

export async function importUrbanPosExcel(file: File, configuration?: ViewConfiguration): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const levels = sectionOf(configuration, "levels")?.items ?? [];
  const sheetName = (id: string, fallback: string) => String(levels.find((item) => item.id === id)?.sheet || fallback);
  const zoneRows = recordsFromSheet(sheets, sheetName("zone", "Zones"), ["id", "nom", "description"]);
  const districtRows = recordsFromSheet(sheets, sheetName("district", "Quartiers"), ["id", "nom", "zone_id", "description"]);
  const blockRows = recordsFromSheet(sheets, sheetName("block", "Ilots"), ["id", "nom", "quartier_id", "statut", "responsable"]);
  const applicationRows = recordsFromSheet(sheets, sheetName("application", "Applications"), ["id", "nom", "ilot_id", "sante", "cycle_de_vie"]);
  const healthMap: Record<string, Application["health"]> = { Sain: "healthy", "À surveiller": "watch", Critique: "critical" };
  const lifecycles: Application["lifecycle"][] = ["Investir", "Maintenir", "Migrer", "Retirer"];
  const statuses = (sectionOf(configuration, "blockStatuses")?.items.map((item) => item.id) ?? ["Cible", "À rationaliser", "À construire"]) as UrbanBlock["status"][];

  const urbanZones: UrbanZone[] = zoneRows.map((row) => ({ id: asText(row.id), name: asText(row.nom), description: asText(row.description) }));
  const urbanDistricts: UrbanDistrict[] = districtRows.map((row) => ({ id: asText(row.id), name: asText(row.nom), zoneId: asText(row.zone_id), description: asText(row.description) }));
  const urbanBlocks: UrbanBlock[] = blockRows.map((row) => {
    const status = asText(row.statut) as UrbanBlock["status"];
    if (statuses.length && !statuses.includes(status)) throw new Error(`Ilots : statut invalide "${status}".`);
    return { id: asText(row.id), name: asText(row.nom), districtId: asText(row.quartier_id), status, owner: asText(row.responsable) };
  });
  const applications: Application[] = applicationRows.map((row) => {
    const healthLabel = asText(row.sante);
    const lifecycle = asText(row.cycle_de_vie) as Application["lifecycle"];
    if (!healthMap[healthLabel]) throw new Error(`Applications : santé invalide "${healthLabel}".`);
    if (!lifecycles.includes(lifecycle)) throw new Error(`Applications : cycle de vie invalide "${lifecycle}".`);
    return { id: asText(row.id), name: asText(row.nom), urbanBlockId: asText(row.ilot_id), health: healthMap[healthLabel], lifecycle };
  });
  ensureUniqueIds(urbanZones, "Zones");
  ensureUniqueIds(urbanDistricts, "Quartiers");
  ensureUniqueIds(urbanBlocks, "Ilots");
  ensureUniqueIds(applications, "Applications");
  const zoneIds = new Set(urbanZones.map((item) => item.id));
  const districtIds = new Set(urbanDistricts.map((item) => item.id));
  const blockIds = new Set(urbanBlocks.map((item) => item.id));
  for (const district of urbanDistricts) if (!zoneIds.has(district.zoneId)) throw new Error(`Quartiers : zone inconnue ${district.zoneId}.`);
  for (const block of urbanBlocks) if (!districtIds.has(block.districtId)) throw new Error(`Ilots : quartier inconnu ${block.districtId}.`);
  for (const application of applications) if (!application.urbanBlockId || !blockIds.has(application.urbanBlockId)) throw new Error(`Applications : îlot inconnu ${application.urbanBlockId || "(vide)"}.`);
  const emptyBlocks = urbanBlocks.filter((block) => !applications.some((application) => application.urbanBlockId === block.id)).length;
  const warnings = emptyBlocks ? [`${emptyBlocks} îlot${emptyBlocks > 1 ? "s" : ""} ne contient aucune application.`] : [];
  return { data: { ...createEmptyDataset(), applications, urbanZones, urbanDistricts, urbanBlocks }, rowCount: urbanZones.length + urbanDistricts.length + urbanBlocks.length + applications.length, warnings };
}

export async function importUrbanisationExcel(file: File, configuration?: ViewConfiguration): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const hasDiagnostic = sheets.some((sheet) => sheet.sheet.toLocaleLowerCase("fr") === "diagnostic");
  let indicators: UrbanisationIndicator[];

  if (hasDiagnostic) {
    const rows = recordsFromSheet(sheets, "Diagnostic", ["dimension", "groupe", "niveau_actuel", "objectif", "niveau_cartographie", "poids", "responsable", "preuve", "action"]);
    const configuredAxes = sectionOf(configuration, "axes")?.items ?? [];
    const configuredById = new Map(configuredAxes.map((axis) => [axis.id, axis]));
    indicators = rows.map((row, index) => {
      const label = asText(row.dimension);
      if (!label) throw new Error(`Diagnostic : la dimension de la ligne ${index + 2} est obligatoire.`);
      const rawWeight = row.poids == null || asText(row.poids) === "" ? 1 : Number(row.poids);
      if (!Number.isFinite(rawWeight) || rawWeight <= 0 || rawWeight > 5) throw new Error(`Diagnostic : le poids de la ligne ${index + 2} doit être supérieur à 0 et inférieur ou égal à 5.`);
      const id = asText(row.id) || makeSlug(label);
      const axis = configuredById.get(id);
      if (configuredAxes.length && !axis) throw new Error(`Diagnostic : l’axe "${id}" n’existe pas dans la structure de cette vue.`);
      return {
        id, label: String(axis?.label ?? label), group: String(axis?.group ?? (asText(row.groupe) || "Non classé")),
        current: score(row.niveau_actuel, `niveau_actuel ligne ${index + 2}`),
        target: axis ? Number(axis.target ?? 0) : score(row.objectif, `objectif ligne ${index + 2}`),
        mapping: score(row.niveau_cartographie, `niveau_cartographie ligne ${index + 2}`),
        weight: axis ? Number(axis.weight ?? 1) : rawWeight, owner: asText(row.responsable), evidence: asText(row.preuve), action: asText(row.action),
      };
    });
  } else {
    const rows = recordsFromSheet(sheets, "Indicateur", ["Indicateur", "Objectif Niveau d'Urbanisation", "Niveau Actuel d'Urbanisation", "Niveau Cartographie"]);
    indicators = rows.map((row, index) => {
      const label = asText(row.Indicateur);
      if (!label) throw new Error(`Indicateur : le libellé de la ligne ${index + 2} est obligatoire.`);
      return {
        id: makeSlug(label), label, group: inferredUrbanisationGroup(label),
        current: score(row["Niveau Actuel d'Urbanisation"], `niveau actuel ligne ${index + 2}`),
        target: score(row["Objectif Niveau d'Urbanisation"], `objectif ligne ${index + 2}`),
        mapping: score(row["Niveau Cartographie"], `niveau de cartographie ligne ${index + 2}`),
        weight: 1, owner: "", evidence: "", action: "",
      };
    });
  }

  ensureUniqueIds(indicators, "Diagnostic");
  if (indicators.length < 3) throw new Error("Diagnostic : au moins trois dimensions sont nécessaires pour construire le radar.");
  const warnings = indicators.length > 16 ? ["Le diagnostic contient plus de 16 dimensions. La vue s’ouvre sur les 10 écarts prioritaires pour préserver la lisibilité ; toutes les dimensions restent sélectionnables."] : [];
  return { data: { ...createEmptyDataset(), urbanisationIndicators: indicators }, rowCount: indicators.length, warnings };
}

export async function importSILayersExcel(file: File, configuration?: ViewConfiguration): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const elementRows = recordsFromSheet(sheets, "Elements", ["id", "nom", "couche", "domaine", "statut", "criticite", "responsable", "description"]);
  const relationRows = recordsFromSheet(sheets, "Relations", ["id", "source_id", "cible_id", "relation"]);
  const layers = (sectionOf(configuration, "layers")?.items.map((item) => item.id) ?? ["Métier", "Données", "Applications", "Technologies"]) as ArchitectureElement["layer"][];
  const statuses = (sectionOf(configuration, "statuses")?.items.map((item) => item.id) ?? ["Cible", "À renforcer", "À transformer", "À retirer"]) as ArchitectureElement["status"][];
  const criticalities = (sectionOf(configuration, "criticalities")?.items.map((item) => item.id) ?? ["Faible", "Moyenne", "Forte"]) as ArchitectureElement["criticality"][];
  const architectureElements: ArchitectureElement[] = elementRows.map((row, index) => {
    const layer = asText(row.couche) as ArchitectureElement["layer"];
    const status = asText(row.statut) as ArchitectureElement["status"];
    const criticality = asText(row.criticite) as ArchitectureElement["criticality"];
    if (layers.length && !layers.includes(layer)) throw new Error(`Elements : couche invalide "${layer}" à la ligne ${index + 2}.`);
    if (statuses.length && !statuses.includes(status)) throw new Error(`Elements : statut invalide "${status}" à la ligne ${index + 2}.`);
    if (criticalities.length && !criticalities.includes(criticality)) throw new Error(`Elements : criticité invalide "${criticality}" à la ligne ${index + 2}.`);
    return { id: asText(row.id), name: asText(row.nom), layer, domain: asText(row.domaine) || "Non classé", status, criticality, owner: asText(row.responsable), description: asText(row.description) };
  });
  const architectureRelations: ArchitectureRelation[] = relationRows.map((row) => ({ id: asText(row.id), sourceId: asText(row.source_id), targetId: asText(row.cible_id), relation: asText(row.relation) || "Dépend de" }));
  ensureUniqueIds(architectureElements, "Elements");
  ensureUniqueIds(architectureRelations, "Relations");
  const elementIds = new Set(architectureElements.map((item) => item.id));
  for (const relation of architectureRelations) {
    if (!elementIds.has(relation.sourceId)) throw new Error(`Relations : source inconnue ${relation.sourceId}.`);
    if (!elementIds.has(relation.targetId)) throw new Error(`Relations : cible inconnue ${relation.targetId}.`);
    if (relation.sourceId === relation.targetId) throw new Error(`Relations : ${relation.id} relie un élément à lui-même.`);
  }
  const orphanCount = architectureElements.filter((item) => !architectureRelations.some((relation) => relation.sourceId === item.id || relation.targetId === item.id)).length;
  const warnings = orphanCount ? [`${orphanCount} élément${orphanCount > 1 ? "s sont" : " est"} isolé${orphanCount > 1 ? "s" : ""} : aucune relation n’est documentée.`] : [];
  return { data: { ...createEmptyDataset(), architectureElements, architectureRelations }, rowCount: architectureElements.length + architectureRelations.length, warnings };
}

export async function importMetamodelExcel(file: File, configuration?: ViewConfiguration): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const layerRows = recordsFromSheet(sheets, "Couches", ["id", "libelle", "description", "couleur"]);
  const objectRows = recordsFromSheet(sheets, "TypesObjets", ["id", "libelle", "couche_id", "description", "couleur"]);
  const relationRows = recordsFromSheet(sheets, "Relations", ["id", "libelle", "source_type_id", "cible_type_id", "cardinalite_source", "cardinalite_cible", "description"]);
  const safeId = /^[a-z][a-z0-9-]{1,63}$/;
  const cardinalities = new Set(["0..1", "1", "0..*", "1..*"]);
  const colorOrDefault = (value: CellValue | null, fallback: string, row: number) => {
    const color = asText(value) || fallback;
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Couleur invalide à la ligne ${row} : utilisez le format #RRGGBB.`);
    return color;
  };
  const checkedId = (value: CellValue | null, sheet: string, row: number) => {
    const id = asText(value);
    if (!safeId.test(id)) throw new Error(`${sheet} : identifiant invalide « ${id} » à la ligne ${row}. Utilisez lettres minuscules, chiffres et tirets.`);
    return id;
  };
  const layers: ConfigurationItem[] = layerRows.map((row, index) => {
    const rawLevel = asText(row.niveau) || asText(row.tranche);
    const rowNumber = rawLevel ? Number(rawLevel) : index + 1;
    const rawColumn = asText(row.colonne_transverse);
    const column = rawColumn ? Number(rawColumn) : index + 1;
    const layout = asText(row.disposition) || "stacked";
    const side = asText(row.cote) || "right";
    if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > 64) throw new Error(`Couches : niveau invalide « ${rawLevel} » à la ligne ${index + 2}. Utilisez un entier entre 1 et 64.`);
    if (!Number.isInteger(column) || column < 1 || column > 64) throw new Error(`Couches : colonne transverse invalide « ${rawColumn} » à la ligne ${index + 2}. Utilisez un entier entre 1 et 64.`);
    if (layout !== "stacked" && layout !== "transverse") throw new Error(`Couches : disposition invalide « ${layout} » à la ligne ${index + 2}. Utilisez stacked ou transverse.`);
    if (side !== "left" && side !== "right") throw new Error(`Couches : côté transverse invalide « ${side} » à la ligne ${index + 2}. Utilisez left ou right.`);
    return { id: checkedId(row.id, "Couches", index + 2), label: asText(row.libelle), description: asText(row.description), row: rowNumber, column, layout, side, color: colorOrDefault(row.couleur, "#2563eb", index + 2) };
  });
  const objectTypes: ConfigurationItem[] = objectRows.map((row, index) => ({ id: checkedId(row.id, "TypesObjets", index + 2), label: asText(row.libelle), layerId: asText(row.couche_id), description: asText(row.description), color: colorOrDefault(row.couleur, "#2563eb", index + 2) }));
  const relationTypes: ConfigurationItem[] = relationRows.map((row, index) => {
    const sourceCardinality = asText(row.cardinalite_source);
    const targetCardinality = asText(row.cardinalite_cible);
    if (!cardinalities.has(sourceCardinality) || !cardinalities.has(targetCardinality)) throw new Error(`Relations : cardinalité invalide à la ligne ${index + 2}.`);
    return { id: checkedId(row.id, "Relations", index + 2), label: asText(row.libelle), sourceTypeId: asText(row.source_type_id), targetTypeId: asText(row.cible_type_id), sourceCardinality, targetCardinality, description: asText(row.description) };
  });
  ensureUniqueIds(layers, "Couches");
  ensureUniqueIds(objectTypes, "TypesObjets");
  ensureUniqueIds(relationTypes, "Relations");
  if (!layers.length) throw new Error("Couches : ajoutez au moins une couche.");
  if (!objectTypes.length) throw new Error("TypesObjets : ajoutez au moins un type d’objet.");
  const layerIds = new Set(layers.map((item) => item.id));
  const objectTypeIds = new Set(objectTypes.map((item) => item.id));
  for (const item of objectTypes) if (!layerIds.has(String(item.layerId))) throw new Error(`TypesObjets : la couche « ${item.layerId} » du type ${item.id} n’existe pas.`);
  for (const relation of relationTypes) {
    if (!objectTypeIds.has(String(relation.sourceTypeId))) throw new Error(`Relations : le type source « ${relation.sourceTypeId} » de ${relation.id} n’existe pas.`);
    if (!objectTypeIds.has(String(relation.targetTypeId))) throw new Error(`Relations : le type cible « ${relation.targetTypeId} » de ${relation.id} n’existe pas.`);
  }
  const base = configuration?.viewType === "si-metamodel" ? structuredClone(configuration) : createDefaultConfiguration("si-metamodel");
  const nextConfiguration: ViewConfiguration = {
    ...base,
    label: base.label || "Métamodèle du SI",
    sections: base.sections.map((section) => section.id === "layers" ? { ...section, items: layers } : section.id === "objectTypes" ? { ...section, items: objectTypes } : section.id === "relationTypes" ? { ...section, items: relationTypes } : section),
  };
  delete nextConfiguration.exampleData;
  const errors = validateConfiguration(nextConfiguration, "si-metamodel");
  if (errors.length) throw new Error(errors.join(" "));
  const isolated = objectTypes.filter((item) => !relationTypes.some((relation) => relation.sourceTypeId === item.id || relation.targetTypeId === item.id)).length;
  return { data: createEmptyDataset(), configuration: nextConfiguration, rowCount: layers.length + objectTypes.length + relationTypes.length, warnings: isolated ? [`${isolated} type${isolated > 1 ? "s d’objets sont" : " d’objet est"} isolé${isolated > 1 ? "s" : ""} dans le métamodèle.`] : [] };
}

export async function importTogafExcel(file: File, configuration?: ViewConfiguration): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const phaseRows = recordsFromSheet(sheets, "Phases", ["id", "code", "nom", "statut", "avancement", "responsable", "date_debut", "date_cible", "objectif", "gate"]);
  const itemRows = recordsFromSheet(sheets, "Elements", ["id", "phase_id", "nom", "type", "statut", "responsable", "date_cible", "detail"]);
  const phaseStatuses: TogafPhase["status"][] = ["À démarrer", "En cours", "À valider", "Validée", "Bloquée"];
  const configuredPhases = sectionOf(configuration, "phases")?.items ?? [];
  const itemTypes = (sectionOf(configuration, "itemTypes")?.items.map((item) => item.id) ?? ["Livrable", "Décision", "Risque", "Action"]) as TogafItem["type"][];
  const itemStatuses: TogafItem["status"][] = ["À faire", "En cours", "À valider", "Validé", "Bloqué"];
  const togafPhases: TogafPhase[] = phaseRows.map((row, index) => {
    const status = asText(row.statut) as TogafPhase["status"];
    const progress = Number(row.avancement);
    if (!phaseStatuses.includes(status)) throw new Error(`Phases : statut invalide "${status}" à la ligne ${index + 2}.`);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error(`Phases : l’avancement de la ligne ${index + 2} doit être compris entre 0 et 100.`);
    return { id: asText(row.id), code: asText(row.code), name: asText(row.nom), status, progress, owner: asText(row.responsable), startDate: asDateText(row.date_debut), targetDate: asDateText(row.date_cible), objective: asText(row.objectif), gate: asText(row.gate) };
  });
  const togafItems: TogafItem[] = itemRows.map((row, index) => {
    const type = asText(row.type) as TogafItem["type"];
    const status = asText(row.statut) as TogafItem["status"];
    if (itemTypes.length && !itemTypes.includes(type)) throw new Error(`Elements : type invalide "${type}" à la ligne ${index + 2}.`);
    if (!itemStatuses.includes(status)) throw new Error(`Elements : statut invalide "${status}" à la ligne ${index + 2}.`);
    return { id: asText(row.id), phaseId: asText(row.phase_id), name: asText(row.nom), type, status, owner: asText(row.responsable), dueDate: asDateText(row.date_cible), detail: asText(row.detail) };
  });
  ensureUniqueIds(togafPhases, "Phases");
  ensureUniqueIds(togafItems, "Elements");
  const phaseIds = new Set(togafPhases.map((item) => item.id));
  if (configuredPhases.length) {
    const configuredIds = new Set(configuredPhases.map((item) => item.id));
    for (const phase of togafPhases) if (!configuredIds.has(phase.id)) throw new Error(`Phases : ${phase.id} n’existe pas dans la structure de cette vue.`);
  }
  for (const item of togafItems) if (!phaseIds.has(item.phaseId)) throw new Error(`Elements : phase inconnue ${item.phaseId}.`);
  const warnings = togafPhases.some((phase) => phase.status === "À valider" && !togafItems.some((item) => item.phaseId === phase.id)) ? ["Une phase à valider ne contient aucun livrable, décision, risque ou action documenté."] : [];
  return { data: { ...createEmptyDataset(), togafPhases, togafItems }, rowCount: togafPhases.length + togafItems.length, warnings };
}

export async function importVerbatimExcel(file: File, configuration?: ViewConfiguration): Promise<ViewImportResult> {
  const sheets = await readWorkbook(file);
  const rows = recordsFromSheet(sheets, "Verbatims", ["id", "verbatim", "categorie", "equipe", "sentiment", "poids"]);
  const categories = sectionOf(configuration, "categories")?.items ?? [];
  const categoryLookup = new Map<string, string>();
  for (const category of categories) {
    categoryLookup.set(String(category.id).toLocaleLowerCase("fr"), String(category.id));
    categoryLookup.set(String(category.label ?? category.id).toLocaleLowerCase("fr"), String(category.id));
  }
  const sentiments: Verbatim["sentiment"][] = ["Positif", "Neutre", "Négatif"];
  const verbatims: Verbatim[] = rows.map((row, index) => {
    const text = asText(row.verbatim);
    if (!text) throw new Error(`Verbatims : le texte de la ligne ${index + 2} est obligatoire.`);
    const categoryValue = asText(row.categorie);
    const category = categoryLookup.get(categoryValue.toLocaleLowerCase("fr")) ?? categoryValue;
    if (categories.length && !categoryLookup.has(categoryValue.toLocaleLowerCase("fr"))) throw new Error(`Verbatims : catégorie invalide « ${categoryValue} » à la ligne ${index + 2}.`);
    const sentiment = asText(row.sentiment) as Verbatim["sentiment"];
    if (!sentiments.includes(sentiment)) throw new Error(`Verbatims : sentiment invalide « ${sentiment} » à la ligne ${index + 2}.`);
    const weight = row.poids == null || asText(row.poids) === "" ? 1 : Number(row.poids);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 10) throw new Error(`Verbatims : le poids de la ligne ${index + 2} doit être compris entre 0 et 10.`);
    return { id: asText(row.id), text, category, team: asText(row.equipe) || "Non renseignée", sentiment, weight };
  });
  ensureUniqueIds(verbatims, "Verbatims");
  return { data: { ...createEmptyDataset(), verbatims }, rowCount: verbatims.length, warnings: [] };
}
