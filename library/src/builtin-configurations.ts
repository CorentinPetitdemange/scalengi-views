import { blankConfiguration, sectionOf, type ConfigurationItem, type ViewConfiguration, type WorkbookTemplateSpec } from "./configuration";
import { sampleDataset } from "./sample-data";

const text = (key: string, label: string, required = true, readonly = false) => ({ key, label, type: "text" as const, required, readonly });
const textarea = (key: string, label: string) => ({ key, label, type: "textarea" as const });
const number = (key: string, label: string) => ({ key, label, type: "number" as const });
const color = (key = "color", label = "Couleur") => ({ key, label, type: "color" as const });
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const itemLabels = (configuration: ViewConfiguration, sectionId: string, field = "label") => configuration.sections.find((section) => section.id === sectionId)?.items.map((item) => String(item[field] ?? item.id)).filter(Boolean) ?? [];
const itemById = (configuration: ViewConfiguration, sectionId: string, id: string) => configuration.sections.find((section) => section.id === sectionId)?.items.find((item) => item.id === id);
const guide = (description: string) => ({ name: "Mode d'emploi", description, columns: [{ key: "champ", label: "champ", width: 24 }, { key: "regle", label: "règle", width: 70 }, { key: "exemple", label: "exemple", width: 34 }] });

const collaboratorStandard = (): ViewConfiguration => ({
  version: 1, viewType: "collaborator-journey", label: "Galaxie de collaboration standard", options: { centerLabel: "Collaborateur", radius: 400 },
  sections: [{ id: "galaxies", title: "Galaxies visibles", description: "Les couronnes et informations que la vue peut afficher autour du collaborateur.", itemLabel: "galaxie", minItems: 1, fields: [text("id", "Identifiant", true, true), text("label", "Libellé"), textarea("description", "Description"), color()], items: [
    { id: "processes", label: "Processus", description: "Processus auxquels la personne contribue.", color: "#2563eb" },
    { id: "roles", label: "Responsabilités", description: "Rôle tenu sur chaque processus.", color: "#7c3aed" },
    { id: "colleagues", label: "Collaborateurs liés", description: "Personnes partageant les mêmes processus.", color: "#059669" },
    { id: "feedbacks", label: "Retours", description: "Retours associés aux processus.", color: "#d97706" },
  ] }],
});

const capabilityStandard = (): ViewConfiguration => ({
  version: 1, viewType: "pos", label: "Capacités fonctionnelles standard", options: { maturityMax: 5 },
  sections: [
    { id: "domains", title: "Domaines fonctionnels", description: "Colonnes qui structurent la cartographie des capacités.", itemLabel: "domaine", minItems: 1, fields: [text("id", "Identifiant"), text("label", "Libellé"), textarea("description", "Description"), color()], items: unique(sampleDataset.capabilities.map((item) => item.domain)).map((label, index) => ({ id: label, label, description: "", color: ["#2563eb", "#7c3aed", "#059669", "#d97706"][index % 4] })) },
    { id: "criticalities", title: "Niveaux de criticité", description: "Vocabulaire autorisé pour qualifier une capacité.", itemLabel: "niveau", minItems: 1, fields: [text("id", "Valeur"), text("label", "Libellé")], items: ["Faible", "Moyenne", "Forte"].map((label) => ({ id: label, label })) },
  ],
});

const urbanPosStandard = (): ViewConfiguration => ({
  version: 1, viewType: "urban-pos", label: "POS urbain standard", options: {},
  sections: [
    { id: "levels", title: "Niveaux du POS", description: "Les quatre niveaux hiérarchiques du moteur POS peuvent être renommés.", itemLabel: "niveau", minItems: 4, maxItems: 4, fields: [text("id", "Identifiant technique", true, true), text("label", "Libellé singulier"), text("plural", "Libellé pluriel"), text("sheet", "Feuille Excel")], items: [
      { id: "zone", label: "Zone", plural: "Zones", sheet: "Zones" }, { id: "district", label: "Quartier", plural: "Quartiers", sheet: "Quartiers" }, { id: "block", label: "Îlot", plural: "Îlots", sheet: "Ilots" }, { id: "application", label: "Application", plural: "Applications", sheet: "Applications" },
    ] },
    { id: "blockStatuses", title: "Statuts d’urbanisation", description: "Statuts autorisés pour le troisième niveau.", itemLabel: "statut", minItems: 1, fields: [text("id", "Valeur"), text("label", "Libellé")], items: ["Cible", "À rationaliser", "À construire"].map((label) => ({ id: label, label })) },
  ],
});

const radarStandard = (): ViewConfiguration => ({
  version: 1, viewType: "urbanisation-maturity", label: "Diagnostic d’urbanisation standard", options: { scoreMin: 0, scoreMax: 5, priorityCount: 10 },
  sections: [{ id: "axes", title: "Axes du radar", description: "Chaque ligne devient un axe du diagnostic et une ligne préremplie du modèle Excel.", itemLabel: "axe", minItems: 3, fields: [text("id", "Identifiant"), text("label", "Libellé"), text("group", "Groupe"), number("target", "Objectif"), number("weight", "Poids")], items: sampleDataset.urbanisationIndicators.map((item) => ({ id: item.id, label: item.label, group: item.group, target: item.target, weight: item.weight })) }],
});

const layersStandard = (): ViewConfiguration => ({
  version: 1, viewType: "si-layers", label: "Architecture en quatre couches", options: {},
  sections: [
    { id: "layers", title: "Couches du SI", description: "Bandes horizontales utilisées pour organiser les objets d’architecture.", itemLabel: "couche", minItems: 1, fields: [text("id", "Valeur"), text("label", "Libellé"), textarea("description", "Description"), color()], items: [
      { id: "Métier", label: "Métier", description: "Ce que l’organisation doit savoir faire", color: "#7c3aed" }, { id: "Données", label: "Données", description: "Les objets d’information structurants", color: "#0284c7" }, { id: "Applications", label: "Applications", description: "Les solutions qui réalisent les capacités", color: "#059669" }, { id: "Technologies", label: "Technologies", description: "Les socles qui exécutent et relient le SI", color: "#d97706" },
    ] },
    { id: "statuses", title: "Statuts d’architecture", description: "Vocabulaire des décisions de trajectoire.", itemLabel: "statut", minItems: 1, fields: [text("id", "Valeur"), text("label", "Libellé")], items: ["Cible", "À renforcer", "À transformer", "À retirer"].map((label) => ({ id: label, label })) },
    { id: "criticalities", title: "Niveaux de criticité", description: "Vocabulaire de criticité des objets.", itemLabel: "niveau", minItems: 1, fields: [text("id", "Valeur"), text("label", "Libellé")], items: ["Faible", "Moyenne", "Forte"].map((label) => ({ id: label, label })) },
  ],
});

const togafStandard = (): ViewConfiguration => ({
  version: 1, viewType: "togaf-tracking", label: "TOGAF ADM standard", options: {},
  sections: [
    { id: "phases", title: "Phases TOGAF ADM", description: "Phase préliminaire puis cycle A à H ; la gestion des exigences est représentée au centre.", itemLabel: "phase", minItems: 1, fields: [text("id", "Identifiant"), text("code", "Code"), text("label", "Nom"), textarea("objective", "Objectif"), textarea("gate", "Gate attendu")], items: sampleDataset.togafPhases.map((phase) => ({ id: phase.id, code: phase.code, label: phase.name, objective: phase.objective, gate: phase.gate })) },
    { id: "itemTypes", title: "Types d’éléments", description: "Objets suivis pour décider du passage des gates.", itemLabel: "type", minItems: 1, fields: [text("id", "Valeur"), text("label", "Libellé")], items: ["Livrable", "Décision", "Risque", "Action"].map((label) => ({ id: label, label })) },
  ],
});

const verbatimStandard = (): ViewConfiguration => ({
  version: 1,
  viewType: "verbatim-cloud",
  label: "Analyse de verbatims standard",
  options: { minWordLength: 4, maxWords: 45, cloudShape: "cloud" },
  sections: [
    {
      id: "categories", title: "Catégories d’analyse", description: "Angles utilisés pour classer et filtrer les verbatims.", itemLabel: "catégorie", minItems: 1,
      fields: [text("id", "Identifiant"), text("label", "Libellé"), textarea("description", "Description"), color()],
      items: [
        { id: "dysfunctions", label: "Dysfonctionnements", description: "Irritants, blocages et pertes de temps constatés.", color: "#dc2626" },
        { id: "needs", label: "Besoins", description: "Moyens, informations ou capacités nécessaires.", color: "#2563eb" },
        { id: "expectations", label: "Attentes", description: "Résultats et améliorations souhaités par les équipes.", color: "#7c3aed" },
      ],
    },
    {
      id: "stopWords", title: "Mots ignorés", description: "Mots courants exclus du nuage pour faire ressortir les termes utiles.", itemLabel: "mot", fields: [text("id", "Identifiant", true, true), text("word", "Mot")],
      items: ["avec", "avoir", "avons", "cette", "chaque", "comme", "dans", "elle", "elles", "entre", "être", "faire", "leur", "leurs", "mais", "même", "nous", "notre", "pour", "plus", "plusieurs", "quand", "sans", "sont", "tout", "tous", "très", "trop", "une", "vous"].map((word) => ({ id: word.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), word })),
    },
  ],
});

const standardFactories: Record<string, () => ViewConfiguration> = { "collaborator-journey": collaboratorStandard, "verbatim-cloud": verbatimStandard, pos: capabilityStandard, "urban-pos": urbanPosStandard, "urbanisation-maturity": radarStandard, "si-layers": layersStandard, "togaf-tracking": togafStandard };
export const createDefaultConfiguration = (viewType: string) => structuredClone(standardFactories[viewType]?.() ?? { version: 1, viewType, label: "Structure standard", sections: [], options: {} });
export const createBlankConfiguration = (viewType: string) => blankConfiguration(createDefaultConfiguration(viewType));

export function buildCollaboratorTemplate(configuration: ViewConfiguration): WorkbookTemplateSpec {
  const galaxies = itemLabels(configuration, "galaxies");
  return { filename: "modele-vue-collaborateurs.xlsx", viewTitle: "Vue Collaborateurs", sheets: [
    { name: "Collaborateurs", description: "Personnes représentées.", columns: [{ key: "id", label: "id", width: 18 }, { key: "nom", label: "nom", width: 28 }, { key: "fonction", label: "fonction", width: 30 }, { key: "initiales", label: "initiales", width: 14 }] },
    { name: "Processus", description: "Processus à afficher.", columns: [{ key: "id", label: "id", width: 18 }, { key: "nom", label: "nom", width: 34 }, { key: "statut", label: "statut", width: 22, values: ["Actif", "À revoir", "En transformation"] }] },
    { name: "Responsabilites", description: "Rôles tenus dans les processus.", columns: [{ key: "id", label: "id", width: 18 }, { key: "collaborateur_id", label: "collaborateur_id", width: 24 }, { key: "processus_id", label: "processus_id", width: 22 }, { key: "role", label: "role", width: 20, values: ["Pilote", "Contributeur", "Validation", "Consulté"] }] },
    { name: "Retours", description: "Retours associés aux processus.", columns: [{ key: "id", label: "id", width: 18 }, { key: "processus_id", label: "processus_id", width: 22 }, { key: "element_id", label: "element_id", width: 20 }, { key: "contenu", label: "contenu", width: 56 }, { key: "date_creation", label: "date_creation", width: 18, type: "date" }] },
    { ...guide(`Galaxies configurées : ${galaxies.join(", ") || "aucune"}`), rows: [["identifiants", "Utilisez des identifiants stables pour relier les feuilles.", "collab-001"], ["galaxies", "La structure de la vue est pilotée séparément par son YAML.", galaxies.join(", ")]] },
  ] };
}

export function buildCapabilityTemplate(configuration: ViewConfiguration): WorkbookTemplateSpec {
  const domains = itemLabels(configuration, "domains", "id"); const criticalities = itemLabels(configuration, "criticalities", "id");
  return { filename: "modele-vue-capacites.xlsx", viewTitle: "Capacités fonctionnelles", sheets: [
    { name: "Capacites", description: "Capacités organisées selon les domaines configurés.", columns: [{ key: "id", label: "id", width: 18 }, { key: "nom", label: "nom", width: 34 }, { key: "domaine", label: "domaine", width: 28, values: domains }, { key: "maturite", label: "maturite", width: 14, type: "number" }, { key: "criticite", label: "criticite", width: 18, values: criticalities }, { key: "responsable", label: "responsable", width: 30 }], rows: domains.map((domain, index) => [`capacite-${index + 1}`, "", domain, 0, criticalities[0] ?? "", ""]) },
    { name: "Applications", description: "Patrimoine applicatif utile à cette analyse.", columns: [{ key: "id", label: "id", width: 18 }, { key: "nom", label: "nom", width: 32 }, { key: "sante", label: "sante", width: 18, values: ["Sain", "À surveiller", "Critique"] }, { key: "cycle_de_vie", label: "cycle_de_vie", width: 18, values: ["Investir", "Maintenir", "Migrer", "Retirer"] }] },
    { name: "Couverture", description: "Liens entre capacités et applications.", columns: [{ key: "capacite_id", label: "capacite_id", width: 24 }, { key: "application_id", label: "application_id", width: 24 }] },
    { ...guide("Les domaines et criticités viennent de la structure de cette instance."), rows: [["domaines", "Valeurs autorisées dans Capacites.domaine.", domains.join(", ")], ["criticités", "Valeurs autorisées dans Capacites.criticite.", criticalities.join(", ")]] },
  ] };
}

export function buildUrbanPosTemplate(configuration: ViewConfiguration): WorkbookTemplateSpec {
  const zone = itemById(configuration, "levels", "zone") ?? { id: "zone", sheet: "Zones", label: "Zone" } as ConfigurationItem;
  const district = itemById(configuration, "levels", "district") ?? { id: "district", sheet: "Quartiers", label: "Quartier" } as ConfigurationItem;
  const block = itemById(configuration, "levels", "block") ?? { id: "block", sheet: "Ilots", label: "Îlot" } as ConfigurationItem;
  const application = itemById(configuration, "levels", "application") ?? { id: "application", sheet: "Applications", label: "Application" } as ConfigurationItem;
  const statuses = itemLabels(configuration, "blockStatuses", "id");
  return { filename: "modele-pos-urbain.xlsx", viewTitle: "Plan d’occupation du sol", sheets: [
    { name: String(zone.sheet), description: `Niveau ${zone.label}.`, columns: [{ key: "id", label: "id", width: 18 }, { key: "nom", label: "nom", width: 32 }, { key: "description", label: "description", width: 56 }] },
    { name: String(district.sheet), description: `Niveau ${district.label}.`, columns: [{ key: "id", label: "id", width: 18 }, { key: "nom", label: "nom", width: 32 }, { key: "zone_id", label: "zone_id", width: 20 }, { key: "description", label: "description", width: 56 }] },
    { name: String(block.sheet), description: `Niveau ${block.label}.`, columns: [{ key: "id", label: "id", width: 18 }, { key: "nom", label: "nom", width: 32 }, { key: "quartier_id", label: "quartier_id", width: 22 }, { key: "statut", label: "statut", width: 22, values: statuses }, { key: "responsable", label: "responsable", width: 30 }] },
    { name: String(application.sheet), description: `Niveau ${application.label}.`, columns: [{ key: "id", label: "id", width: 18 }, { key: "nom", label: "nom", width: 32 }, { key: "ilot_id", label: "ilot_id", width: 20 }, { key: "sante", label: "sante", width: 18, values: ["Sain", "À surveiller", "Critique"] }, { key: "cycle_de_vie", label: "cycle_de_vie", width: 18, values: ["Investir", "Maintenir", "Migrer", "Retirer"] }] },
    { ...guide("Les noms de feuilles et libellés de niveaux suivent la structure de cette instance."), rows: [["niveaux", "Les quatre niveaux sont configurables avant l’import.", [zone.label, district.label, block.label, application.label].join(" > ")], ["statuts", "Valeurs autorisées pour le troisième niveau.", statuses.join(", ")]] },
  ] };
}

export function buildRadarTemplate(configuration: ViewConfiguration): WorkbookTemplateSpec {
  const axes = configuration.sections.find((section) => section.id === "axes")?.items ?? [];
  return { filename: "modele-diagnostic-urbanisation.xlsx", viewTitle: "Diagnostic configurable", sheets: [
    { name: "Diagnostic", description: "Une ligne par axe configuré.", columns: [{ key: "id", label: "id", width: 22 }, { key: "dimension", label: "dimension", width: 46 }, { key: "groupe", label: "groupe", width: 28 }, { key: "niveau_actuel", label: "niveau_actuel", width: 18, type: "number" }, { key: "objectif", label: "objectif", width: 14, type: "number" }, { key: "niveau_cartographie", label: "niveau_cartographie", width: 23, type: "number" }, { key: "poids", label: "poids", width: 12, type: "number" }, { key: "responsable", label: "responsable", width: 28 }, { key: "preuve", label: "preuve", width: 46 }, { key: "action", label: "action", width: 52 }], rows: axes.map((axis) => [axis.id, axis.label, axis.group, 0, Number(axis.target ?? 0), 0, Number(axis.weight ?? 1), "", "", ""]) },
    { ...guide("Les axes sont préremplis depuis la structure. Complétez uniquement les scores et informations de pilotage."), rows: [["niveau_actuel", "Score compris entre le minimum et le maximum configurés.", Number(configuration.options.scoreMin ?? 0)], ["axes", "Ne modifiez les identifiants que depuis l’écran Structure.", `${axes.length} axes préremplis`]] },
  ] };
}

export function buildLayersTemplate(configuration: ViewConfiguration): WorkbookTemplateSpec {
  const layers = itemLabels(configuration, "layers", "id"); const statuses = itemLabels(configuration, "statuses", "id"); const criticalities = itemLabels(configuration, "criticalities", "id");
  return { filename: "modele-si-par-couches.xlsx", viewTitle: "SI par couches", sheets: [
    { name: "Elements", description: "Objets positionnés dans les couches configurées.", columns: [{ key: "id", label: "id", width: 20 }, { key: "nom", label: "nom", width: 32 }, { key: "couche", label: "couche", width: 20, values: layers }, { key: "domaine", label: "domaine", width: 26 }, { key: "statut", label: "statut", width: 20, values: statuses }, { key: "criticite", label: "criticite", width: 16, values: criticalities }, { key: "responsable", label: "responsable", width: 28 }, { key: "description", label: "description", width: 54 }] },
    { name: "Relations", description: "Dépendances entre objets.", columns: [{ key: "id", label: "id", width: 18 }, { key: "source_id", label: "source_id", width: 24 }, { key: "cible_id", label: "cible_id", width: 24 }, { key: "relation", label: "relation", width: 34 }] },
    { ...guide("Les listes de couches, statuts et criticités proviennent de la configuration YAML."), rows: [["couches", "Valeurs autorisées dans Elements.couche.", layers.join(", ")], ["statuts", "Valeurs autorisées dans Elements.statut.", statuses.join(", ")]] },
  ] };
}

export function buildTogafTemplate(configuration: ViewConfiguration): WorkbookTemplateSpec {
  const phases = configuration.sections.find((section) => section.id === "phases")?.items ?? []; const itemTypes = itemLabels(configuration, "itemTypes", "id");
  return { filename: "modele-togaf-adm.xlsx", viewTitle: "TOGAF ADM", sheets: [
    { name: "Phases", description: "Phases préremplies depuis la structure.", columns: [{ key: "id", label: "id", width: 14 }, { key: "code", label: "code", width: 12 }, { key: "nom", label: "nom", width: 30 }, { key: "statut", label: "statut", width: 18, values: ["À démarrer", "En cours", "À valider", "Validée", "Bloquée"] }, { key: "avancement", label: "avancement", width: 16, type: "number" }, { key: "responsable", label: "responsable", width: 28 }, { key: "date_debut", label: "date_debut", width: 16, type: "date" }, { key: "date_cible", label: "date_cible", width: 16, type: "date" }, { key: "objectif", label: "objectif", width: 52 }, { key: "gate", label: "gate", width: 44 }], rows: phases.map((phase) => [phase.id, phase.code, phase.label, "À démarrer", 0, "", null, null, phase.objective, phase.gate]) },
    { name: "Elements", description: "Éléments de suivi rattachés aux phases configurées.", columns: [{ key: "id", label: "id", width: 18 }, { key: "phase_id", label: "phase_id", width: 16, values: phases.map((phase) => phase.id) }, { key: "nom", label: "nom", width: 40 }, { key: "type", label: "type", width: 16, values: itemTypes }, { key: "statut", label: "statut", width: 18, values: ["À faire", "En cours", "À valider", "Validé", "Bloqué"] }, { key: "responsable", label: "responsable", width: 28 }, { key: "date_cible", label: "date_cible", width: 16, type: "date" }, { key: "detail", label: "detail", width: 56 }] },
    { ...guide("Les phases et types d’éléments proviennent de la structure de cette instance."), rows: [["phases", "Identifiants autorisés dans Elements.phase_id.", phases.map((phase) => phase.id).join(", ")], ["types", "Valeurs autorisées dans Elements.type.", itemTypes.join(", ")]] },
  ] };
}

export function buildVerbatimTemplate(configuration: ViewConfiguration): WorkbookTemplateSpec {
  const categories = sectionOf(configuration, "categories")?.items ?? [];
  const categoryLabels = categories.map((item) => String(item.label ?? item.id));
  return { filename: "modele-analyse-verbatims.xlsx", viewTitle: "Nuage de verbatims", sheets: [
    { name: "Verbatims", description: "Une ligne par commentaire, retour terrain ou expression de besoin.", columns: [
      { key: "id", label: "id", width: 18 },
      { key: "verbatim", label: "verbatim", width: 72 },
      { key: "categorie", label: "categorie", width: 24, values: categoryLabels },
      { key: "equipe", label: "equipe", width: 28 },
      { key: "sentiment", label: "sentiment", width: 16, values: ["Positif", "Neutre", "Négatif"] },
      { key: "poids", label: "poids", width: 12, type: "number" },
    ] },
    { ...guide("Les catégories viennent de la structure YAML. Le poids permet de renforcer un verbatim particulièrement représentatif."), rows: [
      ["categorie", "Utilisez un libellé ou un identifiant défini dans la structure.", categoryLabels[0] ?? ""],
      ["poids", "Nombre supérieur à 0 et inférieur ou égal à 10.", 1],
    ] },
  ] };
}
