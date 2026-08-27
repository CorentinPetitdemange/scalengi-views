"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Boxes, Braces, CheckCircle2, CircleHelp, Cloud, Database, Download, FileCode2, FileSpreadsheet, GalleryVerticalEnd, Grid2X2, Layers3, LayoutDashboard, List, MapPinned, Moon, Network, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Radar as RadarIcon, RotateCcw, Route, Save, Settings, SlidersHorizontal, Star, Sun, Trash2, Upload, Users, X } from "lucide-react";
import { APP_LOCALES, configurationFromYaml, configurationToYaml, createConfigurationItem, downloadWorkbookTemplate, I18nProvider, isDatasetEmpty, localizeConfiguration, MAX_YAML_BYTES, normalizeDataset, upgradeConfigurationSchema, useI18n, validateConfiguration, VIEW_CATALOG_GROUPS, viewRegistry, type AppLocale, type ViewConfiguration, type ViewDefinition } from "../library/src";
import packageMetadata from "../package.json";
import { deleteViewInstance, listViewInstances, saveViewInstance, type ViewInstance, type ViewSource } from "./view-instance-store";
import { ViewExportMenu } from "./view-export-menu";

type Screen = "catalog" | "create" | "instance" | "settings";
type InstanceTab = "view" | "structure" | "data" | "guide";
type CatalogLayout = "grid" | "list";
const SETTINGS_KEY = "scalengi-view-settings-v1";
const CATALOG_INITIALIZED_KEY = "scalengi-views-catalog-initialized-v1";
const APP_VERSION = packageMetadata.version;
const APP_CHANNEL = APP_VERSION.includes("-alpha.") ? "Alpha" : APP_VERSION.includes("-beta.") ? "Bêta" : APP_VERSION.includes("-rc.") ? "Release candidate" : "Stable";
const APP_RELEASE_NOTE = APP_VERSION.includes("-") ? "Cette préversion peut évoluer et contenir des fonctionnalités incomplètes." : "Version stable de Scalengi Views.";

const now = () => new Date().toISOString();
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `view-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const viewIcons = { users: Users, cloud: Cloud, boxes: Boxes, map: MapPinned, radar: RadarIcon, layers: Layers3, network: Network, route: Route } satisfies Record<ViewDefinition["icon"], typeof Users>;
const iconFor = (definition: ViewDefinition) => viewIcons[definition.icon];
const renderViewIcon = (definition: ViewDefinition, size: number) => { const Icon = iconFor(definition); return <Icon size={size} />; };
const formatDate = (value: string, locale: "fr" | "en") => new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const optionLabel = (key: string) => ({ centerLabel: "Libellé du centre", radius: "Rayon des galaxies", maturityMax: "Maturité maximale", scoreMin: "Note minimale", scoreMax: "Note maximale", priorityCount: "Nombre de priorités", minWordLength: "Longueur minimale des mots", maxWords: "Nombre maximal de mots", cloudShape: "Forme initiale du nuage", preset: "Modèle d’origine", showDescriptions: "Afficher les descriptions", showReferences: "Afficher les éléments liés" }[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2"));
const optionChoices: Record<string, Array<{ value: string; label: string }>> = {
  cloudShape: [{ value: "cloud", label: "Nuage" }, { value: "round", label: "Rond" }, { value: "rectangle", label: "Rectangle" }],
};
const sourceLabel = (source?: ViewSource) => source?.kind === "demo" ? "Jeu d’exemple" : source?.kind === "excel" ? source.filename : "Données à ajouter";
const itemCountLabel = (label: string, count: number) => count > 1 && label === "niveau" ? "niveaux" : count > 1 ? `${label}s` : label;

function demoInstances(definitions = viewRegistry.list()): ViewInstance[] {
  const createdAt = now();
  return definitions.map((definition) => {
    const configuration = definition.createDefaultConfiguration();
    return {
      id: makeId(), type: definition.id, name: definition.demoName,
      data: normalizeDataset(configuration.exampleData ?? definition.createDemoData()), configuration, createdAt, updatedAt: createdAt,
      source: { kind: "demo", activatedAt: createdAt },
    };
  });
}

export function ScalengiViewsApp() {
  return <I18nProvider><ScalengiViewsShell /></I18nProvider>;
}

function ScalengiViewsShell() {
  const { locale, t } = useI18n();
  const [screen, setScreen] = useState<Screen>("catalog");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [instanceTab, setInstanceTab] = useState<InstanceTab>("view");
  const [instances, setInstances] = useState<ViewInstance[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState<"blue" | "violet" | "emerald">("blue");
  const [catalogLayout, setCatalogLayout] = useState<CatalogLayout>("grid");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const bootstrapStartedRef = useRef(false);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;
    void (async () => {
      try {
        try {
          const settings = localStorage.getItem(SETTINGS_KEY);
          if (settings) {
            const parsed = JSON.parse(settings) as { theme?: typeof theme; accent?: typeof accent; catalogLayout?: CatalogLayout; favoriteIds?: unknown };
            if (parsed.theme) setTheme(parsed.theme);
            if (parsed.accent) setAccent(parsed.accent);
            if (parsed.catalogLayout === "grid" || parsed.catalogLayout === "list") setCatalogLayout(parsed.catalogLayout);
            if (Array.isArray(parsed.favoriteIds)) setFavoriteIds(parsed.favoriteIds.filter((id): id is string => typeof id === "string").slice(0, 500));
          }
        } catch { /* Les préférences sont facultatives. */ }
        let stored = await listViewInstances();
        const demoKeys = new Set<string>();
        const duplicateDemoIds: string[] = [];
        stored = stored.filter((instance) => {
          if (instance.source?.kind !== "demo") return true;
          const key = `${instance.type}:${instance.name}`;
          if (demoKeys.has(key)) { duplicateDemoIds.push(instance.id); return false; }
          demoKeys.add(key); return true;
        });
        if (duplicateDemoIds.length) await Promise.all(duplicateDemoIds.map(deleteViewInstance));
        const catalogWasInitialized = localStorage.getItem(CATALOG_INITIALIZED_KEY) === "true";
        if (!stored.length && !catalogWasInitialized) {
          stored = demoInstances();
          await Promise.all(stored.map(saveViewInstance));
        } else {
          const renamedDemos = stored.map((instance) => {
            const definition = viewRegistry.get(instance.type);
            if (!definition) return instance;
            if (instance.type === "togaf-tracking" && instance.name === "Suivi TOGAF — Démonstration") return { ...instance, name: definition.demoName };
            if (instance.name === "Collaboration — Démonstration" && instance.type !== "collaborator-journey") return { ...instance, name: definition.demoName };
            return instance;
          });
          const configuredDemos = renamedDemos.map((instance) => {
            const definition = viewRegistry.get(instance.type);
            if (!definition) return instance;
            const defaultConfiguration = definition.createDefaultConfiguration();
            const storedConfiguration = instance.configuration
              ? instance.name === definition.demoName && !instance.configuration.exampleData
                ? { ...instance.configuration, exampleData: defaultConfiguration.exampleData }
                : instance.configuration
              : defaultConfiguration;
            const configuration = upgradeConfigurationSchema(storedConfiguration, defaultConfiguration);
            return configuration !== instance.configuration ? { ...instance, configuration } : instance;
          });
          if (configuredDemos.some((instance, index) => instance !== stored[index])) {
            stored = configuredDemos;
            await Promise.all(stored.map(saveViewInstance));
          }
        }
        localStorage.setItem(CATALOG_INITIALIZED_KEY, "true");
        setInstances(stored);
      } finally { setReady(true); }
    })();
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, accent, catalogLayout, favoriteIds }));
  }, [accent, catalogLayout, favoriteIds, ready, theme]);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const activeInstance = instances.find((item) => item.id === activeId) ?? null;
  const activeDefinition = activeInstance ? viewRegistry.get(activeInstance.type) ?? null : null;
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const favoriteInstances = useMemo(() => instances.filter((instance) => favoriteIdSet.has(instance.id)), [favoriteIdSet, instances]);
  const flash = (message: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => { setToast(null); toastTimerRef.current = null; }, 2800);
  };
  const toggleFavorite = (id: string) => setFavoriteIds((current) => current.includes(id) ? current.filter((favoriteId) => favoriteId !== id) : [...current, id]);
  const openInstance = (id: string, tab: InstanceTab = "view") => { setActiveId(id); setInstanceTab(tab); setScreen("instance"); };
  const saveInstance = async (instance: ViewInstance) => {
    setInstances((current) => [instance, ...current.filter((item) => item.id !== instance.id)]);
    await saveViewInstance(instance);
  };
  const removeInstance = async (instance: ViewInstance) => {
    await deleteViewInstance(instance.id);
    setInstances((current) => current.filter((item) => item.id !== instance.id));
    setFavoriteIds((current) => current.filter((id) => id !== instance.id));
    if (activeId === instance.id) { setActiveId(null); setScreen("catalog"); }
    flash(locale === "fr" ? `Vue « ${instance.name} » supprimée` : `View “${instance.name}” deleted`);
  };
  const createInstance = async (definition: ViewDefinition, name: string, structure: "standard" | "blank", dataMode: "empty" | "demo", presetId?: string) => {
    const createdAt = now();
    const preset = definition.presets?.find((candidate) => candidate.id === presetId);
    const baseConfiguration = preset ? preset.createConfiguration() : structure === "standard" || dataMode === "demo" ? definition.createDefaultConfiguration() : definition.createBlankConfiguration();
    const configuration = localizeConfiguration(baseConfiguration, t);
    const useDemo = dataMode === "demo" && Boolean(configuration.exampleData);
    const instance: ViewInstance = {
      id: makeId(), type: definition.id, name,
      data: useDemo ? normalizeDataset(configuration.exampleData ?? definition.createDemoData()) : definition.createEmptyData(),
      configuration,
      createdAt, updatedAt: createdAt,
      source: useDemo ? { kind: "demo", activatedAt: createdAt } : undefined,
    };
    await saveInstance(instance);
    openInstance(instance.id, useDemo ? "view" : "structure");
    flash(t(useDemo ? "Vue créée avec le jeu de données d’exemple" : structure === "blank" ? "Vue créée avec une structure vide" : "Vue créée, prête à recevoir vos données"));
  };

  const title = screen === "settings" ? t("Paramètres") : screen === "create" ? t("Nouvelle vue") : screen === "instance" && activeInstance ? activeInstance.name : t("Mes vues");
  return (
    <div className={`app-shell theme-${theme} accent-${accent} ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="brand-row"><div className="brand-mark">S</div>{!collapsed && <div className="brand-copy"><strong>scalengi</strong><span>Views</span></div>}<button className="icon-button collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={t(collapsed ? "Ouvrir le menu" : "Réduire le menu")}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
        <nav className="main-navigation" aria-label={t("Navigation principale")}>
          <button className={screen === "catalog" ? "active" : ""} onClick={() => setScreen("catalog")} title={t("Mes vues")}><GalleryVerticalEnd /><span>{t("Mes vues")}</span><em>{instances.length}</em></button>
          <button className={screen === "create" ? "new-view-nav active" : "new-view-nav"} onClick={() => setScreen("create")} title={t("Créer une vue")}><Plus /><span>{t("Nouvelle vue")}</span></button>
          {!collapsed && favoriteInstances.length > 0 && <div className="sidebar-view-list"><label>{t("Favoris").toUpperCase()}</label>{favoriteInstances.map((instance) => { const definition = viewRegistry.get(instance.type); const Icon = definition ? iconFor(definition) : LayoutDashboard; return <button key={instance.id} className={screen === "instance" && instance.id === activeId ? "active" : ""} onClick={() => openInstance(instance.id)}><Icon /><span>{instance.name}</span><Star className="sidebar-favorite-icon" fill="currentColor" /></button>; })}</div>}
          <button className={screen === "settings" ? "active" : ""} onClick={() => setScreen("settings")} title={t("Paramètres")}><Settings /><span>{t("Paramètres")}</span></button>
        </nav>
        {!collapsed && <div className="sidebar-context"><span>{t("Stockage par vue").toUpperCase()}</span><div><i /> {t("Mode local actif")}</div><small>{t("Chaque vue possède ses propres données sur cet appareil.")}</small></div>}
        <div className="sidebar-footer"><div className="user-avatar">CM</div>{!collapsed && <div><strong>{t("Espace de démonstration")}</strong><span>{APP_CHANNEL} · v{APP_VERSION}</span></div>}</div>
      </aside>

      <main className="app-main">
        <header className="topbar"><div className="breadcrumb">{screen !== "catalog" && <button className="icon-button" onClick={() => setScreen("catalog")} aria-label={t("Retour aux vues")}><ArrowLeft size={17} /></button>}<LayoutDashboard size={16} /><span>/</span><strong>{title}</strong></div>{activeInstance && screen === "instance" && <div className="topbar-actions"><button className="data-status" onClick={() => setInstanceTab("data")}><i /> {t(sourceLabel(activeInstance.source))}</button></div>}</header>
        <div className="screen-content">
          {!ready && <div className="loading-state">{t("Chargement des vues locales…")}</div>}
          {ready && screen === "catalog" && <ViewCatalog instances={instances} favoriteIds={favoriteIdSet} layout={catalogLayout} onFavoriteChange={toggleFavorite} onLayoutChange={setCatalogLayout} onOpen={openInstance} onCreate={() => setScreen("create")} />}
          {ready && screen === "create" && <CreateViewScreen onCancel={() => setScreen("catalog")} onCreate={createInstance} />}
          {ready && screen === "instance" && activeInstance && activeDefinition && <InstanceWorkspace instance={activeInstance} definition={activeDefinition} tab={instanceTab} onTab={setInstanceTab} onSave={saveInstance} onDelete={removeInstance} onFlash={flash} />}
          {ready && screen === "settings" && <SettingsScreen theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} />}
        </div>
      </main>
      {toast && <div className="toast-message"><span>✓</span>{toast}</div>}
    </div>
  );
}

function ViewCatalog({ instances, favoriteIds, layout, onFavoriteChange, onLayoutChange, onOpen, onCreate }: { instances: ViewInstance[]; favoriteIds: ReadonlySet<string>; layout: CatalogLayout; onFavoriteChange: (id: string) => void; onLayoutChange: (layout: CatalogLayout) => void; onOpen: (id: string) => void; onCreate: () => void }) {
  const { locale, t } = useI18n();
  return <div className="catalog-screen">
    <div className="section-heading"><div><h2>{t("Mes vues")}</h2><p>{t("Vos analyses enregistrées sur cet appareil.")}</p></div><div className="catalog-actions"><div className="layout-switch" role="group" aria-label={t("Affichage des vues")}><button className={layout === "grid" ? "active" : ""} aria-label={t("Afficher les vues en grille")} aria-pressed={layout === "grid"} title={t("Vue en grille")} onClick={() => onLayoutChange("grid")}><Grid2X2 size={15} /></button><button className={layout === "list" ? "active" : ""} aria-label={t("Afficher les vues en liste")} aria-pressed={layout === "list"} title={t("Vue en liste")} onClick={() => onLayoutChange("list")}><List size={17} /></button></div><button className="primary-button" onClick={onCreate}><Plus size={16} /> {t("Nouvelle vue")}</button></div></div>
    {instances.length ? <div className={`instance-grid ${layout === "list" ? "is-list" : ""}`}>{instances.map((instance) => { const definition = viewRegistry.get(instance.type); if (!definition) return null; const Icon = iconFor(definition); const isFavorite = favoriteIds.has(instance.id); const sourceText = instance.source?.kind === "demo" ? t("Jeu de données d’exemple") : instance.source?.kind === "excel" ? `${t("Source")} : ${instance.source.filename}` : t("Aucune donnée active"); const stateText = instance.source?.kind === "demo" ? t("Exemple") : instance.source ? t("Données prêtes") : t("À alimenter"); return <article className={`instance-card view-${definition.accent}`} key={instance.id}><button className="instance-card-main" aria-label={`${t("Ouvrir")} ${instance.name}`} onClick={() => onOpen(instance.id)}><span className="view-icon"><Icon size={21} /></span><div><p className="eyebrow">{t(definition.shortTitle)}</p><h3>{instance.name}</h3><p>{sourceText}</p></div><span className={instance.source ? "instance-state ready" : "instance-state"}>{stateText}</span><small>{t("Mis à jour")} {formatDate(instance.updatedAt, locale)}</small></button><button className={`favorite-button ${isFavorite ? "active" : ""}`} aria-label={`${t(isFavorite ? "Retirer des favoris" : "Ajouter aux favoris")} — ${instance.name}`} aria-pressed={isFavorite} title={t(isFavorite ? "Retirer des favoris" : "Ajouter aux favoris")} onClick={() => onFavoriteChange(instance.id)}><Star size={16} fill={isFavorite ? "currentColor" : "none"} /></button></article>; })}</div> : <div className="instance-empty"><GalleryVerticalEnd size={28} /><h3>{t("Aucune vue")}</h3><p>{t("Créez une vue pour commencer votre analyse.")}</p><button className="primary-button" onClick={onCreate}><Plus size={16} /> {t("Nouvelle vue")}</button></div>}
  </div>;
}

function InstanceWorkspace({ instance, definition, tab, onTab, onSave, onDelete, onFlash }: { instance: ViewInstance; definition: ViewDefinition; tab: InstanceTab; onTab: (tab: InstanceTab) => void; onSave: (instance: ViewInstance) => Promise<void>; onDelete: (instance: ViewInstance) => Promise<void>; onFlash: (message: string) => void }) {
  const { t } = useI18n();
  const exportTargetRef = useRef<HTMLDivElement>(null);
  const ViewComponent = definition.component;
  const configuration = instance.configuration ?? definition.createDefaultConfiguration();
  return <div className="instance-workspace">
    <div className="instance-tabs"><div className="instance-tab-title"><span className={`mini-view-icon view-${definition.accent}`}>{renderViewIcon(definition, 15)}</span><strong>{instance.name}</strong></div><div className="instance-tab-controls"><nav aria-label={t("Menu de la vue")}><button className={tab === "view" ? "active" : ""} onClick={() => onTab("view")}><LayoutDashboard size={15} /> {t("Vue")}</button><button className={tab === "structure" ? "active" : ""} onClick={() => onTab("structure")}><SlidersHorizontal size={15} /> {t("Structure")}</button><button className={tab === "data" ? "active" : ""} onClick={() => onTab("data")}><Database size={15} /> {t("Données")}</button><button className={tab === "guide" ? "active" : ""} onClick={() => onTab("guide")}><CircleHelp size={15} /> {t("Comment ça fonctionne")}</button></nav>{tab === "view" && <ViewExportMenu targetRef={exportTargetRef} filename={instance.name} onExported={onFlash} />}</div></div>
    {tab === "view" && <div className="view-export-surface" ref={exportTargetRef}><ViewComponent data={instance.data} configuration={configuration} /></div>}
    {tab === "structure" && <InstanceStructureScreen key={instance.id} instance={instance} definition={definition} onSave={onSave} onDelete={onDelete} onFlash={onFlash} />}
    {tab === "data" && <InstanceDataScreen instance={instance} definition={definition} onSave={onSave} onFlash={onFlash} />}
    {tab === "guide" && <ViewGuideScreen definition={definition} configuration={configuration} />}
  </div>;
}

function InstanceStructureScreen({ instance, definition, onSave, onDelete, onFlash }: { instance: ViewInstance; definition: ViewDefinition; onSave: (instance: ViewInstance) => Promise<void>; onDelete: (instance: ViewInstance) => Promise<void>; onFlash: (message: string) => void }) {
  const { t } = useI18n();
  const yamlInputRef = useRef<HTMLInputElement>(null);
  const initial = instance.configuration ?? definition.createDefaultConfiguration();
  const [draft, setDraft] = useState<ViewConfiguration>(() => structuredClone(initial));
  const [mode, setMode] = useState<"guided" | "yaml">("guided");
  const [yaml, setYaml] = useState(() => configurationToYaml(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState(instance.name);
  const [renaming, setRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updateDraft = (next: ViewConfiguration) => { setDraft(next); setYaml(configurationToYaml(next)); setError(null); };
  const mutateDraft = (mutate: (next: ViewConfiguration) => void) => { const next = structuredClone(draft); mutate(next); updateDraft(next); };
  const updateItem = (sectionIndex: number, itemIndex: number, key: string, value: string) => mutateDraft((next) => {
    const field = next.sections[sectionIndex].fields.find((candidate) => candidate.key === key);
    next.sections[sectionIndex].items[itemIndex][key] = field?.type === "number" ? Number(value) : value;
  });
  const updateOption = (key: string, value: string) => mutateDraft((next) => { next.options[key] = typeof draft.options[key] === "number" ? Number(value) : typeof draft.options[key] === "boolean" ? value === "true" : value; });
  const moveItem = (sectionIndex: number, itemIndex: number, direction: -1 | 1) => mutateDraft((next) => {
    const items = next.sections[sectionIndex].items;
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    [items[itemIndex], items[targetIndex]] = [items[targetIndex], items[itemIndex]];
  });
  const removeItem = (sectionIndex: number, itemIndex: number) => mutateDraft((next) => { next.sections[sectionIndex].items.splice(itemIndex, 1); });
  const addItem = (sectionIndex: number) => mutateDraft((next) => { next.sections[sectionIndex].items.push(createConfigurationItem(next.sections[sectionIndex])); });
  const parseYaml = () => { try { const next = configurationFromYaml(yaml, definition.id); setDraft(next); setError(null); return next; } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Le fichier YAML est invalide.")); return null; } };
  const save = async () => {
    const next = mode === "yaml" ? parseYaml() : draft; if (!next) return;
    const errors = validateConfiguration(next, definition.id); if (errors.length) { setError(errors.join(" ")); return; }
    setSaving(true); try { await onSave({ ...instance, configuration: structuredClone(next), updatedAt: now() }); onFlash(t("Structure enregistrée")); } finally { setSaving(false); }
  };
  const downloadYaml = () => {
    const errors = validateConfiguration(draft, definition.id);
    if (errors.length) { setError(errors.join(" ")); return; }
    const blob = new Blob([configurationToYaml(draft)], { type: "application/yaml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${instance.name.toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || definition.id}.yaml`;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };
  const importYaml = async (file?: File) => { if (!file) return; try { if (file.size > MAX_YAML_BYTES) throw new Error(`Le fichier YAML dépasse la taille maximale de ${Math.round(MAX_YAML_BYTES / 1_000)} Ko.`); const source = await file.text(); const next = configurationFromYaml(source, definition.id); updateDraft(next); setMode("guided"); onFlash(t("Configuration YAML chargée — enregistrez pour l’appliquer")); } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Le fichier YAML est invalide.")); } };
  const renameView = async () => {
    const nextName = viewName.trim();
    if (!nextName || nextName === instance.name || renaming) return;
    setRenaming(true);
    try {
      await onSave({ ...instance, name: nextName, updatedAt: now() });
      setViewName(nextName);
      onFlash(t("Vue renommée"));
    } finally { setRenaming(false); }
  };
  return <div className="instance-page structure-page"><div className="structure-hero"><div><p className="eyebrow">{t("Configuration intrinsèque de la vue")}</p><h1>{t("Structurer")} « {instance.name} »</h1><p>{t("Définissez ici ce que la vue sait afficher : axes, couches, catégories, vocabulaire et règles de représentation.")}</p></div><div className="structure-hero-actions"><button className="secondary-button" onClick={() => updateDraft(definition.createBlankConfiguration())}><Trash2 size={15} /> {t("Page blanche")}</button><button className="danger-button" onClick={() => setDeleteOpen(true)}><Trash2 size={15} /> {t("Supprimer la vue")}</button></div></div>
    <section className="view-identity-card"><div><p className="eyebrow">{t("Identité de la vue")}</p><h2>{t("Nom de la vue")}</h2><p>{t("Modifiez le nom affiché dans le catalogue et dans l’espace de travail.")}</p></div><form onSubmit={(event) => { event.preventDefault(); void renameView(); }}><label htmlFor={`view-name-${instance.id}`} className="visually-hidden">{t("Nom de la vue")}</label><input id={`view-name-${instance.id}`} value={viewName} maxLength={160} onChange={(event) => setViewName(event.target.value)} /><button className="secondary-button" type="submit" disabled={renaming || !viewName.trim() || viewName.trim() === instance.name}><Pencil size={14} /> {t(renaming ? "Renommage…" : "Renommer la vue")}</button></form></section>
    <div className="structure-toolbar"><div className="segmented-control"><button className={mode === "guided" ? "active" : ""} onClick={() => setMode("guided")}><SlidersHorizontal size={14} /> {t("Éditeur guidé")}</button><button className={mode === "yaml" ? "active" : ""} onClick={() => { setYaml(configurationToYaml(draft)); setMode("yaml"); }}><Braces size={14} /> YAML</button></div><div><button className="secondary-button" onClick={downloadYaml}><Download size={15} /> {t("Exporter YAML")}</button><button className="secondary-button" onClick={() => yamlInputRef.current?.click()}><Upload size={15} /> {t("Importer YAML")}</button><input ref={yamlInputRef} className="visually-hidden" type="file" accept=".yaml,.yml,text/yaml,application/yaml" onChange={(event) => { void importYaml(event.target.files?.[0]); event.target.value = ""; }} /><button className="primary-button" disabled={saving} onClick={() => void save()}><Save size={15} /> {t(saving ? "Enregistrement…" : "Enregistrer la structure")}</button></div></div>
    {error && <div className="import-message error"><X size={17} /><div><strong>{t("Configuration invalide")}</strong><span>{error}</span></div></div>}
    <div className="structure-layout"><main className="structure-editor">{mode === "yaml" ? <section className="yaml-editor-card"><div><p className="eyebrow">{t("Configuration portable")}</p><h2>{t("Définition YAML")}</h2><p>{t("Le même fichier partage la structure et, si elle existe, sa donnée d’exemple prête à activer.")}</p></div><textarea value={yaml} onChange={(event) => setYaml(event.target.value)} spellCheck={false} aria-label={t("Configuration YAML")} /><button className="secondary-button" onClick={() => { const next = parseYaml(); if (next) onFlash(t("YAML valide")); }}><CheckCircle2 size={15} /> {t("Vérifier le YAML")}</button></section> : <>
      {Object.keys(draft.options).length > 0 && <section className="structure-section"><header><div><span>{t("OPTIONS")}</span><h2>{t("Paramètres généraux")}</h2><p>{t("Valeurs qui modifient le comportement de la vue sans ajouter de données.")}</p></div></header><div className="option-grid">{Object.entries(draft.options).map(([key, value]) => <label key={key}><span>{t(optionLabel(key))}</span>{key === "preset" ? <input value={String(value)} readOnly /> : optionChoices[key] ? <select value={String(value)} onChange={(event) => updateOption(key, event.target.value)}>{optionChoices[key].map((choice) => <option key={choice.value} value={choice.value}>{t(choice.label)}</option>)}</select> : typeof value === "boolean" ? <select value={String(value)} onChange={(event) => updateOption(key, event.target.value)}><option value="true">{t("Oui")}</option><option value="false">{t("Non")}</option></select> : <input type={typeof value === "number" ? "number" : "text"} value={String(value)} onChange={(event) => updateOption(key, event.target.value)} />}</label>)}</div></section>}
      {draft.sections.map((section, sectionIndex) => <section className="structure-section" key={section.id}><header><div><span>{section.id}</span><h2>{section.title}</h2><p>{section.description}</p></div><em>{section.items.length} {itemCountLabel(section.itemLabel, section.items.length)}</em></header><div className="structure-items">{section.items.map((item, itemIndex) => <article key={`${item.id}-${itemIndex}`}><div className="structure-item-number">{String(itemIndex + 1).padStart(2, "0")}</div><div className="structure-item-fields">{section.fields.filter((field) => !field.visibleWhen || item[field.visibleWhen.key] === field.visibleWhen.equals).map((field) => <label key={field.key} className={field.type === "textarea" ? "wide" : ""}><span>{field.label}</span>{field.type === "textarea" ? <textarea value={String(item[field.key] ?? "")} onChange={(event) => updateItem(sectionIndex, itemIndex, field.key, event.target.value)} /> : field.type === "select" ? <select value={String(item[field.key] ?? field.choices?.[0]?.value ?? "")} onChange={(event) => updateItem(sectionIndex, itemIndex, field.key, event.target.value)}>{field.choices?.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : <input type={field.type} value={String(item[field.key] ?? "")} readOnly={field.readonly} onChange={(event) => updateItem(sectionIndex, itemIndex, field.key, event.target.value)} />}</label>)}</div><div className="structure-item-actions"><button onClick={() => moveItem(sectionIndex, itemIndex, -1)} disabled={itemIndex === 0} aria-label={`${t("Monter")} ${section.itemLabel} ${itemIndex + 1}`} title={t("Monter")}><ArrowUp size={14} /></button><button onClick={() => moveItem(sectionIndex, itemIndex, 1)} disabled={itemIndex === section.items.length - 1} aria-label={`${t("Descendre")} ${section.itemLabel} ${itemIndex + 1}`} title={t("Descendre")}><ArrowDown size={14} /></button>{section.minItems == null || section.items.length > section.minItems ? <button className="structure-remove" onClick={() => removeItem(sectionIndex, itemIndex)} aria-label={`${t("Supprimer")} ${section.itemLabel} ${itemIndex + 1}`} title={t("Supprimer")}><Trash2 size={14} /></button> : null}</div></article>)}{!section.items.length && <div className="structure-empty">{t("Aucun élément. Ajoutez-en un ou importez une configuration YAML.")}</div>}</div>{(section.maxItems == null || section.items.length < section.maxItems) && <button className="add-structure-item" onClick={() => addItem(sectionIndex)}><Plus size={15} /> {t("Ajouter :")} {section.itemLabel}</button>}</section>)}
    </>}</main></div>
    {deleteOpen && <DeleteViewModal instance={instance} onClose={() => setDeleteOpen(false)} onDelete={onDelete} />}
  </div>;
}

function DeleteViewModal({ instance, onClose, onDelete }: { instance: ViewInstance; onClose: () => void; onDelete: (instance: ViewInstance) => Promise<void> }) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmDelete = async () => {
    setDeleting(true); setError(null);
    try { await onDelete(instance); }
    catch { setError(t("La vue n’a pas pu être supprimée. Réessayez.")); setDeleting(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (!deleting && event.currentTarget === event.target) onClose(); }}><div className="modal delete-view-modal" role="dialog" aria-modal="true" aria-labelledby="delete-view-title"><div className="modal-header"><div><p className="eyebrow">{t("Suppression définitive")}</p><h2 id="delete-view-title">{t("Supprimer la vue ?")} « {instance.name} »</h2></div><button className="icon-button" disabled={deleting} onClick={onClose} aria-label={t("Fermer")}><X size={18} /></button></div><div className="modal-body"><div className="delete-view-warning"><Trash2 size={20} /><div><strong>{t("Toute la vue sera supprimée")}</strong><p>{t("La structure, les données importées et les réglages propres à cette vue seront définitivement effacés.")}</p></div></div>{error && <p className="view-delete-error" role="alert">{error}</p>}</div><div className="modal-footer"><button className="secondary-button" disabled={deleting} onClick={onClose}>{t("Annuler")}</button><button className="danger-button confirm-delete-button" disabled={deleting} onClick={() => void confirmDelete()}><Trash2 size={15} /> {t(deleting ? "Suppression…" : "Supprimer définitivement")}</button></div></div></div>;
}

function InstanceDataScreen({ instance, definition, onSave, onFlash }: { instance: ViewInstance; definition: ViewDefinition; onSave: (instance: ViewInstance) => Promise<void>; onFlash: (message: string) => void }) {
  const { locale, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [switchingSource, setSwitchingSource] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const configuration = instance.configuration ?? definition.createDefaultConfiguration();
  const template = useMemo(() => definition.buildTemplate(configuration), [configuration, definition]);
  const counts = useMemo(() => definition.summarize(instance.data, configuration), [configuration, definition, instance.data]);
  const hasData = !isDatasetEmpty(instance.data);
  const canActivateExample = !instance.source && !hasData;
  const handleFile = async (file?: File) => {
    if (!file) return;
    if (instance.source && !window.confirm(`${t(instance.source.kind === "demo" ? "Remplacer le jeu d’exemple par" : "Remplacer le fichier actif par")} « ${file.name} » ?`)) return;
    setImporting(true); setError(null); setWarnings([]);
    try {
      const result = await definition.importExcel(file, configuration);
      const importedAt = now();
      await onSave({ ...instance, data: result.data, configuration: result.configuration ?? configuration, updatedAt: importedAt, source: { kind: "excel", filename: file.name, importedAt, rowCount: result.rowCount } });
      setWarnings(result.warnings);
      onFlash(locale === "fr" ? `${result.rowCount} lignes importées dans cette vue` : `${result.rowCount} rows imported into this view`);
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("Le fichier Excel n’a pas pu être lu."));
    } finally { setImporting(false); }
  };
  const activateDemo = async () => {
    const demoConfiguration = definition.createDefaultConfiguration();
    if (!window.confirm(t("Activer la vue d’exemple ? La structure actuelle sera remplacée par la structure d’exemple, puis les données de démonstration seront chargées."))) return;
    setSwitchingSource(true); setError(null); setWarnings([]);
    try {
      const activatedAt = now();
      await onSave({ ...instance, data: normalizeDataset(demoConfiguration.exampleData ?? definition.createDemoData()), configuration: demoConfiguration, source: { kind: "demo", activatedAt }, updatedAt: activatedAt });
      onFlash(t("Vue d’exemple restaurée"));
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("Le jeu d’exemple n’a pas pu être activé."));
    } finally { setSwitchingSource(false); }
  };
  const clearData = async () => {
    const disablingDemo = instance.source?.kind === "demo";
    if (!window.confirm(t(disablingDemo
      ? "Désactiver l’exemple ? Toutes les données et la structure fournies par l’exemple seront supprimées."
      : "Supprimer toutes les données de cette vue ? La structure personnalisée sera conservée."))) return;
    setSwitchingSource(true); setError(null); setWarnings([]);
    try {
      const updatedAt = now();
      await onSave({
        ...instance,
        data: definition.createEmptyData(),
        configuration: disablingDemo ? definition.createBlankConfiguration() : configuration,
        source: undefined,
        updatedAt,
      });
      onFlash(t(disablingDemo ? "Exemple désactivé — ses données et sa structure ont été supprimées" : "Données supprimées — la structure est conservée"));
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("Les données n’ont pas pu être supprimées."));
    } finally { setSwitchingSource(false); }
  };
  const sourceTitle = instance.source?.kind === "demo" ? t("Jeu de données d’exemple") : instance.source?.kind === "excel" ? instance.source.filename : hasData ? t("Données présentes") : t("Aucune donnée active");
  const sourceDescription = instance.source?.kind === "demo"
    ? locale === "fr" ? `Restaurée le ${formatDate(instance.source.activatedAt, locale)} · la structure et les données correspondent à la vue d’exemple.` : `Restored on ${formatDate(instance.source.activatedAt, locale)} · structure and data match the sample view.`
    : instance.source?.kind === "excel"
      ? locale === "fr" ? `Importé le ${formatDate(instance.source.importedAt, locale)} · ${instance.source.rowCount} lignes utiles.` : `Imported on ${formatDate(instance.source.importedAt, locale)} · ${instance.source.rowCount} useful rows.`
      : hasData ? t("Des données sont présentes sans source identifiée. Supprimez-les avant d’activer la vue d’exemple.") : t("Importez un fichier Excel ou activez l’exemple pour découvrir immédiatement la vue.");
  return <div className="instance-page data-setup-page">
    <div className="page-title-row"><div><p className="eyebrow">{t("Données de cette vue uniquement")}</p><h1>{t("Alimenter")} « {instance.name} »</h1><p>{t("Une seule source est active à la fois : aucune donnée, exemple ou fichier Excel. Activer l’exemple remplace aussi la structure actuelle.")}</p></div>{instance.source && <span className="source-badge"><CheckCircle2 size={15} /> {t(instance.source.kind === "demo" ? "Exemple actif" : "Fichier actif")}</span>}</div>
    <div className="data-setup-grid"><section className="setup-main-card"><span className="setup-step">01</span><div className="setup-icon"><Download size={21} /></div><h2>{t("Télécharger le modèle de cette instance")}</h2><p>{t("Le classeur est généré maintenant à partir de votre structure : axes, couches, niveaux, catégories et valeurs contrôlées.")}</p><button className="secondary-button template-download" onClick={() => downloadWorkbookTemplate(template)}><FileSpreadsheet size={16} /> {t("Télécharger")} {template.filename}</button></section>
      <section className="setup-main-card"><span className="setup-step">02</span><div className="setup-icon"><Upload size={21} /></div><h2>{t("Importer le fichier complété")}</h2><p>{t("L’import remplace la source active de cette instance, après vérification des feuilles, colonnes et identifiants.")}</p><button className="primary-button import-button" disabled={importing || switchingSource} onClick={() => inputRef.current?.click()}><Upload size={16} /> {t(importing ? "Contrôle en cours…" : instance.source ? "Remplacer par un fichier Excel" : "Choisir un fichier Excel")}</button><input ref={inputRef} className="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} /></section>
    </div>
    {error && <div className="import-message error"><X size={17} /><div><strong>{t("Import refusé")}</strong><span>{error}</span></div></div>}
    {warnings.map((warning) => <div className="import-message warning" key={warning}><CircleHelp size={17} /><div><strong>{t("Point d’attention")}</strong><span>{warning}</span></div></div>)}
    {canActivateExample && <section className="example-activation-card"><div className="setup-icon"><Database size={21} /></div><div><p className="eyebrow">{t("Vue d’exemple disponible")}</p><h2>{t("Découvrir la vue avec son exemple")}</h2><p>{t("L’exemple restaure sa structure d’origine et charge uniquement ses données de démonstration.")}</p></div><button className="secondary-button" disabled={switchingSource} onClick={() => void activateDemo()}><Database size={15} /> {t("Activer la vue d’exemple")}</button></section>}
    <section className="source-overview"><div className="source-overview-copy"><p className="eyebrow">{t("Source active")}</p><h2>{sourceTitle}</h2><p>{sourceDescription}</p>{(instance.source || hasData) && <div className="source-actions"><button className="danger-button" disabled={switchingSource} onClick={() => void clearData()}><Trash2 size={15} /> {t(instance.source?.kind === "demo" ? "Désactiver l’exemple" : "Supprimer les données importées")}</button></div>}</div><div className="source-counts">{counts.map((count) => <span key={count.label}><strong>{count.value}</strong><small>{count.label}</small></span>)}</div></section>
  </div>;
}

function ViewGuideScreen({ definition, configuration }: { definition: ViewDefinition; configuration: ViewConfiguration }) {
  const { locale, t } = useI18n();
  const template = definition.buildTemplate(configuration);
  const exampleData = configuration.exampleData ? normalizeDataset(configuration.exampleData) : null;
  const exampleCounts = exampleData ? definition.summarize(exampleData, configuration) : [];
  const sheetDescriptions = new Map(definition.guide.sheets.map((sheet) => [sheet.name, sheet.description]));
  return <div className="instance-page guide-page"><div className="guide-hero"><div><p className="eyebrow">{definition.category}</p><h1>{locale === "fr" ? `Comment fonctionne « ${definition.title} » ?` : `How does “${definition.title}” work?`}</h1><p>{definition.guide.purpose}</p></div></div>
    <section className="guide-section"><h2>{t("Les questions auxquelles elle répond")}</h2><div className="question-grid">{definition.guide.questions.map((question, index) => <article key={question}><span>0{index + 1}</span><p>{question}</p></article>)}</div></section>
    {definition.guide.reading?.length ? <section className="guide-section"><h2>{definition.guide.readingTitle ?? t("Comment lire la vue")}</h2><div className="guide-reading-grid">{definition.guide.reading.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><p>{item.description}</p></div></article>)}</div></section> : null}
    <section className="guide-section"><h2>{t("Jeu d’exemple de cette configuration")}</h2><div className={`guide-example-card ${exampleData ? "available" : "empty"}`}><div><Database size={20} /><div><strong>{t(exampleData ? "Exemple portable inclus dans le YAML" : "Aucun jeu d’exemple inclus")}</strong><p>{t(exampleData ? "Cette configuration peut être partagée telle quelle : son exemple voyagera avec sa structure et pourra être activé depuis Données." : "Cette configuration décrit uniquement la structure. Ajoutez exampleData dans le YAML si vous souhaitez distribuer un exemple avec elle.")}</p></div></div>{exampleCounts.length > 0 && <div className="guide-example-metrics">{exampleCounts.map((item) => <span key={item.label}><strong>{item.value}</strong><small>{item.label}</small></span>)}</div>}</div></section>
    <section className="guide-section"><h2>{definition.guide.stepsTitle ?? t("Mettre la vue en place")}</h2><div className="step-list">{definition.guide.steps.map((step, index) => <article key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></article>)}</div></section>
    <section className="guide-section"><h2>{t("Format Excel disponible dans Données")}</h2><p className="guide-section-intro">{t("Le modèle téléchargeable dans l’onglet Données est calculé depuis la structure actuelle. Il attend les feuilles et colonnes suivantes.")}</p><div className="sheet-list">{template.sheets.map((sheet) => <article key={sheet.name}><div><FileSpreadsheet size={17} /><strong>{sheet.name}</strong></div><p>{sheet.description || sheetDescriptions.get(sheet.name) || t("Données attendues par cette vue.")}</p><code>{sheet.columns.map((column) => column.label).join(" · ")}</code></article>)}</div></section>
  </div>;
}

function CreateViewScreen({ onCancel, onCreate }: { onCancel: () => void; onCreate: (definition: ViewDefinition, name: string, structure: "standard" | "blank", dataMode: "empty" | "demo", presetId?: string) => Promise<void> }) {
  const { t } = useI18n();
  const definitions = viewRegistry.list();
  const [selectedId, setSelectedId] = useState(definitions[0]?.id ?? "");
  const selected = viewRegistry.get(selectedId);
  const [name, setName] = useState(() => definitions[0] ? `${t(definitions[0].shortTitle)} — ${t("Nouvelle analyse")}` : "");
  const [structure, setStructure] = useState<"standard" | "blank">("standard");
  const [dataMode, setDataMode] = useState<"empty" | "demo">("demo");
  const [presetId, setPresetId] = useState(definitions[0]?.presets?.[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const selectedPreset = selected?.presets?.find((preset) => preset.id === presetId);
  const presetHasExample = Boolean(selectedPreset?.createConfiguration().exampleData);
  const selectDefinition = (definition: ViewDefinition) => {
    setSelectedId(definition.id);
    setName(`${t(definition.shortTitle)} — ${t("Nouvelle analyse")}`);
    setPresetId(definition.presets?.[0]?.id ?? "");
    setStructure("standard");
    setDataMode("demo");
  };
  return <div className="create-view-screen page-screen" aria-labelledby="create-view-title">
    <div className="create-view-heading"><div><p className="eyebrow">{t("Nouvelle analyse")}</p><h1 id="create-view-title">{t("Choisir un type de vue")}</h1><p>{t("Sélectionnez une vue par usage, puis configurez son point de départ.")}</p></div><button className="secondary-button" onClick={onCancel}><ArrowLeft size={16} /> {t("Annuler")}</button></div>
    <div className="create-view-layout">
      <div className="create-definition-groups">{VIEW_CATALOG_GROUPS.map((group) => { const groupDefinitions = definitions.filter((definition) => definition.catalogGroup === group.id); if (!groupDefinitions.length) return null; return <section key={group.id}><header><div><strong>{t(group.label)}</strong><p>{t(group.description)}</p></div><span>{groupDefinitions.length}</span></header><div className="create-definition-grid">{groupDefinitions.map((definition) => { const Icon = iconFor(definition); return <button type="button" aria-pressed={selectedId === definition.id} className={selectedId === definition.id ? "selected" : ""} key={definition.id} onClick={() => selectDefinition(definition)}><span className={`view-icon view-${definition.accent}`}><Icon size={22} /></span><strong>{t(definition.shortTitle)}</strong><small>{t(definition.category)}</small></button>; })}</div></section>; })}</div>
      <aside className="create-view-setup"><div className="create-selected-view">{selected && <><span className={`view-icon view-${selected.accent}`}>{renderViewIcon(selected, 22)}</span><div><p className="eyebrow">{t("Vue sélectionnée")}</p><h2>{t(selected.title)}</h2><p>{t(selected.description)}</p></div></>}</div><label><span>{t("Nom de la vue")}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>{selected?.presets?.length ? <div className="creation-preset-choice"><span>{t("Point de départ")}</span><div>{selected.presets.map((preset) => <button type="button" key={preset.id} className={presetId === preset.id ? "selected" : ""} onClick={() => { setPresetId(preset.id); setName(`${t(preset.title)} — ${t("Nouvelle analyse")}`); const hasExample = Boolean(preset.createConfiguration().exampleData); if (!hasExample) setDataMode("empty"); }}><strong>{t(preset.title)}</strong><small>{t(preset.description)}</small></button>)}</div></div> : <div className="creation-structure-choice"><span>{t("Structure initiale")}</span><div><button type="button" className={structure === "standard" ? "selected" : ""} onClick={() => setStructure("standard")}><RotateCcw size={16} /><strong>{t("Modèle standard")}</strong><small>{t("Une base prête à adapter")}</small></button><button type="button" className={structure === "blank" ? "selected" : ""} onClick={() => { setStructure("blank"); setDataMode("empty"); }}><FileCode2 size={16} /><strong>{t("Page blanche")}</strong><small>{t("Tout définir vous-même")}</small></button></div></div>}<div className="creation-structure-choice"><span>{t("Données au démarrage")}</span><div><button type="button" className={dataMode === "demo" ? "selected" : ""} disabled={Boolean(selected?.presets?.length) && !presetHasExample} onClick={() => { setDataMode("demo"); setStructure("standard"); }}><Database size={16} /><strong>{t("Jeu d’exemple inclus")}</strong><small>{t(Boolean(selected?.presets?.length) && !presetHasExample ? "Non disponible pour une structure vierge" : "Activer l’exemple fourni par le YAML")}</small></button><button type="button" className={dataMode === "empty" ? "selected" : ""} onClick={() => setDataMode("empty")}><FileCode2 size={16} /><strong>{t("Aucune donnée")}</strong><small>{t("Importer votre fichier plus tard")}</small></button></div></div><div className="modal-note"><Database size={16} /><span>{t("Le modèle choisi contient son exemple dans le YAML. Il reste désactivable et ne cohabite jamais avec un fichier Excel actif.")}</span></div><div className="create-view-actions"><button className="secondary-button" onClick={onCancel}>{t("Annuler")}</button><button className="primary-button" disabled={!selected || !name.trim() || saving} onClick={() => { if (!selected) return; setSaving(true); void onCreate(selected, name.trim(), structure, dataMode, presetId || undefined).finally(() => setSaving(false)); }}><Plus size={16} /> {t(saving ? "Création…" : "Créer la vue")}</button></div></aside>
    </div>
  </div>;
}

function SettingsScreen({ theme, accent, setTheme, setAccent }: { theme: "light" | "dark"; accent: "blue" | "violet" | "emerald"; setTheme: (theme: "light" | "dark") => void; setAccent: (accent: "blue" | "violet" | "emerald") => void }) {
  const { locale, setLocale, t } = useI18n();
  const futureSources = [
    { id: "inventory", icon: Database, title: "Scalengi Inventory", description: "Référentiel et inventaires" },
    { id: "app", icon: Cloud, title: "Scalengi App", description: "Espace SaaS Scalengi" },
    { id: "api", icon: Network, title: "API / BDD", description: "Connexion à une source externe" },
  ];
  return <div className="settings-screen page-screen"><div className="page-title-row"><div><p className="eyebrow">{t("Préférences locales")}</p><h1>{t("Paramètres")}</h1><p>{t("Adaptez l’interface à votre environnement de travail.")}</p></div></div><section className="settings-card"><div><h2>{t("Langue")}</h2><p>{t("Choisissez la langue de navigation. Les structures intégrées sont traduites ; vos données restent inchangées.")}</p></div><div className="setting-group"><label htmlFor="application-language">{t("Interface")}</label><select id="application-language" className="language-select" value={locale} onChange={(event) => setLocale(event.target.value as AppLocale)}>{APP_LOCALES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></div></section><section className="settings-card"><div><h2>{t("Apparence")}</h2><p>{t("Les vues utilisent les mêmes principes visuels que Scalengi.")}</p></div><div><div className="setting-group"><label>{t("Thème")}</label><div className="segmented-control"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={16} /> {t("Clair")}</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={16} /> {t("Sombre")}</button></div></div><div className="setting-group"><label>{t("Couleur principale")}</label><div className="color-options">{(["blue", "violet", "emerald"] as const).map((color) => <button className={`${color} ${accent === color ? "active" : ""}`} key={color} onClick={() => setAccent(color)} aria-label={t(`Couleur ${color}`)} />)}</div></div></div></section><section className="settings-card source-settings-card"><div><h2>{t("Source des vues")}</h2><p>{t("Choisissez l’origine des données exploitées par Scalengi Views.")}</p></div><div className="source-mode-grid"><button className="source-mode active" aria-pressed="true"><FileSpreadsheet size={17} /><span><strong>{t("Local")}</strong><small>{t("Fichiers et données sur cet appareil")}</small></span><em>{t("Actif")}</em></button>{futureSources.map(({ id, icon: Icon, title, description }) => <button className="source-mode" key={id} disabled><Icon size={17} /><span><strong>{title}</strong><small>{t(description)}</small></span><em>{t("Bientôt")}</em></button>)}</div></section><section className="settings-card"><div><h2>{t("À propos")}</h2><p>{t("Version installée de Scalengi Views.")}</p></div><div className="version-status"><strong>{t(APP_CHANNEL)}</strong><span>{t("Version")} {APP_VERSION}</span><small>{t(APP_RELEASE_NOTE)}</small></div></section></div>;
}
