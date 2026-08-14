import { CollaboratorJourneyView } from "./CollaboratorJourneyView";
import { buildCapabilityTemplate, buildCollaboratorTemplate, buildLayersTemplate, buildRadarTemplate, buildTogafTemplate, buildUrbanPosTemplate, buildVerbatimTemplate, createBlankConfiguration, createDefaultConfiguration } from "./builtin-configurations";
import { importCollaboratorExcel, importPosExcel, importSILayersExcel, importTogafExcel, importUrbanisationExcel, importUrbanPosExcel, importVerbatimExcel } from "./excel-import";
import { CapabilityMapView } from "./CapabilityMapView";
import { createEmptyDataset, datasetWith } from "./dataset";
import { sampleDataset } from "./sample-data";
import { SILayersView } from "./SILayersView";
import { TogafTrackingView } from "./TogafTrackingView";
import { UrbanPosView } from "./UrbanPosView";
import { UrbanisationRadarView } from "./UrbanisationRadarView";
import { VerbatimCloudView } from "./VerbatimCloudView";
import { defineView, ViewRegistry } from "./view-registry";

const collaboratorDemo = () => datasetWith({ collaborators: structuredClone(sampleDataset.collaborators), processes: structuredClone(sampleDataset.processes), responsibilities: structuredClone(sampleDataset.responsibilities), feedbacks: structuredClone(sampleDataset.feedbacks) });
const posDemo = () => datasetWith({ applications: structuredClone(sampleDataset.applications), capabilities: structuredClone(sampleDataset.capabilities) });
const urbanPosDemo = () => datasetWith({ applications: structuredClone(sampleDataset.applications), urbanZones: structuredClone(sampleDataset.urbanZones), urbanDistricts: structuredClone(sampleDataset.urbanDistricts), urbanBlocks: structuredClone(sampleDataset.urbanBlocks) });
const urbanisationDemo = () => datasetWith({ urbanisationIndicators: structuredClone(sampleDataset.urbanisationIndicators) });
const siLayersDemo = () => datasetWith({ architectureElements: structuredClone(sampleDataset.architectureElements), architectureRelations: structuredClone(sampleDataset.architectureRelations) });
const togafDemo = () => datasetWith({ togafPhases: structuredClone(sampleDataset.togafPhases), togafItems: structuredClone(sampleDataset.togafItems) });
const verbatimDemo = () => datasetWith({ verbatims: structuredClone(sampleDataset.verbatims) });

export const collaboratorJourneyDefinition = defineView({
  id: "collaborator-journey",
  title: "Vue Collaborateurs",
  shortTitle: "Collaborateurs",
  demoName: "Collaboration — Démonstration",
  category: "Organisation",
  catalogGroup: "organisation-experience",
  description: "Comprendre l’environnement d’un collaborateur, ses responsabilités, ses processus et ses relations de travail.",
  icon: "users",
  accent: "violet",
  insights: ["Responsabilités", "Processus partagés", "Réseau de collaboration"],
  component: CollaboratorJourneyView,
  createEmptyData: createEmptyDataset,
  createDemoData: collaboratorDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("collaborator-journey"),
  createBlankConfiguration: () => createBlankConfiguration("collaborator-journey"),
  buildTemplate: buildCollaboratorTemplate,
  importExcel: importCollaboratorExcel,
  summarize: (data) => [{ label: "Collaborateurs", value: data.collaborators.length }, { label: "Processus", value: data.processes.length }, { label: "Responsabilités", value: data.responsibilities.length }, { label: "Retours", value: data.feedbacks.length }],
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
});

export const verbatimCloudDefinition = defineView({
  id: "verbatim-cloud",
  title: "Nuage de verbatims",
  shortTitle: "Verbatims",
  demoName: "Analyse de verbatims — Démonstration",
  category: "Analyse qualitative",
  catalogGroup: "organisation-experience",
  description: "Faire émerger les dysfonctionnements, besoins et attentes exprimés par les équipes à partir de leurs propres mots.",
  icon: "cloud",
  accent: "violet",
  insights: ["Irritants", "Besoins", "Attentes équipes"],
  component: VerbatimCloudView,
  createEmptyData: createEmptyDataset,
  createDemoData: verbatimDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("verbatim-cloud"),
  createBlankConfiguration: () => createBlankConfiguration("verbatim-cloud"),
  buildTemplate: buildVerbatimTemplate,
  importExcel: importVerbatimExcel,
  summarize: (data) => [{ label: "Verbatims", value: data.verbatims.length }, { label: "Équipes", value: new Set(data.verbatims.map((item) => item.team)).size }, { label: "Catégories", value: new Set(data.verbatims.map((item) => item.category)).size }],
  guide: {
    purpose: "Cette vue transforme des commentaires libres en signaux lisibles. La taille des mots reflète leur fréquence pondérée ; un clic retrouve les verbatims d’origine pour préserver le contexte.",
    questions: ["Quels irritants reviennent le plus souvent ?", "Les besoins diffèrent-ils selon les équipes ?", "Quels verbatims expliquent réellement un signal dominant ?"],
    steps: [
      { title: "Adapter les catégories", description: "Conservez le standard dysfonctionnements, besoins et attentes, ou remplacez-le par votre propre grille d’analyse." },
      { title: "Rassembler les verbatims", description: "Une ligne correspond à un commentaire avec son équipe, sa catégorie, son sentiment et un poids facultatif." },
      { title: "Explorer sans perdre le contexte", description: "Filtrez l’analyse puis sélectionnez un mot pour retrouver les phrases qui le portent." },
    ],
    sheets: [
      { name: "Verbatims", columns: ["id", "verbatim", "categorie", "equipe", "sentiment", "poids"], description: "Les commentaires ou retours terrain à analyser." },
      { name: "Mode d'emploi", columns: ["champ", "règle", "exemple"], description: "Les catégories configurées et les règles de saisie." },
    ],
  },
});

export const posDefinition = defineView({
  id: "pos",
  title: "Cartographie des capacités fonctionnelles",
  shortTitle: "Capacités",
  demoName: "Capacités fonctionnelles — Démonstration",
  category: "Architecture d’entreprise",
  catalogGroup: "enterprise-architecture",
  description: "Lire la couverture fonctionnelle du SI, identifier les fragilités et les capacités non couvertes.",
  icon: "boxes",
  accent: "blue",
  insights: ["Couverture", "Santé applicative", "Maturité"],
  component: CapabilityMapView,
  createEmptyData: createEmptyDataset,
  createDemoData: posDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("pos"),
  createBlankConfiguration: () => createBlankConfiguration("pos"),
  buildTemplate: buildCapabilityTemplate,
  importExcel: importPosExcel,
  summarize: (data) => [{ label: "Capacités", value: data.capabilities.length }, { label: "Applications", value: data.applications.length }],
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
});

export const urbanPosDefinition = defineView({
  id: "urban-pos",
  title: "Plan d’occupation du sol urbain",
  shortTitle: "POS urbain",
  demoName: "POS urbain — Démonstration",
  category: "Urbanisation du SI",
  catalogGroup: "enterprise-architecture",
  description: "Positionner les applications dans un découpage hiérarchique en zones, quartiers et îlots.",
  icon: "map",
  accent: "emerald",
  insights: ["Zones & quartiers", "Îlots applicatifs", "Rationalisation"],
  component: UrbanPosView,
  createEmptyData: createEmptyDataset,
  createDemoData: urbanPosDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("urban-pos"),
  createBlankConfiguration: () => createBlankConfiguration("urban-pos"),
  buildTemplate: buildUrbanPosTemplate,
  importExcel: importUrbanPosExcel,
  summarize: (data) => [{ label: "Zones", value: data.urbanZones.length }, { label: "Quartiers", value: data.urbanDistricts.length }, { label: "Îlots", value: data.urbanBlocks.length }, { label: "Applications", value: data.applications.length }],
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
});

export const urbanisationMaturityDefinition = defineView({
  id: "urbanisation-maturity",
  title: "État de l’urbanisation du SI",
  shortTitle: "Diagnostic urba",
  demoName: "Diagnostic d’urbanisation — Démonstration",
  category: "Pilotage de l’urbanisation",
  catalogGroup: "diagnostic-maturity",
  description: "Comparer l’état actuel, la cible et la couverture cartographique, puis prioriser les écarts à traiter.",
  icon: "radar",
  accent: "blue",
  insights: ["Maturité", "Écarts prioritaires", "Plan d’action"],
  component: UrbanisationRadarView,
  createEmptyData: createEmptyDataset,
  createDemoData: urbanisationDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("urbanisation-maturity"),
  createBlankConfiguration: () => createBlankConfiguration("urbanisation-maturity"),
  buildTemplate: buildRadarTemplate,
  importExcel: importUrbanisationExcel,
  summarize: (data) => [{ label: "Dimensions", value: data.urbanisationIndicators.length }, { label: "Groupes", value: new Set(data.urbanisationIndicators.map((item) => item.group)).size }],
  guide: {
    purpose: "Cette vue transforme une évaluation multicritère en diagnostic actionnable : elle compare le niveau actuel à la cible, mesure la connaissance cartographique et classe les dimensions selon leur écart pondéré.",
    questions: ["Quels écarts d’urbanisation doivent être traités en premier ?", "Sur quels domaines la cible est-elle la moins couverte ?", "Quelles actions, preuves et responsabilités sont associées à chaque dimension ?"],
    steps: [
      { title: "Choisir les dimensions", description: "Ajoutez librement vos critères et regroupez-les selon votre propre modèle d’évaluation." },
      { title: "Évaluer et documenter", description: "Renseignez l’actuel, la cible, la cartographie, le poids, les preuves et l’action attendue." },
      { title: "Importer puis explorer", description: "Filtrez par groupe, composez le radar et ouvrez le détail des écarts prioritaires." },
    ],
    sheets: [
      { name: "Diagnostic", columns: ["dimension", "groupe", "niveau_actuel", "objectif", "niveau_cartographie", "poids", "responsable", "preuve", "action"], description: "Les dimensions libres du diagnostic, leurs scores et les informations nécessaires au plan d’action." },
      { name: "Mode d'emploi", columns: ["champ", "règle", "exemple"], description: "Les règles de saisie du modèle et l’échelle de notation recommandée." },
    ],
  },
});

export const siLayersDefinition = defineView({
  id: "si-layers",
  title: "Cartographie du SI par couches",
  shortTitle: "SI par couches",
  demoName: "SI par couches — Démonstration",
  category: "Architecture d’entreprise",
  catalogGroup: "enterprise-architecture",
  description: "Relier métier, données, applications et technologies sans transformer la lecture en graphe illisible.",
  icon: "layers",
  accent: "violet",
  insights: ["Alignement vertical", "Dépendances", "Transformation"],
  component: SILayersView,
  createEmptyData: createEmptyDataset,
  createDemoData: siLayersDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("si-layers"),
  createBlankConfiguration: () => createBlankConfiguration("si-layers"),
  buildTemplate: buildLayersTemplate,
  importExcel: importSILayersExcel,
  summarize: (data) => [{ label: "Éléments", value: data.architectureElements.length }, { label: "Relations", value: data.architectureRelations.length }, { label: "Domaines", value: new Set(data.architectureElements.map((item) => item.domain)).size }],
  guide: {
    purpose: "Cette vue aligne les objets métier, données, applications et technologies dans quatre bandes stables. La sélection d’un élément révèle uniquement sa chaîne de dépendances, ses responsabilités et son statut de transformation.",
    questions: ["Quelles applications et technologies soutiennent une capacité métier ?", "Quels objets critiques sont isolés ou sans responsable ?", "Où les transformations se propagent-elles entre les couches ?"],
    steps: [
      { title: "Décrire les éléments", description: "Classez chaque objet dans une couche, un domaine et un statut d’architecture." },
      { title: "Relier les couches", description: "Ajoutez des relations explicites entre les identifiants, dans le sens qui convient à votre modèle." },
      { title: "Explorer les impacts", description: "Filtrez par domaine puis sélectionnez un élément pour isoler ses dépendances directes." },
    ],
    sheets: [
      { name: "Elements", columns: ["id", "nom", "couche", "domaine", "statut", "criticite", "responsable", "description"], description: "Tous les objets d’architecture à positionner." },
      { name: "Relations", columns: ["id", "source_id", "cible_id", "relation"], description: "Les dépendances entre deux objets existants." },
      { name: "Mode d'emploi", columns: ["champ", "règle", "exemple"], description: "Les valeurs autorisées et règles de saisie." },
    ],
  },
});

export const togafTrackingDefinition = defineView({
  id: "togaf-tracking",
  title: "TOGAF ADM",
  shortTitle: "TOGAF ADM",
  demoName: "TOGAF ADM — Démonstration",
  category: "Gouvernance d’architecture",
  catalogGroup: "transformation-governance",
  description: "Visualiser le cycle TOGAF ADM et piloter ses phases, gates, livrables, décisions et risques.",
  icon: "route",
  accent: "emerald",
  insights: ["Gates", "Décisions", "Risques & livrables"],
  component: TogafTrackingView,
  createEmptyData: createEmptyDataset,
  createDemoData: togafDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("togaf-tracking"),
  createBlankConfiguration: () => createBlankConfiguration("togaf-tracking"),
  buildTemplate: buildTogafTemplate,
  importExcel: importTogafExcel,
  summarize: (data) => [{ label: "Phases", value: data.togafPhases.length }, { label: "Éléments", value: data.togafItems.length }, { label: "Bloquants", value: data.togafItems.filter((item) => item.status === "Bloqué").length }],
  guide: {
    purpose: "Ce cockpit utilise les phases TOGAF comme structure de pilotage, mais se concentre sur ce qui permet de décider : avancement, gate attendu, livrables, décisions ouvertes, risques et blocages.",
    questions: ["Quelle phase est réellement prête à franchir son gate ?", "Quelles décisions et preuves manquent avant validation ?", "Quels risques menacent la trajectoire et qui doit agir ?"],
    steps: [
      { title: "Planifier les phases", description: "Renseignez le statut, l’avancement, le responsable, la fenêtre et le gate attendu." },
      { title: "Lister les éléments", description: "Rattachez chaque livrable, décision, risque ou action à une phase." },
      { title: "Piloter les gates", description: "Ouvrez une phase pour vérifier les éléments attendus et traiter les alertes transverses." },
    ],
    sheets: [
      { name: "Phases", columns: ["id", "code", "nom", "statut", "avancement", "responsable", "date_debut", "date_cible", "objectif", "gate"], description: "Le séquencement et la gouvernance du cycle d’architecture." },
      { name: "Elements", columns: ["id", "phase_id", "nom", "type", "statut", "responsable", "date_cible", "detail"], description: "Les objets concrets à produire, décider ou sécuriser." },
      { name: "Mode d'emploi", columns: ["champ", "règle", "exemple"], description: "Les valeurs autorisées et règles de saisie." },
    ],
  },
});

export const viewRegistry = new ViewRegistry().registerMany([collaboratorJourneyDefinition, verbatimCloudDefinition, posDefinition, urbanPosDefinition, urbanisationMaturityDefinition, siLayersDefinition, togafTrackingDefinition]);
