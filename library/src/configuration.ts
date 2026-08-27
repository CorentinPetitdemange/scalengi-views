import { parse, stringify } from "yaml";
import type { ViewDataset } from "./types";

export const MAX_YAML_BYTES = 256_000;
const MAX_SECTIONS = 32;
const MAX_FIELDS_PER_SECTION = 64;
const MAX_ITEMS_PER_SECTION = 2_000;
const MAX_OPTIONS = 64;
const MAX_TEXT_LENGTH = 10_000;
const MAX_EXAMPLE_ITEMS_PER_COLLECTION = 25_000;
const exampleDataCollectionKeys = [
  "collaborators", "processes", "responsibilities", "feedbacks", "applications", "capabilities",
  "urbanZones", "urbanDistricts", "urbanBlocks", "urbanisationIndicators", "architectureElements",
  "architectureRelations", "togafPhases", "togafItems", "verbatims",
  "partitionItems", "partitionRelations",
] as const satisfies ReadonlyArray<keyof ViewDataset>;
const safeKeyPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

export type ConfigurationScalar = string | number | boolean;

export interface ConfigurationField {
  key: string;
  label: string;
  type: "text" | "number" | "color" | "textarea" | "select";
  choices?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  readonly?: boolean;
  defaultValue?: ConfigurationScalar;
  /** La valeur saisie doit être un identifiant technique sûr. */
  identifier?: boolean;
  /** Affiche le champ guidé uniquement lorsque l’élément possède cette valeur. */
  visibleWhen?: { key: string; equals: ConfigurationScalar };
}

export interface ConfigurationItem {
  id: string;
  [key: string]: ConfigurationScalar;
}

export interface ConfigurationSection {
  id: string;
  title: string;
  description: string;
  itemLabel: string;
  fields: ConfigurationField[];
  items: ConfigurationItem[];
  minItems?: number;
  maxItems?: number;
}

export interface ViewConfiguration {
  version: 1;
  viewType: string;
  label: string;
  sections: ConfigurationSection[];
  options: Record<string, ConfigurationScalar>;
  /** Données de démonstration portables avec la définition YAML de la vue. */
  exampleData?: ViewDataset;
}

export interface TemplateColumn {
  key: string;
  label: string;
  width?: number;
  type?: "text" | "number" | "date";
  values?: string[];
}

export interface TemplateSheet {
  name: string;
  description: string;
  columns: TemplateColumn[];
  rows?: Array<Array<string | number | boolean | null>>;
}

export interface WorkbookTemplateSpec {
  filename: string;
  viewTitle: string;
  sheets: TemplateSheet[];
}

export const sectionOf = (configuration: ViewConfiguration | undefined, id: string) => configuration?.sections.find((section) => section.id === id);
export const optionOf = <T extends ConfigurationScalar>(configuration: ViewConfiguration | undefined, key: string, fallback: T) => (configuration?.options[key] as T | undefined) ?? fallback;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const isScalar = (value: unknown): value is ConfigurationScalar => typeof value === "string" || typeof value === "number" || typeof value === "boolean";
const isBoundedScalar = (value: unknown): value is ConfigurationScalar => isScalar(value) && (typeof value !== "string" || value.length <= MAX_TEXT_LENGTH) && (typeof value !== "number" || Number.isFinite(value));
const isSafeKey = (value: unknown): value is string => typeof value === "string" && safeKeyPattern.test(value) && !forbiddenKeys.has(value);
const isShortText = (value: unknown): value is string => typeof value === "string" && value.length <= MAX_TEXT_LENGTH;
const datasetKeys = new Set<string>(exampleDataCollectionKeys);

function normalizeExampleData(value: unknown): ViewDataset {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(exampleDataCollectionKeys.map((key) => [key, Array.isArray(source[key]) ? structuredClone(source[key]).slice(0, MAX_EXAMPLE_ITEMS_PER_COLLECTION) : []])) as unknown as ViewDataset;
}

function isSafeDatasetValue(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return value.length <= MAX_TEXT_LENGTH;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 1_000 && value.every((item) => isSafeDatasetValue(item, depth + 1));
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, item]) => isSafeKey(key) && isSafeDatasetValue(item, depth + 1));
}

export function validateConfiguration(configuration: unknown, expectedViewType?: string) {
  const errors: string[] = [];
  const addError = (message: string) => { if (errors.length < 50) errors.push(message); };
  if (!isRecord(configuration)) return ["La configuration doit être un objet YAML."];
  if (configuration.version !== 1) errors.push("La version de configuration doit être 1.");
  if (!isSafeKey(configuration.viewType)) addError("Le type de vue est obligatoire et doit être un identifiant sûr.");
  if (expectedViewType && configuration.viewType !== expectedViewType) errors.push(`Ce fichier décrit une vue ${configuration.viewType}, pas une vue ${expectedViewType}.`);
  if (!isShortText(configuration.label) || !configuration.label.trim()) addError("Le libellé de la configuration est obligatoire.");
  if (configuration.exampleData != null) {
    if (!isRecord(configuration.exampleData)) addError("Le jeu d’exemple doit être un objet de données.");
    else {
      for (const [key, collection] of Object.entries(configuration.exampleData)) {
        if (!datasetKeys.has(key)) { addError(`La collection d’exemple « ${key} » n’est pas autorisée.`); continue; }
        if (!Array.isArray(collection)) { addError(`La collection d’exemple « ${key} » doit être une liste.`); continue; }
        if (collection.length > MAX_EXAMPLE_ITEMS_PER_COLLECTION) addError(`La collection d’exemple « ${key} » dépasse ${MAX_EXAMPLE_ITEMS_PER_COLLECTION} éléments.`);
        if (!collection.every((item) => isRecord(item) && isSafeDatasetValue(item))) addError(`La collection d’exemple « ${key} » contient une valeur invalide.`);
      }
    }
  }
  if (!Array.isArray(configuration.sections)) return [...errors, "La liste des sections est obligatoire."];
  if (configuration.sections.length > MAX_SECTIONS) addError(`Une configuration ne peut pas contenir plus de ${MAX_SECTIONS} sections.`);
  if (!isRecord(configuration.options)) addError("Les options doivent être un objet.");
  else {
    if (Object.keys(configuration.options).length > MAX_OPTIONS) addError(`Une configuration ne peut pas contenir plus de ${MAX_OPTIONS} options.`);
    for (const [key, value] of Object.entries(configuration.options)) {
      if (!isSafeKey(key)) addError(`La clé d’option « ${key} » n’est pas autorisée.`);
      if (!isScalar(value) || (typeof value === "string" && value.length > MAX_TEXT_LENGTH) || (typeof value === "number" && !Number.isFinite(value))) addError(`L’option « ${key} » doit être une valeur simple et bornée.`);
    }
  }
  const sectionIds = new Set<string>();
  for (const rawSection of configuration.sections.slice(0, MAX_SECTIONS + 1)) {
    if (!isRecord(rawSection)) { addError("Chaque section doit être un objet."); continue; }
    const section = rawSection;
    if (!isSafeKey(section.id)) addError("Chaque section doit avoir un identifiant sûr.");
    if (typeof section.id === "string" && sectionIds.has(section.id)) errors.push(`La section ${section.id} est déclarée plusieurs fois.`);
    if (typeof section.id === "string") sectionIds.add(section.id);
    if (!isShortText(section.title) || !section.title.trim()) addError(`La section ${String(section.id ?? "sans identifiant")} doit avoir un titre.`);
    if (!isShortText(section.description) || !isShortText(section.itemLabel)) addError(`La section ${String(section.id ?? "sans identifiant")} contient un texte invalide.`);
    if (!Array.isArray(section.fields)) { addError(`${String(section.title ?? "Section")} : la liste des champs est obligatoire.`); continue; }
    if (!Array.isArray(section.items)) { addError(`${String(section.title ?? "Section")} : la liste des éléments est obligatoire.`); continue; }
    if (section.fields.length > MAX_FIELDS_PER_SECTION) addError(`${String(section.title ?? "Section")} ne peut pas contenir plus de ${MAX_FIELDS_PER_SECTION} champs.`);
    if (section.items.length > MAX_ITEMS_PER_SECTION) addError(`${String(section.title ?? "Section")} ne peut pas contenir plus de ${MAX_ITEMS_PER_SECTION} éléments.`);
    if (section.minItems != null && (!Number.isInteger(section.minItems) || (section.minItems as number) < 0)) addError(`${String(section.title ?? "Section")} : minItems doit être un entier positif.`);
    if (section.maxItems != null && (!Number.isInteger(section.maxItems) || (section.maxItems as number) < 0 || (section.maxItems as number) > MAX_ITEMS_PER_SECTION)) addError(`${String(section.title ?? "Section")} : maxItems est invalide.`);
    // Une configuration vide est volontairement valide : elle sert de point de départ
    // « page blanche ». minItems guide seulement l'éditeur et le rendu standard.
    if (typeof section.maxItems === "number" && section.items.length > section.maxItems) addError(`${String(section.title)} ne peut pas contenir plus de ${section.maxItems} élément(s).`);
    const fieldKeys = new Set<string>();
    const fields: ConfigurationField[] = [];
    for (const rawField of section.fields.slice(0, MAX_FIELDS_PER_SECTION + 1)) {
      if (!isRecord(rawField)) { addError(`${String(section.title)} : chaque champ doit être un objet.`); continue; }
      if (!isSafeKey(rawField.key)) addError(`${String(section.title)} : clé de champ invalide.`);
      if (typeof rawField.key === "string" && fieldKeys.has(rawField.key)) addError(`${String(section.title)} : le champ ${rawField.key} est déclaré plusieurs fois.`);
      if (typeof rawField.key === "string") fieldKeys.add(rawField.key);
      if (!isShortText(rawField.label) || !rawField.label.trim()) addError(`${String(section.title)} : chaque champ doit avoir un libellé.`);
      if (!["text", "number", "color", "textarea", "select"].includes(String(rawField.type))) addError(`${String(section.title)} : type de champ invalide pour ${String(rawField.key ?? "un champ")}.`);
      if (rawField.choices != null && (!Array.isArray(rawField.choices) || rawField.choices.length > 100 || rawField.choices.some((choice) => !isRecord(choice) || !isShortText(choice.value) || !isShortText(choice.label)))) addError(`${String(section.title)} : choix invalides pour ${String(rawField.key ?? "un champ")}.`);
      if (rawField.placeholder != null && !isShortText(rawField.placeholder)) addError(`${String(section.title)} : placeholder trop long.`);
      if (rawField.required != null && typeof rawField.required !== "boolean") addError(`${String(section.title)} : required doit être booléen.`);
      if (rawField.readonly != null && typeof rawField.readonly !== "boolean") addError(`${String(section.title)} : readonly doit être booléen.`);
      if (rawField.defaultValue != null && !isBoundedScalar(rawField.defaultValue)) addError(`${String(section.title)} : valeur par défaut invalide pour ${String(rawField.key ?? "un champ")}.`);
      if (rawField.identifier != null && typeof rawField.identifier !== "boolean") addError(`${String(section.title)} : identifier doit être booléen.`);
      if (rawField.visibleWhen != null && (!isRecord(rawField.visibleWhen) || !isSafeKey(rawField.visibleWhen.key) || !isBoundedScalar(rawField.visibleWhen.equals))) addError(`${String(section.title)} : condition d’affichage invalide pour ${String(rawField.key ?? "un champ")}.`);
      fields.push(rawField as unknown as ConfigurationField);
    }
    const itemIds = new Set<string>();
    for (const rawItem of section.items.slice(0, MAX_ITEMS_PER_SECTION + 1)) {
      if (!isRecord(rawItem)) { addError(`${String(section.title)} : chaque élément doit être un objet.`); continue; }
      const item = rawItem;
      if (!isShortText(item.id) || !item.id.trim()) addError(`${String(section.title)} : chaque élément doit avoir un identifiant.`);
      if (typeof item.id === "string" && itemIds.has(item.id)) errors.push(`${String(section.title)} : l’identifiant ${item.id} est utilisé plusieurs fois.`);
      if (typeof item.id === "string") itemIds.add(item.id);
      for (const [key, value] of Object.entries(item)) {
        if (!isSafeKey(key)) addError(`${String(section.title)} : la clé « ${key} » n’est pas autorisée.`);
        if (!isScalar(value) || (typeof value === "string" && value.length > MAX_TEXT_LENGTH) || (typeof value === "number" && !Number.isFinite(value))) addError(`${String(section.title)} : ${key} doit être une valeur simple et bornée.`);
      }
      for (const field of fields.filter((candidate) => candidate.required && (!candidate.visibleWhen || item[candidate.visibleWhen.key] === candidate.visibleWhen.equals))) {
        if (item[field.key] == null || String(item[field.key]).trim() === "") errors.push(`${String(section.title)} : ${field.label} est obligatoire pour ${String(item.id || "un élément")}.`);
      }
      for (const field of fields.filter((candidate) => candidate.identifier && item[candidate.key] != null && String(item[candidate.key]) !== "")) {
        if (!isSafeKey(item[field.key])) addError(`${String(section.title)} : ${field.label} doit être un identifiant technique sûr.`);
      }
    }
  }
  return errors;
}

export function configurationToYaml(configuration: ViewConfiguration) {
  return stringify(configuration, { indent: 2, lineWidth: 0 });
}

export function configurationFromYaml(source: string, expectedViewType: string) {
  if (source.length > MAX_YAML_BYTES) throw new Error(`Le fichier YAML dépasse la taille maximale de ${Math.round(MAX_YAML_BYTES / 1_000)} Ko.`);
  const parsed = parse(source, { maxAliasCount: 50, uniqueKeys: true });
  const errors = validateConfiguration(parsed, expectedViewType);
  if (errors.length) throw new Error(errors.join(" "));
  const configuration = structuredClone(parsed) as ViewConfiguration;
  if (configuration.exampleData) configuration.exampleData = normalizeExampleData(configuration.exampleData);
  return configuration;
}

export function blankConfiguration(configuration: ViewConfiguration): ViewConfiguration {
  const copy = structuredClone(configuration);
  delete copy.exampleData;
  return { ...copy, label: "Structure personnalisée", sections: configuration.sections.map((section) => ({ ...section, items: [] })) };
}

const translatableItemKeys = new Set(["label", "plural", "description", "group"]);

/** Localizes built-in display text while keeping identifiers and imported example data stable. */
export function localizeConfiguration(configuration: ViewConfiguration, translateText: (text: string) => string): ViewConfiguration {
  const copy = structuredClone(configuration);
  copy.label = translateText(copy.label);
  copy.sections = copy.sections.map((section) => ({
    ...section,
    title: translateText(section.title),
    description: translateText(section.description),
    itemLabel: translateText(section.itemLabel),
    fields: section.fields.map((field) => ({
      ...field,
      label: translateText(field.label),
      ...(field.placeholder ? { placeholder: translateText(field.placeholder) } : {}),
      ...(field.choices ? { choices: field.choices.map((choice) => ({ ...choice, label: translateText(choice.label) })) } : {}),
    })),
    items: section.items.map((item) => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, typeof value === "string" && translatableItemKeys.has(key) ? translateText(value) : value])) as ConfigurationItem),
  }));
  return copy;
}

export function withExampleData(configuration: ViewConfiguration, exampleData: ViewDataset): ViewConfiguration {
  return { ...structuredClone(configuration), exampleData: normalizeExampleData(exampleData) };
}

export function createConfigurationItem(section: ConfigurationSection): ConfigurationItem {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return Object.fromEntries([["id", `${section.id}-${suffix}`], ...section.fields.filter((field) => field.key !== "id").map((field) => [field.key, field.defaultValue ?? (field.type === "number" ? 0 : field.type === "color" ? "#2563eb" : field.type === "select" ? field.choices?.[0]?.value ?? "" : "")])]) as ConfigurationItem;
}

/** Ajoute les nouveaux champs d’un moteur sans écraser la structure ni l’ordre déjà enregistrés. */
export function upgradeConfigurationSchema(configuration: ViewConfiguration, defaults: ViewConfiguration): ViewConfiguration {
  const next = structuredClone(configuration);
  let changed = false;
  for (const key of Object.keys(next.options)) {
    if (key in defaults.options) continue;
    delete next.options[key];
    changed = true;
  }
  for (const [key, value] of Object.entries(defaults.options)) {
    if (key in next.options) continue;
    next.options[key] = value;
    changed = true;
  }
  for (const defaultSection of defaults.sections) {
    const section = next.sections.find((candidate) => candidate.id === defaultSection.id);
    if (!section) continue;
    for (const defaultField of defaultSection.fields) {
      const field = section.fields.find((candidate) => candidate.key === defaultField.key);
      if (field && defaultField.visibleWhen) {
        if (field.label !== defaultField.label) { field.label = defaultField.label; changed = true; }
        if (JSON.stringify(field.visibleWhen) !== JSON.stringify(defaultField.visibleWhen)) { field.visibleWhen = structuredClone(defaultField.visibleWhen); changed = true; }
        if (defaultField.defaultValue != null && field.defaultValue !== defaultField.defaultValue) { field.defaultValue = defaultField.defaultValue; changed = true; }
      }
    }
    const missingFields = defaultSection.fields.filter((field) => !section.fields.some((candidate) => candidate.key === field.key));
    if (missingFields.length) {
      section.fields.push(...structuredClone(missingFields));
      for (const item of section.items) {
        const defaultItem = defaultSection.items.find((candidate) => candidate.id === item.id);
        for (const field of missingFields) {
          if (field.key in item) continue;
          item[field.key] = defaultItem?.[field.key]
            ?? field.defaultValue
            ?? (field.type === "number" ? 0 : field.type === "color" ? "#2563eb" : field.type === "select" ? field.choices?.[0]?.value ?? "" : "");
        }
      }
      changed = true;
    }
  }
  return changed ? next : configuration;
}
