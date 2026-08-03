import { CollaboratorJourneyView } from "./CollaboratorJourneyView";
import { importCollaboratorExcel, importPosExcel } from "./excel-import";
import { PosView } from "./PosView";
import { sampleDataset } from "./sample-data";
import type { ViewDataset } from "./types";
import { ViewRegistry, type ViewDefinition } from "./view-registry";

const empty = (): ViewDataset => ({ collaborators: [], processes: [], responsibilities: [], applications: [], capabilities: [] });
const collaboratorDemo = (): ViewDataset => ({ ...empty(), collaborators: structuredClone(sampleDataset.collaborators), processes: structuredClone(sampleDataset.processes), responsibilities: structuredClone(sampleDataset.responsibilities) });
const posDemo = (): ViewDataset => ({ ...empty(), applications: structuredClone(sampleDataset.applications), capabilities: structuredClone(sampleDataset.capabilities) });

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
      { title: "Renseigner les relations", description: "Les identifiants relient les collaborateurs aux processus dans la feuille Responsabilites." },
      { title: "Importer dans cette vue", description: "Le fichier est contrôlé puis enregistré uniquement dans cette instance de vue." },
    ],
    sheets: [
      { name: "Collaborateurs", columns: ["id", "nom", "fonction", "initiales"], description: "Les personnes représentées." },
      { name: "Processus", columns: ["id", "nom", "statut"], description: "Les processus à faire apparaître." },
      { name: "Responsabilites", columns: ["id", "collaborateur_id", "processus_id", "role"], description: "Le rôle d’une personne dans un processus." },
    ],
  },
};

export const posDefinition: ViewDefinition<"pos"> = {
  id: "pos",
  title: "Plan d’occupation du sol",
  shortTitle: "POS",
  category: "Architecture d’entreprise",
  description: "Lire la couverture fonctionnelle du SI, identifier les fragilités et les capacités non couvertes.",
  icon: "boxes",
  accent: "blue",
  insights: ["Couverture", "Santé applicative", "Maturité"],
  component: PosView,
  createEmptyData: empty,
  createDemoData: posDemo,
  importExcel: importPosExcel,
  template: { filename: "modele-vue-pos.xlsx", url: "/templates/modele-vue-pos.xlsx" },
  guide: {
    purpose: "Le POS organise les capacités métier par domaine et superpose leur couverture applicative, leur maturité et leur criticité pour faire ressortir les zones à traiter.",
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

export const viewRegistry = new ViewRegistry().register(collaboratorJourneyDefinition).register(posDefinition);
