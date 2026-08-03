import readXlsxFile, { type CellValue, type Sheet } from "read-excel-file/browser";
import type { Application, Capability, Collaborator, Feedback, Process, Responsibility, ViewDataset } from "./types";
import type { ViewImportResult } from "./view-registry";

type RecordRow = Record<string, CellValue | null>;

const emptyDataset = (): ViewDataset => ({ collaborators: [], processes: [], responsibilities: [], feedbacks: [], applications: [], capabilities: [] });
const asText = (value: CellValue | null) => value == null ? "" : String(value).trim();
const makeInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function recordsFromSheet(sheets: Sheet[], sheetName: string, requiredColumns: string[]) {
  const sheet = sheets.find((item) => item.sheet.toLocaleLowerCase("fr") === sheetName.toLocaleLowerCase("fr"));
  if (!sheet) throw new Error(`Feuille manquante : ${sheetName}.`);
  const [header = [], ...rows] = sheet.data;
  const columns = header.map(asText);
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
  const sheets = await readXlsxFile(file);
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
  return { data: { ...emptyDataset(), collaborators, processes, responsibilities, feedbacks }, rowCount: collaborators.length + processes.length + responsibilities.length + feedbacks.length, warnings: [] };
}

export async function importPosExcel(file: File): Promise<ViewImportResult> {
  const sheets = await readXlsxFile(file);
  const capabilityRows = recordsFromSheet(sheets, "Capacites", ["id", "nom", "domaine", "maturite", "criticite", "responsable"]);
  const applicationRows = recordsFromSheet(sheets, "Applications", ["id", "nom", "sante", "cycle_de_vie"]);
  const coverageRows = recordsFromSheet(sheets, "Couverture", ["capacite_id", "application_id"]);
  const healthMap: Record<string, Application["health"]> = { Sain: "healthy", "À surveiller": "watch", Critique: "critical" };
  const lifecycles: Application["lifecycle"][] = ["Investir", "Maintenir", "Migrer", "Retirer"];
  const criticalities: Capability["criticality"][] = ["Faible", "Moyenne", "Forte"];

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
    if (!criticalities.includes(criticality)) throw new Error(`Capacites : criticité invalide "${criticality}".`);
    const id = asText(row.id);
    return { id, name: asText(row.nom), domain: asText(row.domaine), maturity, criticality, owner: asText(row.responsable), applicationIds: coverage.filter((item) => item.capabilityId === id).map((item) => item.applicationId) };
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
  return { data: { ...emptyDataset(), applications, capabilities }, rowCount: applications.length + capabilities.length + coverage.length, warnings };
}
