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
}
