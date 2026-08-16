export type Health = "healthy" | "watch" | "critical";

export type ResponsibilityKind =
  | "Pilote"
  | "Contributeur"
  | "Validation"
  | "Consulté";

export interface Collaborator {
  id: string;
  name: string;
  role: string;
  initials: string;
}

export interface Process {
  id: string;
  name: string;
  status: "Actif" | "À revoir" | "En transformation";
}

export interface Responsibility {
  id: string;
  collaboratorId: string;
  processId: string;
  kind: ResponsibilityKind;
}

export interface Feedback {
  id: string;
  processId: string;
  elementId?: string;
  content: string;
  createdAt: string;
}

export interface Application {
  id: string;
  name: string;
  health: Health;
  lifecycle: "Investir" | "Maintenir" | "Migrer" | "Retirer";
  urbanBlockId?: string;
}

export interface Capability {
  id: string;
  name: string;
  domain: string;
  maturity: number;
  criticality: "Faible" | "Moyenne" | "Forte";
  owner: string;
  applicationIds: string[];
}

export interface UrbanZone {
  id: string;
  name: string;
  description: string;
}

export interface UrbanDistrict {
  id: string;
  name: string;
  zoneId: string;
  description: string;
}

export interface UrbanBlock {
  id: string;
  name: string;
  districtId: string;
  status: "Cible" | "À rationaliser" | "À construire";
  owner: string;
}

export interface UrbanisationIndicator {
  id: string;
  label: string;
  group: string;
  current: number;
  target: number;
  mapping: number;
  weight: number;
  owner: string;
  evidence: string;
  action: string;
}

export type ArchitectureLayer = string;
export type ArchitectureStatus = string;

export interface ArchitectureElement {
  id: string;
  name: string;
  layer: ArchitectureLayer;
  domain: string;
  status: ArchitectureStatus;
  criticality: "Faible" | "Moyenne" | "Forte";
  owner: string;
  description: string;
}

export interface ArchitectureRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
}

export type TogafPhaseStatus = string;
export type TogafItemType = string;
export type TogafItemStatus = string;

export interface TogafPhase {
  id: string;
  code: string;
  name: string;
  status: TogafPhaseStatus;
  progress: number;
  owner: string;
  startDate: string;
  targetDate: string;
  objective: string;
  gate: string;
}

export interface TogafItem {
  id: string;
  phaseId: string;
  name: string;
  type: TogafItemType;
  status: TogafItemStatus;
  owner: string;
  dueDate: string;
  detail: string;
}

export type VerbatimCategory = string;
export type VerbatimSentiment = "Positif" | "Neutre" | "Négatif";

export interface Verbatim {
  id: string;
  text: string;
  category: VerbatimCategory;
  team: string;
  sentiment: VerbatimSentiment;
  weight: number;
}

export type PartitionValue = string | number | boolean;

/** Élément générique d'une vue en découpage. La structure porte le sens des niveaux et attributs. */
export interface PartitionItem {
  id: string;
  name: string;
  levelId: string;
  parentId?: string;
  description: string;
  values: Record<string, PartitionValue>;
}

/** Relation facultative entre deux éléments, par exemple la couverture d'une capacité par une application. */
export interface PartitionRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
}

export interface ViewDataset {
  collaborators: Collaborator[];
  processes: Process[];
  responsibilities: Responsibility[];
  feedbacks: Feedback[];
  applications: Application[];
  capabilities: Capability[];
  urbanZones: UrbanZone[];
  urbanDistricts: UrbanDistrict[];
  urbanBlocks: UrbanBlock[];
  urbanisationIndicators: UrbanisationIndicator[];
  architectureElements: ArchitectureElement[];
  architectureRelations: ArchitectureRelation[];
  togafPhases: TogafPhase[];
  togafItems: TogafItem[];
  verbatims: Verbatim[];
  partitionItems: PartitionItem[];
  partitionRelations: PartitionRelation[];
}
