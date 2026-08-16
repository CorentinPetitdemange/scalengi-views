import { CollaboratorJourneyView } from "./CollaboratorJourneyView";
import { buildCollaboratorTemplate, buildLayersTemplate, buildMetamodelTemplate, buildPartitionTemplate, buildRadarTemplate, buildTogafTemplate, buildVerbatimTemplate, createBlankConfiguration, createDefaultConfiguration } from "./builtin-configurations";
import { importCollaboratorExcel, importMetamodelExcel, importPartitionExcel, importSILayersExcel, importTogafExcel, importUrbanisationExcel, importVerbatimExcel } from "./excel-import";
import { createEmptyDataset, datasetWith } from "./dataset";
import { sampleDataset } from "./sample-data";
import { PartitionView } from "./PartitionView";
import { capabilityPartitionData, createBlankPartitionConfiguration, createCapabilityPartitionConfiguration, createUrbanPartitionConfiguration } from "./partition-model";
import { SILayersView } from "./SILayersView";
import { SIMetamodelView } from "./SIMetamodelView";
import { TogafTrackingView } from "./TogafTrackingView";
import { UrbanisationRadarView } from "./UrbanisationRadarView";
import { VerbatimCloudView } from "./VerbatimCloudView";
import { defineView, ViewRegistry } from "./view-registry";

const collaboratorDemo = () => datasetWith({ collaborators: structuredClone(sampleDataset.collaborators), processes: structuredClone(sampleDataset.processes), responsibilities: structuredClone(sampleDataset.responsibilities), feedbacks: structuredClone(sampleDataset.feedbacks) });
const partitionDemo = () => capabilityPartitionData(sampleDataset);
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

export const partitionViewDefinition = defineView({
  id: "partition-view",
  title: "Vue en découpage",
  shortTitle: "Découpage",
  demoName: "Capacités fonctionnelles — Démonstration",
  category: "Architecture d’entreprise",
  catalogGroup: "enterprise-architecture",
  description: "Organiser librement des éléments en niveaux, groupes et sous-groupes, avec leurs informations et relations.",
  icon: "boxes",
  accent: "blue",
  insights: ["Découpage libre", "Niveaux configurables", "Relations"],
  component: PartitionView,
  createEmptyData: createEmptyDataset,
  createDemoData: partitionDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("partition-view"),
  createBlankConfiguration: createBlankPartitionConfiguration,
  presets: [
    { id: "capabilities", title: "Capacités fonctionnelles", description: "Domaines, capacités, maturité et couverture applicative.", createConfiguration: createCapabilityPartitionConfiguration },
    { id: "urban-pos", title: "POS urbain", description: "Zones, quartiers, îlots et applications dans une hiérarchie libre.", createConfiguration: createUrbanPartitionConfiguration },
    { id: "blank", title: "Structure vierge", description: "Commencer sans niveau ni information prédéfinis.", createConfiguration: createBlankPartitionConfiguration },
  ],
  buildTemplate: buildPartitionTemplate,
  importExcel: importPartitionExcel,
  summarize: (data) => [{ label: "Éléments", value: data.partitionItems.length }, { label: "Niveaux", value: new Set(data.partitionItems.map((item) => item.levelId)).size }, { label: "Relations", value: data.partitionRelations.length }],
  guide: {
    purpose: "Cette vue répartit les objets dans un découpage défini par l’architecte. Les niveaux, informations, statuts et relations viennent de la configuration de l’instance, pas du moteur.",
    questions: ["Comment le périmètre est-il découpé ?", "Quels éléments composent chaque niveau ?", "Quelles informations ou relations appellent une décision ?"],
    steps: [
      { title: "Définir les niveaux", description: "Partez d’un exemple ou créez librement les niveaux, leur parent et leur mode d’affichage." },
      { title: "Définir les informations", description: "Ajoutez les attributs, statuts et couleurs utiles à la lecture de vos cartes." },
      { title: "Importer les éléments", description: "Le classeur généré contient exactement les niveaux et colonnes de cette instance." },
    ],
    sheets: [
      { name: "Elements", columns: ["id", "nom", "niveau", "parent_id", "description", "attributs configurés"], description: "Les objets, leur niveau et leur position dans le découpage." },
      { name: "Relations", columns: ["id", "source_id", "cible_id", "type"], description: "Les relations facultatives entre objets." },
      { name: "Mode d'emploi", columns: ["champ", "règle", "exemple"], description: "Les niveaux et règles produits depuis la structure." },
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
  title: "Analyse d’impact du SI par couches",
  shortTitle: "SI par couches",
  demoName: "SI par couches — Démonstration",
  category: "Architecture d’entreprise",
  catalogGroup: "enterprise-architecture",
  description: "Partir d’un objet et isoler ses impacts entrants et sortants à travers les couches métier, données, applications et technologies.",
  icon: "layers",
  accent: "violet",
  insights: ["Analyse d’impact", "Dépendances critiques", "Propagation inter-couches"],
  component: SILayersView,
  createEmptyData: createEmptyDataset,
  createDemoData: siLayersDemo,
  createDefaultConfiguration: () => createDefaultConfiguration("si-layers"),
  createBlankConfiguration: () => createBlankConfiguration("si-layers"),
  buildTemplate: buildLayersTemplate,
  importExcel: importSILayersExcel,
  summarize: (data) => [{ label: "Éléments", value: data.architectureElements.length }, { label: "Relations", value: data.architectureRelations.length }, { label: "Domaines", value: new Set(data.architectureElements.map((item) => item.domain)).size }],
  guide: {
    purpose: "Cette vue sert à analyser un changement ou un incident : elle isole autour d’un point focal les dépendances entrantes et sortantes, leur profondeur, leur criticité et leur propagation entre les couches.",
    questions: ["Quels objets peuvent affecter cet élément ?", "Quels objets risquent d’être affectés si celui-ci change ?", "À quelle profondeur et dans quelles couches l’impact se propage-t-il ?"],
    steps: [
      { title: "Décrire les éléments", description: "Classez chaque objet dans une couche, un domaine et un statut d’architecture." },
      { title: "Relier les couches", description: "Ajoutez des relations explicites entre les identifiants, dans le sens qui convient à votre modèle." },
      { title: "Explorer les impacts", description: "Sélectionnez un point focal, choisissez le sens entrant ou sortant et augmentez la profondeur pour suivre la propagation." },
    ],
    sheets: [
      { name: "Elements", columns: ["id", "nom", "couche", "domaine", "statut", "criticite", "responsable", "description"], description: "Tous les objets d’architecture à positionner." },
      { name: "Relations", columns: ["id", "source_id", "cible_id", "relation"], description: "Les dépendances entre deux objets existants." },
      { name: "Mode d'emploi", columns: ["champ", "règle", "exemple"], description: "Les valeurs autorisées et règles de saisie." },
    ],
  },
});

export const siMetamodelDefinition = defineView({
  id: "si-metamodel",
  title: "Métamodèle du SI",
  shortTitle: "Métamodèle SI",
  demoName: "Métamodèle du SI — Démonstration",
  category: "Architecture d’entreprise",
  catalogGroup: "enterprise-architecture",
  description: "Définir la grammaire du référentiel : couches, types d’objets, relations autorisées et cardinalités.",
  icon: "network",
  accent: "blue",
  insights: ["Concepts", "Relations autorisées", "Cardinalités"],
  component: SIMetamodelView,
  createEmptyData: createEmptyDataset,
  createDemoData: createEmptyDataset,
  createDefaultConfiguration: () => createDefaultConfiguration("si-metamodel"),
  createBlankConfiguration: () => createBlankConfiguration("si-metamodel"),
  buildTemplate: buildMetamodelTemplate,
  importExcel: importMetamodelExcel,
  summarize: (_data, configuration) => [{ label: "Couches", value: configuration?.sections.find((section) => section.id === "layers")?.items.length ?? 0 }, { label: "Types d’objets", value: configuration?.sections.find((section) => section.id === "objectTypes")?.items.length ?? 0 }, { label: "Relations", value: configuration?.sections.find((section) => section.id === "relationTypes")?.items.length ?? 0 }],
  guide: {
    purpose: "Cette vue décrit les règles du référentiel, pas son contenu : quels types d’objets existent, dans quelles couches ils se placent et quelles relations peuvent les relier.",
    questions: ["Quels concepts composent notre langage d’architecture ?", "Quelles relations et cardinalités sont autorisées ?", "Notre métamodèle couvre-t-il toutes les couches utiles sans doublon ?"],
    steps: [
      { title: "Définir les couches", description: "Organisez visuellement le langage d’architecture selon vos propres couches." },
      { title: "Définir les types", description: "Documentez chaque concept et rattachez-le à une couche." },
      { title: "Définir la grammaire", description: "Reliez les types, nommez les relations et précisez leurs cardinalités." },
    ],
    sheets: [
      { name: "Couches", columns: ["id", "libelle", "description", "couleur"], description: "Les colonnes visuelles du métamodèle." },
      { name: "TypesObjets", columns: ["id", "libelle", "couche_id", "description", "couleur"], description: "Les concepts disponibles dans le référentiel." },
      { name: "Relations", columns: ["id", "libelle", "source_type_id", "cible_type_id", "cardinalite_source", "cardinalite_cible", "description"], description: "Les liens autorisés entre concepts." },
      { name: "Mode d'emploi", columns: ["champ", "règle", "exemple"], description: "Les règles de référence entre les feuilles." },
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

export const viewRegistry = new ViewRegistry().registerMany([collaboratorJourneyDefinition, verbatimCloudDefinition, partitionViewDefinition, urbanisationMaturityDefinition, siLayersDefinition, siMetamodelDefinition, togafTrackingDefinition]);
