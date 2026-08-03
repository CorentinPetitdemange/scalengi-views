import { CollaboratorJourneyView } from "./CollaboratorJourneyView";
import { importCollaboratorExcel, importPosExcel, importUrbanPosExcel } from "./excel-import";
import { CapabilityMapView } from "./CapabilityMapView";
import { sampleDataset } from "./sample-data";
import type { ViewDataset } from "./types";
import { UrbanPosView } from "./UrbanPosView";
import { ViewRegistry, type ViewDefinition } from "./view-registry";

const empty = (): ViewDataset => ({ collaborators: [], processes: [], responsibilities: [], feedbacks: [], applications: [], capabilities: [], urbanZones: [], urbanDistricts: [], urbanBlocks: [] });
const collaboratorDemo = (): ViewDataset => ({ ...empty(), collaborators: structuredClone(sampleDataset.collaborators), processes: structuredClone(sampleDataset.processes), responsibilities: structuredClone(sampleDataset.responsibilities), feedbacks: structuredClone(sampleDataset.feedbacks) });
const posDemo = (): ViewDataset => ({ ...empty(), applications: structuredClone(sampleDataset.applications), capabilities: structuredClone(sampleDataset.capabilities) });
const urbanPosDemo = (): ViewDataset => ({ ...empty(), applications: structuredClone(sampleDataset.applications), urbanZones: structuredClone(sampleDataset.urbanZones), urbanDistricts: structuredClone(sampleDataset.urbanDistricts), urbanBlocks: structuredClone(sampleDataset.urbanBlocks) });

export const collaboratorJourneyDefinition: ViewDefinition<"collaborator-journey"> = {
  id: "collaborator-journey",
  title: "Vue Collaborateurs",
  shortTitle: "Collaborateurs",
  category: "Organisation",
  description: "Comprendre l’environnement d’un collaborateur, ses responsabilités, ses processus et ses relations de travail.",
  icon: "users",
  accent: "violet",
  insights: ["Responsabilités", "Processus partagés", "Réseau de collaboration"],
  component: CollaboratorJourneyView,
  createEmptyData: empty,
  createDemoData: collaboratorDemo,
  importExcel: importCollaboratorExcel,
  template: { filename: "modele-vue-collaborateurs.xlsx", url: "/templates/modele-vue-collaborateurs.xlsx" },
  guide: {
    purpose: "Cette vue part d’une personne et rend visibles les processus sur lesquels elle intervient, son rôle et les collègues avec lesquels elle partage ces processus.",
    questions: ["Sur quels processus cette personne intervient-elle ?", "Avec qui travaille-t-elle réellement ?", "Où se concentrent ses responsabilités et dépendances ?"],
    steps: [
      { title: "Télécharger le modèle", description: "Le classeur contient les feuilles et les colonnes attendues, avec une ligne d’exemple." },
      { title: "Renseigner les relations", description: "Les identifiants relient collaborateurs, processus, responsabilités et retours dans les feuilles correspondantes." },
      { title: "Importer dans cette vue", description: "Le fichier est contrôlé puis enregistré uniquement dans cette instance de vue." },
    ],
    sheets: [
      { name: "Collaborateurs", columns: ["id", "nom", "fonction", "initiales"], description: "Les personnes représentées." },
      { name: "Processus", columns: ["id", "nom", "statut"], description: "Les processus à faire apparaître." },
      { name: "Responsabilites", columns: ["id", "collaborateur_id", "processus_id", "role"], description: "Le rôle d’une personne dans un processus." },
      { name: "Retours", columns: ["id", "processus_id", "element_id", "contenu", "date_creation"], description: "Les retours associés aux processus et, facultativement, à un élément précis." },
    ],
  },
};

export const posDefinition: ViewDefinition<"pos"> = {
  id: "pos",
  title: "Cartographie des capacités fonctionnelles",
  shortTitle: "Capacités",
  category: "Architecture d’entreprise",
  description: "Lire la couverture fonctionnelle du SI, identifier les fragilités et les capacités non couvertes.",
  icon: "boxes",
  accent: "blue",
  insights: ["Couverture", "Santé applicative", "Maturité"],
  component: CapabilityMapView,
  createEmptyData: empty,
  createDemoData: posDemo,
  importExcel: importPosExcel,
  template: { filename: "modele-vue-capacites.xlsx", url: "/templates/modele-vue-capacites.xlsx" },
  guide: {
    purpose: "Cette vue organise les capacités métier par domaine et superpose leur couverture applicative, leur maturité et leur criticité pour faire ressortir les zones fonctionnelles à traiter.",
    questions: ["Quelles capacités sont mal ou non couvertes ?", "Où se trouvent les applications critiques ?", "Quels domaines cumulent faible maturité et forte criticité ?"],
    steps: [
      { title: "Télécharger le modèle", description: "Le modèle sépare les capacités, les applications et leurs liens de couverture." },
      { title: "Décrire le patrimoine", description: "Utilisez des identifiants stables pour relier chaque capacité à une ou plusieurs applications." },
      { title: "Importer dans cette vue", description: "Les indicateurs et la matrice sont recalculés à partir de ce fichier seulement." },
    ],
    sheets: [
      { name: "Capacites", columns: ["id", "nom", "domaine", "maturite", "criticite", "responsable"], description: "Le découpage fonctionnel du SI." },
      { name: "Applications", columns: ["id", "nom", "sante", "cycle_de_vie"], description: "Le patrimoine applicatif utile à cette analyse." },
      { name: "Couverture", columns: ["capacite_id", "application_id"], description: "Les relations entre capacités et applications." },
    ],
  },
};

export const urbanPosDefinition: ViewDefinition<"urban-pos"> = {
  id: "urban-pos",
  title: "Plan d’occupation du sol urbain",
  shortTitle: "POS urbain",
  category: "Urbanisation du SI",
  description: "Positionner les applications dans un découpage hiérarchique en zones, quartiers et îlots.",
  icon: "map",
  accent: "emerald",
  insights: ["Zones & quartiers", "Îlots applicatifs", "Rationalisation"],
  component: UrbanPosView,
  createEmptyData: empty,
  createDemoData: urbanPosDemo,
  importExcel: importUrbanPosExcel,
  template: { filename: "modele-pos-urbain.xlsx", url: "/templates/modele-pos-urbain.xlsx" },
  guide: {
    purpose: "Le POS urbain montre où se situe chaque application dans l’architecture fonctionnelle : une zone contient des quartiers, un quartier contient des îlots et chaque application occupe un îlot.",
    questions: ["Où chaque application est-elle positionnée ?", "Quels îlots doivent être rationalisés ou construits ?", "Où se concentrent les applications critiques ou en retrait ?"],
    steps: [
      { title: "Définir les zones", description: "Créez le découpage stable du SI, puis rattachez chaque quartier à une zone." },
      { title: "Décrire les îlots", description: "Rattachez chaque îlot à un quartier et qualifiez son statut d’urbanisation." },
      { title: "Positionner les applications", description: "Chaque application référence exactement un îlot, avec sa santé et son cycle de vie." },
    ],
    sheets: [
      { name: "Zones", columns: ["id", "nom", "description"], description: "Les grands ensembles fonctionnels du SI." },
      { name: "Quartiers", columns: ["id", "nom", "zone_id", "description"], description: "Les subdivisions fonctionnelles rattachées à une zone." },
      { name: "Ilots", columns: ["id", "nom", "quartier_id", "statut", "responsable"], description: "Les unités d’urbanisation qui accueillent les applications." },
      { name: "Applications", columns: ["id", "nom", "ilot_id", "sante", "cycle_de_vie"], description: "Les applications positionnées dans les îlots." },
    ],
  },
};

export const viewRegistry = new ViewRegistry().register(collaboratorJourneyDefinition).register(posDefinition).register(urbanPosDefinition);
