"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Boxes, Braces, CheckCircle2, CircleHelp, Cloud, Database, Download, FileCode2, FileSpreadsheet, GalleryVerticalEnd, Grid2X2, Layers3, LayoutDashboard, List, MapPinned, Moon, PanelLeftClose, PanelLeftOpen, Plus, Radar as RadarIcon, RotateCcw, Route, Save, Settings, SlidersHorizontal, Star, Sun, Trash2, Upload, Users, X } from "lucide-react";
import { configurationFromYaml, configurationToYaml, createConfigurationItem, downloadWorkbookTemplate, MAX_YAML_BYTES, normalizeDataset, validateConfiguration, VIEW_CATALOG_GROUPS, viewRegistry, type ViewConfiguration, type ViewDefinition } from "../library/src";
import { listViewInstances, saveViewInstance, type ViewInstance, type ViewSource } from "./view-instance-store";
import { ViewExportMenu } from "./view-export-menu";

type Screen = "catalog" | "instance" | "settings";
type InstanceTab = "view" | "structure" | "data" | "guide";
type CatalogLayout = "grid" | "list";
const SETTINGS_KEY = "scalengi-view-settings-v1";

const now = () => new Date().toISOString();
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `view-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const viewIcons = { users: Users, cloud: Cloud, boxes: Boxes, map: MapPinned, radar: RadarIcon, layers: Layers3, route: Route } satisfies Record<ViewDefinition["icon"], typeof Users>;
const iconFor = (definition: ViewDefinition) => viewIcons[definition.icon];
const renderViewIcon = (definition: ViewDefinition, size: number) => { const Icon = iconFor(definition); return <Icon size={size} />; };
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const optionLabel = (key: string) => ({ centerLabel: "Libellé du centre", radius: "Rayon des galaxies", maturityMax: "Maturité maximale", scoreMin: "Note minimale", scoreMax: "Note maximale", priorityCount: "Nombre de priorités", minWordLength: "Longueur minimale des mots", maxWords: "Nombre maximal de mots", cloudShape: "Forme initiale du nuage" }[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2"));
const optionChoices: Record<string, Array<{ value: string; label: string }>> = {
  cloudShape: [{ value: "cloud", label: "Nuage" }, { value: "round", label: "Rond" }, { value: "rectangle", label: "Rectangle" }],
};
const sourceLabel = (source?: ViewSource) => source?.kind === "demo" ? "Jeu d’exemple" : source?.kind === "excel" ? source.filename : "Données à ajouter";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
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
        if (!stored.length) {
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
            const configuration = instance.configuration
              ? instance.name === definition.demoName && !instance.configuration.exampleData
                ? { ...instance.configuration, exampleData: defaultConfiguration.exampleData }
                : instance.configuration
              : defaultConfiguration;
            const source = !instance.source && instance.name === definition.demoName ? { kind: "demo" as const, activatedAt: instance.updatedAt } : instance.source;
            return configuration !== instance.configuration || source !== instance.source ? { ...instance, configuration, source } : instance;
          });
          if (configuredDemos.some((instance, index) => instance !== stored[index])) {
            stored = configuredDemos;
            await Promise.all(stored.map(saveViewInstance));
          }
          const missingDefinitions = viewRegistry.list().filter((definition) => !stored.some((instance) => instance.type === definition.id));
          if (missingDefinitions.length) {
            const missingDemos = demoInstances(missingDefinitions);
            await Promise.all(missingDemos.map(saveViewInstance));
            stored = [...missingDemos, ...stored];
          }
        }
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
  const createInstance = async (definition: ViewDefinition, name: string, structure: "standard" | "blank", dataMode: "empty" | "demo") => {
    const createdAt = now();
    const useDemo = dataMode === "demo";
    const configuration = structure === "standard" || useDemo ? definition.createDefaultConfiguration() : definition.createBlankConfiguration();
    const instance: ViewInstance = {
      id: makeId(), type: definition.id, name,
      data: useDemo ? normalizeDataset(configuration.exampleData ?? definition.createDemoData()) : definition.createEmptyData(),
      configuration,
      createdAt, updatedAt: createdAt,
      source: useDemo ? { kind: "demo", activatedAt: createdAt } : undefined,
    };
    await saveInstance(instance);
    setCreateOpen(false);
    openInstance(instance.id, useDemo ? "view" : "structure");
    flash(useDemo ? "Vue créée avec le jeu de données d’exemple" : structure === "blank" ? "Vue créée avec une structure vide" : "Vue créée, prête à recevoir vos données");
  };

  const title = screen === "settings" ? "Paramètres" : screen === "instance" && activeInstance ? activeInstance.name : "Mes vues";
  return (
    <div className={`app-shell theme-${theme} accent-${accent} ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="brand-row"><div className="brand-mark">S</div>{!collapsed && <div className="brand-copy"><strong>scalengi</strong><span>Views</span></div>}<button className="icon-button collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Ouvrir le menu" : "Réduire le menu"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
        <nav className="main-navigation" aria-label="Navigation principale">
          <button className={screen === "catalog" ? "active" : ""} onClick={() => setScreen("catalog")} title="Mes vues"><GalleryVerticalEnd /><span>Mes vues</span><em>{instances.length}</em></button>
          <button className="new-view-nav" onClick={() => setCreateOpen(true)} title="Créer une vue"><Plus /><span>Nouvelle vue</span></button>
          {!collapsed && favoriteInstances.length > 0 && <div className="sidebar-view-list"><label>FAVORIS</label>{favoriteInstances.map((instance) => { const definition = viewRegistry.get(instance.type); const Icon = definition ? iconFor(definition) : LayoutDashboard; return <button key={instance.id} className={screen === "instance" && instance.id === activeId ? "active" : ""} onClick={() => openInstance(instance.id)}><Icon /><span>{instance.name}</span><Star className="sidebar-favorite-icon" fill="currentColor" /></button>; })}</div>}
          <button className={screen === "settings" ? "active" : ""} onClick={() => setScreen("settings")} title="Paramètres"><Settings /><span>Paramètres</span></button>
        </nav>
        {!collapsed && <div className="sidebar-context"><span>STOCKAGE PAR VUE</span><div><i /> Mode local actif</div><small>Chaque vue possède ses propres données sur cet appareil.</small></div>}
        <div className="sidebar-footer"><div className="user-avatar">CM</div>{!collapsed && <div><strong>Espace de démonstration</strong><span>Version locale · 0.2</span></div>}</div>
      </aside>

      <main className="app-main">
        <header className="topbar"><div className="breadcrumb">{screen !== "catalog" && <button className="icon-button" onClick={() => setScreen("catalog")} aria-label="Retour aux vues"><ArrowLeft size={17} /></button>}<LayoutDashboard size={16} /><span>/</span><strong>{title}</strong></div>{activeInstance && screen === "instance" && <div className="topbar-actions"><button className="data-status" onClick={() => setInstanceTab("data")}><i /> {sourceLabel(activeInstance.source)}</button></div>}</header>
        <div className="screen-content">
          {!ready && <div className="loading-state">Chargement des vues locales…</div>}
          {ready && screen === "catalog" && <ViewCatalog instances={instances} favoriteIds={favoriteIdSet} layout={catalogLayout} onFavoriteChange={toggleFavorite} onLayoutChange={setCatalogLayout} onOpen={openInstance} onCreate={() => setCreateOpen(true)} />}
          {ready && screen === "instance" && activeInstance && activeDefinition && <InstanceWorkspace instance={activeInstance} definition={activeDefinition} tab={instanceTab} onTab={setInstanceTab} onSave={saveInstance} onFlash={flash} />}
          {ready && screen === "settings" && <SettingsScreen theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} />}
        </div>
      </main>
      {createOpen && <CreateViewModal onClose={() => setCreateOpen(false)} onCreate={createInstance} />}
      {toast && <div className="toast-message"><span>✓</span>{toast}</div>}
    </div>
  );
}

function ViewCatalog({ instances, favoriteIds, layout, onFavoriteChange, onLayoutChange, onOpen, onCreate }: { instances: ViewInstance[]; favoriteIds: ReadonlySet<string>; layout: CatalogLayout; onFavoriteChange: (id: string) => void; onLayoutChange: (layout: CatalogLayout) => void; onOpen: (id: string) => void; onCreate: () => void }) {
  return <div className="catalog-screen">
    <div className="section-heading"><div><h2>Mes vues</h2><p>Vos analyses enregistrées sur cet appareil.</p></div><div className="catalog-actions"><div className="layout-switch" role="group" aria-label="Affichage des vues"><button className={layout === "grid" ? "active" : ""} aria-label="Afficher les vues en grille" aria-pressed={layout === "grid"} title="Vue en grille" onClick={() => onLayoutChange("grid")}><Grid2X2 size={15} /></button><button className={layout === "list" ? "active" : ""} aria-label="Afficher les vues en liste" aria-pressed={layout === "list"} title="Vue en liste" onClick={() => onLayoutChange("list")}><List size={17} /></button></div><button className="primary-button" onClick={onCreate}><Plus size={16} /> Nouvelle vue</button></div></div>
    <div className={`instance-grid ${layout === "list" ? "is-list" : ""}`}>{instances.map((instance) => { const definition = viewRegistry.get(instance.type); if (!definition) return null; const Icon = iconFor(definition); const isFavorite = favoriteIds.has(instance.id); const sourceText = instance.source?.kind === "demo" ? "Jeu de données d’exemple" : instance.source?.kind === "excel" ? `Source : ${instance.source.filename}` : "Aucune donnée active"; const stateText = instance.source?.kind === "demo" ? "Exemple" : instance.source ? "Données prêtes" : "À alimenter"; return <article className={`instance-card view-${definition.accent}`} key={instance.id}><button className="instance-card-main" aria-label={`Ouvrir ${instance.name}`} onClick={() => onOpen(instance.id)}><span className="view-icon"><Icon size={21} /></span><div><p className="eyebrow">{definition.shortTitle}</p><h3>{instance.name}</h3><p>{sourceText}</p></div><span className={instance.source ? "instance-state ready" : "instance-state"}>{stateText}</span><small>Mis à jour {formatDate(instance.updatedAt)}</small></button><button className={`favorite-button ${isFavorite ? "active" : ""}`} aria-label={isFavorite ? `Retirer ${instance.name} des favoris` : `Ajouter ${instance.name} aux favoris`} aria-pressed={isFavorite} title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => onFavoriteChange(instance.id)}><Star size={16} fill={isFavorite ? "currentColor" : "none"} /></button></article>; })}</div>
  </div>;
}

function InstanceWorkspace({ instance, definition, tab, onTab, onSave, onFlash }: { instance: ViewInstance; definition: ViewDefinition; tab: InstanceTab; onTab: (tab: InstanceTab) => void; onSave: (instance: ViewInstance) => Promise<void>; onFlash: (message: string) => void }) {
  const exportTargetRef = useRef<HTMLDivElement>(null);
  const ViewComponent = definition.component;
  const configuration = instance.configuration ?? definition.createDefaultConfiguration();
  return <div className="instance-workspace">
    <div className="instance-tabs"><div className="instance-tab-title"><span className={`mini-view-icon view-${definition.accent}`}>{renderViewIcon(definition, 15)}</span><strong>{instance.name}</strong></div><div className="instance-tab-controls"><nav aria-label="Menu de la vue"><button className={tab === "view" ? "active" : ""} onClick={() => onTab("view")}><LayoutDashboard size={15} /> Vue</button><button className={tab === "structure" ? "active" : ""} onClick={() => onTab("structure")}><SlidersHorizontal size={15} /> Structure</button><button className={tab === "data" ? "active" : ""} onClick={() => onTab("data")}><Database size={15} /> Données</button><button className={tab === "guide" ? "active" : ""} onClick={() => onTab("guide")}><CircleHelp size={15} /> Comment ça fonctionne</button></nav>{tab === "view" && <ViewExportMenu targetRef={exportTargetRef} filename={instance.name} onExported={onFlash} />}</div></div>
    {tab === "view" && <div className="view-export-surface" ref={exportTargetRef}><ViewComponent data={instance.data} configuration={configuration} /></div>}
    {tab === "structure" && <InstanceStructureScreen key={`${instance.id}-${instance.updatedAt}`} instance={instance} definition={definition} onSave={onSave} onFlash={onFlash} />}
    {tab === "data" && <InstanceDataScreen instance={instance} definition={definition} onSave={onSave} onFlash={onFlash} />}
    {tab === "guide" && <ViewGuideScreen definition={definition} configuration={configuration} />}
  </div>;
}

function InstanceStructureScreen({ instance, definition, onSave, onFlash }: { instance: ViewInstance; definition: ViewDefinition; onSave: (instance: ViewInstance) => Promise<void>; onFlash: (message: string) => void }) {
  const yamlInputRef = useRef<HTMLInputElement>(null);
  const initial = instance.configuration ?? definition.createDefaultConfiguration();
  const [draft, setDraft] = useState<ViewConfiguration>(() => structuredClone(initial));
  const [mode, setMode] = useState<"guided" | "yaml">("guided");
  const [yaml, setYaml] = useState(() => configurationToYaml(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateDraft = (next: ViewConfiguration) => { setDraft(next); setYaml(configurationToYaml(next)); setError(null); };
  const mutateDraft = (mutate: (next: ViewConfiguration) => void) => { const next = structuredClone(draft); mutate(next); updateDraft(next); };
  const updateItem = (sectionIndex: number, itemIndex: number, key: string, value: string) => mutateDraft((next) => {
    const field = next.sections[sectionIndex].fields.find((candidate) => candidate.key === key);
    next.sections[sectionIndex].items[itemIndex][key] = field?.type === "number" ? Number(value) : value;
  });
  const updateOption = (key: string, value: string) => mutateDraft((next) => { next.options[key] = typeof draft.options[key] === "number" ? Number(value) : typeof draft.options[key] === "boolean" ? value === "true" : value; });
  const removeItem = (sectionIndex: number, itemIndex: number) => mutateDraft((next) => { next.sections[sectionIndex].items.splice(itemIndex, 1); });
  const addItem = (sectionIndex: number) => mutateDraft((next) => { next.sections[sectionIndex].items.push(createConfigurationItem(next.sections[sectionIndex])); });
  const parseYaml = () => { try { const next = configurationFromYaml(yaml, definition.id); setDraft(next); setError(null); return next; } catch (cause) { setError(cause instanceof Error ? cause.message : "Le fichier YAML est invalide."); return null; } };
  const save = async () => {
    const next = mode === "yaml" ? parseYaml() : draft; if (!next) return;
    const errors = validateConfiguration(next, definition.id); if (errors.length) { setError(errors.join(" ")); return; }
    setSaving(true); try { await onSave({ ...instance, configuration: structuredClone(next), updatedAt: now() }); onFlash("Structure enregistrée — le modèle Excel a été régénéré"); } finally { setSaving(false); }
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
  const importYaml = async (file?: File) => { if (!file) return; try { if (file.size > MAX_YAML_BYTES) throw new Error(`Le fichier YAML dépasse la taille maximale de ${Math.round(MAX_YAML_BYTES / 1_000)} Ko.`); const source = await file.text(); const next = configurationFromYaml(source, definition.id); updateDraft(next); setMode("guided"); onFlash("Configuration YAML chargée — enregistrez pour l’appliquer"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Le fichier YAML est invalide."); } };
  const contract = definition.buildTemplate(draft);

  return <div className="instance-page structure-page"><div className="structure-hero"><div><p className="eyebrow">Configuration intrinsèque de la vue</p><h1>Structurer « {instance.name} »</h1><p>Cette structure décrit ce que la vue sait afficher. Les données seront liées ensuite dans un fichier Excel construit exactement à partir de cette configuration.</p></div><div className="structure-hero-actions"><button className="secondary-button" onClick={() => updateDraft(definition.createDefaultConfiguration())}><RotateCcw size={15} /> Modèle standard</button><button className="secondary-button" onClick={() => updateDraft(definition.createBlankConfiguration())}><Trash2 size={15} /> Page blanche</button></div></div>
    <div className="structure-toolbar"><div className="segmented-control"><button className={mode === "guided" ? "active" : ""} onClick={() => setMode("guided")}><SlidersHorizontal size={14} /> Éditeur guidé</button><button className={mode === "yaml" ? "active" : ""} onClick={() => { setYaml(configurationToYaml(draft)); setMode("yaml"); }}><Braces size={14} /> YAML</button></div><div><button className="secondary-button" onClick={downloadYaml}><Download size={15} /> Exporter YAML</button><button className="secondary-button" onClick={() => yamlInputRef.current?.click()}><Upload size={15} /> Importer YAML</button><input ref={yamlInputRef} className="visually-hidden" type="file" accept=".yaml,.yml,text/yaml,application/yaml" onChange={(event) => { void importYaml(event.target.files?.[0]); event.target.value = ""; }} /><button className="primary-button" disabled={saving} onClick={() => void save()}><Save size={15} /> {saving ? "Enregistrement…" : "Enregistrer la structure"}</button></div></div>
    {error && <div className="import-message error"><X size={17} /><div><strong>Configuration invalide</strong><span>{error}</span></div></div>}
    <div className="structure-layout"><main className="structure-editor">{mode === "yaml" ? <section className="yaml-editor-card"><div><p className="eyebrow">Configuration portable</p><h2>Définition YAML</h2><p>Le même fichier partage la structure et, si elle existe, sa donnée d’exemple prête à activer.</p></div><textarea value={yaml} onChange={(event) => setYaml(event.target.value)} spellCheck={false} aria-label="Configuration YAML" /><button className="secondary-button" onClick={() => { const next = parseYaml(); if (next) onFlash("YAML valide"); }}><CheckCircle2 size={15} /> Vérifier le YAML</button></section> : <>
      {Object.keys(draft.options).length > 0 && <section className="structure-section"><header><div><span>OPTIONS</span><h2>Paramètres généraux</h2><p>Valeurs qui modifient le comportement de la vue sans ajouter de données.</p></div></header><div className="option-grid">{Object.entries(draft.options).map(([key, value]) => <label key={key}><span>{optionLabel(key)}</span>{optionChoices[key] ? <select value={String(value)} onChange={(event) => updateOption(key, event.target.value)}>{optionChoices[key].map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : typeof value === "boolean" ? <select value={String(value)} onChange={(event) => updateOption(key, event.target.value)}><option value="true">Oui</option><option value="false">Non</option></select> : <input type={typeof value === "number" ? "number" : "text"} value={String(value)} onChange={(event) => updateOption(key, event.target.value)} />}</label>)}</div></section>}
      {draft.sections.map((section, sectionIndex) => <section className="structure-section" key={section.id}><header><div><span>{section.id}</span><h2>{section.title}</h2><p>{section.description}</p></div><em>{section.items.length} {section.itemLabel}{section.items.length > 1 ? "s" : ""}</em></header><div className="structure-items">{section.items.map((item, itemIndex) => <article key={`${item.id}-${itemIndex}`}><div className="structure-item-number">{String(itemIndex + 1).padStart(2, "0")}</div><div className="structure-item-fields">{section.fields.map((field) => <label key={field.key} className={field.type === "textarea" ? "wide" : ""}><span>{field.label}</span>{field.type === "textarea" ? <textarea value={String(item[field.key] ?? "")} onChange={(event) => updateItem(sectionIndex, itemIndex, field.key, event.target.value)} /> : <input type={field.type} value={String(item[field.key] ?? "")} readOnly={field.readonly} onChange={(event) => updateItem(sectionIndex, itemIndex, field.key, event.target.value)} />}</label>)}</div>{section.minItems == null || section.items.length > section.minItems ? <button className="structure-remove" onClick={() => removeItem(sectionIndex, itemIndex)} aria-label={`Supprimer ${section.itemLabel} ${itemIndex + 1}`}><Trash2 size={15} /></button> : null}</article>)}{!section.items.length && <div className="structure-empty">Aucun élément. Ajoutez-en un ou importez une configuration YAML.</div>}</div>{(section.maxItems == null || section.items.length < section.maxItems) && <button className="add-structure-item" onClick={() => addItem(sectionIndex)}><Plus size={15} /> Ajouter : {section.itemLabel}</button>}</section>)}
    </>}</main><aside className="structure-contract"><p className="eyebrow">Contrat de données généré</p><h2>{contract.filename}</h2><p>Ce classeur est recalculé à partir de la structure actuellement affichée.</p><button className="primary-button" onClick={() => downloadWorkbookTemplate(contract)}><FileSpreadsheet size={15} /> Télécharger ce modèle Excel</button><div className="contract-sheet-list">{contract.sheets.map((sheet) => <article key={sheet.name}><FileSpreadsheet size={15} /><div><strong>{sheet.name}</strong><span>{sheet.columns.length} colonnes · {sheet.rows?.length ?? 0} lignes préremplies</span></div></article>)}</div><div className="structure-separation"><strong>Exemple ≠ source active</strong><span>Le YAML peut distribuer un exemple. Le classeur sert à fournir la vraie donnée de cette instance.</span></div></aside></div>
  </div>;
}

function InstanceDataScreen({ instance, definition, onSave, onFlash }: { instance: ViewInstance; definition: ViewDefinition; onSave: (instance: ViewInstance) => Promise<void>; onFlash: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [switchingSource, setSwitchingSource] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const configuration = instance.configuration ?? definition.createDefaultConfiguration();
  const template = useMemo(() => definition.buildTemplate(configuration), [configuration, definition]);
  const counts = useMemo(() => definition.summarize(instance.data), [definition, instance.data]);
  const handleFile = async (file?: File) => {
    if (!file) return;
    if (instance.source && !window.confirm(`Remplacer ${instance.source.kind === "demo" ? "le jeu d’exemple" : "le fichier actif"} par « ${file.name} » ?`)) return;
    setImporting(true); setError(null); setWarnings([]);
    try {
      const result = await definition.importExcel(file, configuration);
      const importedAt = now();
      await onSave({ ...instance, data: result.data, updatedAt: importedAt, source: { kind: "excel", filename: file.name, importedAt, rowCount: result.rowCount } });
      setWarnings(result.warnings);
      onFlash(`${result.rowCount} lignes importées dans cette vue`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le fichier Excel n’a pas pu être lu.");
    } finally { setImporting(false); }
  };
  const activateDemo = async () => {
    const demoConfiguration = configuration.exampleData ? configuration : definition.createDefaultConfiguration();
    if (!window.confirm("Activer le jeu d’exemple associé à cette configuration ? Les données actuelles seront remplacées.")) return;
    setSwitchingSource(true); setError(null); setWarnings([]);
    try {
      const activatedAt = now();
      await onSave({ ...instance, data: normalizeDataset(demoConfiguration.exampleData ?? definition.createDemoData()), configuration: demoConfiguration, source: { kind: "demo", activatedAt }, updatedAt: activatedAt });
      onFlash("Jeu de données d’exemple activé");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le jeu d’exemple n’a pas pu être activé.");
    } finally { setSwitchingSource(false); }
  };
  const clearData = async () => {
    if (!window.confirm("Supprimer toutes les données de cette vue ? La structure personnalisée sera conservée.")) return;
    setSwitchingSource(true); setError(null); setWarnings([]);
    try {
      const updatedAt = now();
      await onSave({ ...instance, data: definition.createEmptyData(), source: undefined, updatedAt });
      onFlash("Données supprimées — la structure est conservée");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Les données n’ont pas pu être supprimées.");
    } finally { setSwitchingSource(false); }
  };
  const sourceTitle = instance.source?.kind === "demo" ? "Jeu de données d’exemple" : instance.source?.kind === "excel" ? instance.source.filename : "Aucune donnée active";
  const sourceDescription = instance.source?.kind === "demo"
    ? `Activé le ${formatDate(instance.source.activatedAt)} · les données d’un éventuel fichier ne sont pas conservées en parallèle.`
    : instance.source?.kind === "excel"
      ? `Importé le ${formatDate(instance.source.importedAt)} · ${instance.source.rowCount} lignes utiles.`
      : "Importez un fichier Excel ou activez l’exemple pour découvrir immédiatement la vue.";
  return <div className="instance-page data-setup-page">
    <div className="page-title-row"><div><p className="eyebrow">Données de cette vue uniquement</p><h1>Alimenter « {instance.name} »</h1><p>Une seule source est active à la fois : aucune donnée, exemple ou fichier Excel. Changer de source remplace les données affichées.</p></div>{instance.source && <span className="source-badge"><CheckCircle2 size={15} /> {instance.source.kind === "demo" ? "Exemple actif" : "Fichier actif"}</span>}</div>
    <div className="data-setup-grid"><section className="setup-main-card"><span className="setup-step">01</span><div className="setup-icon"><Download size={21} /></div><h2>Télécharger le modèle de cette instance</h2><p>Le classeur est généré maintenant à partir de votre structure : axes, couches, niveaux, catégories et valeurs contrôlées.</p><button className="secondary-button template-download" onClick={() => downloadWorkbookTemplate(template)}><FileSpreadsheet size={16} /> Télécharger {template.filename}</button></section>
      <section className="setup-main-card"><span className="setup-step">02</span><div className="setup-icon"><Upload size={21} /></div><h2>Importer le fichier complété</h2><p>L’import remplace la source active de cette instance, après vérification des feuilles, colonnes et identifiants.</p><button className="primary-button import-button" disabled={importing || switchingSource} onClick={() => inputRef.current?.click()}><Upload size={16} /> {importing ? "Contrôle en cours…" : instance.source ? "Remplacer par un fichier Excel" : "Choisir un fichier Excel"}</button><input ref={inputRef} className="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} /></section>
    </div>
    {error && <div className="import-message error"><X size={17} /><div><strong>Import refusé</strong><span>{error}</span></div></div>}
    {warnings.map((warning) => <div className="import-message warning" key={warning}><CircleHelp size={17} /><div><strong>Point d’attention</strong><span>{warning}</span></div></div>)}
    <section className="source-overview"><div className="source-overview-copy"><p className="eyebrow">Source active</p><h2>{sourceTitle}</h2><p>{sourceDescription}</p><div className="source-actions">{instance.source?.kind !== "demo" && <button className="secondary-button" disabled={switchingSource} onClick={() => void activateDemo()}><Database size={15} /> Utiliser le jeu d’exemple</button>}{instance.source && <button className="danger-button" disabled={switchingSource} onClick={() => void clearData()}><Trash2 size={15} /> {instance.source.kind === "demo" ? "Désactiver l’exemple" : "Supprimer les données"}</button>}</div></div><div className="source-counts">{counts.map((count) => <span key={count.label}><strong>{count.value}</strong><small>{count.label}</small></span>)}</div></section>
  </div>;
}

function ViewGuideScreen({ definition, configuration }: { definition: ViewDefinition; configuration: ViewConfiguration }) {
  const template = definition.buildTemplate(configuration);
  const exampleData = configuration.exampleData ? normalizeDataset(configuration.exampleData) : null;
  const exampleCounts = exampleData ? definition.summarize(exampleData) : [];
  const sheetDescriptions = new Map(definition.guide.sheets.map((sheet) => [sheet.name, sheet.description]));
  return <div className="instance-page guide-page"><div className="guide-hero"><div><p className="eyebrow">{definition.category}</p><h1>Comment fonctionne « {definition.title} » ?</h1><p>{definition.guide.purpose}</p></div><button className="primary-button" onClick={() => downloadWorkbookTemplate(template)}><Download size={16} /> Télécharger le modèle configuré</button></div>
    <section className="guide-section"><h2>Les questions auxquelles elle répond</h2><div className="question-grid">{definition.guide.questions.map((question, index) => <article key={question}><span>0{index + 1}</span><p>{question}</p></article>)}</div></section>
    <section className="guide-section"><h2>Jeu d’exemple de cette configuration</h2><div className={`guide-example-card ${exampleData ? "available" : "empty"}`}><div><Database size={20} /><div><strong>{exampleData ? "Exemple portable inclus dans le YAML" : "Aucun jeu d’exemple inclus"}</strong><p>{exampleData ? "Cette configuration peut être partagée telle quelle : son exemple voyagera avec sa structure et pourra être activé depuis Données." : "Cette configuration décrit uniquement la structure. Ajoutez exampleData dans le YAML si vous souhaitez distribuer un exemple avec elle."}</p></div></div>{exampleCounts.length > 0 && <div className="guide-example-metrics">{exampleCounts.map((item) => <span key={item.label}><strong>{item.value}</strong><small>{item.label}</small></span>)}</div>}</div></section>
    <section className="guide-section"><h2>Préparer et charger la donnée</h2><div className="step-list">{definition.guide.steps.map((step, index) => <article key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></article>)}</div></section>
    <section className="guide-section"><h2>Classeur généré pour cette configuration</h2><p className="guide-section-intro">Les feuilles et colonnes ci-dessous sont calculées depuis la structure actuelle, pas depuis une documentation figée.</p><div className="sheet-list">{template.sheets.map((sheet) => <article key={sheet.name}><div><FileSpreadsheet size={17} /><strong>{sheet.name}</strong></div><p>{sheet.description || sheetDescriptions.get(sheet.name) || "Données attendues par cette vue."}</p><code>{sheet.columns.map((column) => column.label).join(" · ")}</code></article>)}</div></section>
  </div>;
}

function CreateViewModal({ onClose, onCreate }: { onClose: () => void; onCreate: (definition: ViewDefinition, name: string, structure: "standard" | "blank", dataMode: "empty" | "demo") => Promise<void> }) {
  const definitions = viewRegistry.list();
  const [selectedId, setSelectedId] = useState(definitions[0]?.id ?? "");
  const selected = viewRegistry.get(selectedId);
  const [name, setName] = useState(() => definitions[0] ? `${definitions[0].shortTitle} — Nouvelle analyse` : "");
  const [structure, setStructure] = useState<"standard" | "blank">("standard");
  const [dataMode, setDataMode] = useState<"empty" | "demo">("demo");
  const [saving, setSaving] = useState(false);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal create-view-modal" role="dialog" aria-modal="true" aria-label="Créer une vue"><div className="modal-header"><div><p className="eyebrow">Nouvelle analyse</p><h2>Choisir un type de vue</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="modal-body"><div className="create-definition-groups">{VIEW_CATALOG_GROUPS.map((group) => { const groupDefinitions = definitions.filter((definition) => definition.catalogGroup === group.id); if (!groupDefinitions.length) return null; return <section key={group.id}><header><div><strong>{group.label}</strong><p>{group.description}</p></div><span>{groupDefinitions.length}</span></header><div className="create-definition-grid">{groupDefinitions.map((definition) => { const Icon = iconFor(definition); return <button className={selectedId === definition.id ? "selected" : ""} key={definition.id} onClick={() => { setSelectedId(definition.id); setName(`${definition.shortTitle} — Nouvelle analyse`); }}><span className={`view-icon view-${definition.accent}`}><Icon size={20} /></span><div><strong>{definition.title}</strong><p>{definition.description}</p></div></button>; })}</div></section>; })}</div><label><span>Nom de la vue</span><input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label><div className="creation-structure-choice"><span>Structure initiale</span><div><button className={structure === "standard" ? "selected" : ""} onClick={() => setStructure("standard")}><RotateCcw size={16} /><strong>Modèle standard</strong><small>Une base prête à adapter</small></button><button className={structure === "blank" ? "selected" : ""} onClick={() => { setStructure("blank"); setDataMode("empty"); }}><FileCode2 size={16} /><strong>Page blanche</strong><small>Tout définir vous-même</small></button></div></div><div className="creation-structure-choice"><span>Données au démarrage</span><div><button className={dataMode === "demo" ? "selected" : ""} onClick={() => { setDataMode("demo"); setStructure("standard"); }}><Database size={16} /><strong>Jeu d’exemple inclus</strong><small>Activer l’exemple fourni par le YAML</small></button><button className={dataMode === "empty" ? "selected" : ""} onClick={() => setDataMode("empty")}><FileCode2 size={16} /><strong>Aucune donnée</strong><small>Importer votre fichier plus tard</small></button></div></div><div className="modal-note"><Database size={16} /><span>Le modèle standard contient son exemple dans le YAML. Il reste désactivable et ne cohabite jamais avec un fichier Excel actif.</span></div></div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={!selected || !name.trim() || saving} onClick={() => { if (!selected) return; setSaving(true); void onCreate(selected, name.trim(), structure, dataMode).finally(() => setSaving(false)); }}><Plus size={16} /> {saving ? "Création…" : "Créer la vue"}</button></div></div></div>;
}

function SettingsScreen({ theme, accent, setTheme, setAccent }: { theme: "light" | "dark"; accent: "blue" | "violet" | "emerald"; setTheme: (theme: "light" | "dark") => void; setAccent: (accent: "blue" | "violet" | "emerald") => void }) {
  return <div className="settings-screen page-screen"><div className="page-title-row"><div><p className="eyebrow">Préférences locales</p><h1>Paramètres</h1><p>Adaptez l’interface à votre environnement de travail.</p></div></div><section className="settings-card"><div><h2>Apparence</h2><p>Les vues utilisent les mêmes principes visuels que Scalengi.</p></div><div><div className="setting-group"><label>Thème</label><div className="segmented-control"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={16} /> Clair</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={16} /> Sombre</button></div></div><div className="setting-group"><label>Couleur principale</label><div className="color-options">{(["blue", "violet", "emerald"] as const).map((color) => <button className={`${color} ${accent === color ? "active" : ""}`} key={color} onClick={() => setAccent(color)} aria-label={`Couleur ${color}`} />)}</div></div></div></section><section className="settings-card"><div><h2>Stockage</h2><p>Cette version fonctionne sans serveur et sans référentiel.</p></div><div className="storage-status"><i /><div><strong>Documents locaux indépendants</strong><span>Chaque vue et ses données Excel sont conservées séparément dans IndexedDB sur cet appareil.</span></div></div></section></div>;
}
