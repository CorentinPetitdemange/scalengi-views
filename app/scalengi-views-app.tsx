"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Boxes, CheckCircle2, CircleHelp, Database, Download, FileSpreadsheet, GalleryVerticalEnd, LayoutDashboard, MapPinned, Moon, PanelLeftClose, PanelLeftOpen, Plus, Settings, Sun, Upload, Users, X } from "lucide-react";
import { viewRegistry, type ViewDefinition } from "../library/src";
import { listViewInstances, saveViewInstance, type ViewInstance } from "./view-instance-store";

type Screen = "catalog" | "instance" | "settings";
type InstanceTab = "view" | "data" | "guide";
const SETTINGS_KEY = "scalengi-view-settings-v1";

const now = () => new Date().toISOString();
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `view-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const iconFor = (definition: ViewDefinition) => definition.icon === "users" ? Users : definition.icon === "map" ? MapPinned : Boxes;
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const demoName = (definition: ViewDefinition) => definition.id === "urban-pos" ? "POS urbain — Démonstration" : definition.id === "pos" ? "Capacités fonctionnelles — Démonstration" : "Collaboration — Démonstration";

function demoInstances(definitions = viewRegistry.list()): ViewInstance[] {
  const createdAt = now();
  return definitions.map((definition) => ({
    id: makeId(), type: definition.id, name: demoName(definition),
    data: definition.createDemoData(), createdAt, updatedAt: createdAt,
  }));
}

export function ScalengiViewsApp() {
  const [screen, setScreen] = useState<Screen>("catalog");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [instanceTab, setInstanceTab] = useState<InstanceTab>("view");
  const [instances, setInstances] = useState<ViewInstance[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState<"blue" | "violet" | "emerald">("blue");
  const [ready, setReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        try {
          const settings = localStorage.getItem(SETTINGS_KEY);
          if (settings) {
            const parsed = JSON.parse(settings) as { theme?: typeof theme; accent?: typeof accent };
            if (parsed.theme) setTheme(parsed.theme);
            if (parsed.accent) setAccent(parsed.accent);
          }
        } catch { /* Les préférences sont facultatives. */ }
        let stored = await listViewInstances();
        if (!stored.length) {
          stored = demoInstances();
          await Promise.all(stored.map(saveViewInstance));
        } else {
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
    if (ready) localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, accent }));
  }, [accent, ready, theme]);

  const activeInstance = instances.find((item) => item.id === activeId) ?? null;
  const activeDefinition = activeInstance ? viewRegistry.get(activeInstance.type) ?? null : null;
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 2800); };
  const openInstance = (id: string, tab: InstanceTab = "view") => { setActiveId(id); setInstanceTab(tab); setScreen("instance"); };
  const saveInstance = async (instance: ViewInstance) => {
    setInstances((current) => [instance, ...current.filter((item) => item.id !== instance.id)]);
    await saveViewInstance(instance);
  };
  const createInstance = async (definition: ViewDefinition, name: string) => {
    const createdAt = now();
    const instance: ViewInstance = { id: makeId(), type: definition.id, name, data: definition.createEmptyData(), createdAt, updatedAt: createdAt };
    await saveInstance(instance);
    setCreateOpen(false);
    openInstance(instance.id, "data");
    flash("Vue créée — ajoutez maintenant son fichier Excel");
  };

  const title = screen === "settings" ? "Paramètres" : screen === "instance" && activeInstance ? activeInstance.name : "Mes vues";
  return (
    <div className={`app-shell theme-${theme} accent-${accent} ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="brand-row"><div className="brand-mark">S</div>{!collapsed && <div className="brand-copy"><strong>scalengi</strong><span>Views</span></div>}<button className="icon-button collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Ouvrir le menu" : "Réduire le menu"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
        <nav className="main-navigation" aria-label="Navigation principale">
          <button className={screen === "catalog" ? "active" : ""} onClick={() => setScreen("catalog")} title="Mes vues"><GalleryVerticalEnd /><span>Mes vues</span><em>{instances.length}</em></button>
          <button className="new-view-nav" onClick={() => setCreateOpen(true)} title="Créer une vue"><Plus /><span>Nouvelle vue</span></button>
          {!collapsed && instances.length > 0 && <div className="sidebar-view-list"><label>VUES LOCALES</label>{instances.map((instance) => { const definition = viewRegistry.get(instance.type); const Icon = definition ? iconFor(definition) : LayoutDashboard; return <button key={instance.id} className={screen === "instance" && instance.id === activeId ? "active" : ""} onClick={() => openInstance(instance.id)}><Icon /><span>{instance.name}</span></button>; })}</div>}
          <button className={screen === "settings" ? "active" : ""} onClick={() => setScreen("settings")} title="Paramètres"><Settings /><span>Paramètres</span></button>
        </nav>
        {!collapsed && <div className="sidebar-context"><span>STOCKAGE PAR VUE</span><div><i /> Mode local actif</div><small>Chaque vue possède ses propres données sur cet appareil.</small></div>}
        <div className="sidebar-footer"><div className="user-avatar">CM</div>{!collapsed && <div><strong>Espace de démonstration</strong><span>Version locale · 0.2</span></div>}</div>
      </aside>

      <main className="app-main">
        <header className="topbar"><div className="breadcrumb">{screen !== "catalog" && <button className="icon-button" onClick={() => setScreen("catalog")} aria-label="Retour aux vues"><ArrowLeft size={17} /></button>}<LayoutDashboard size={16} /><span>/</span><strong>{title}</strong></div><div className="topbar-actions">{activeInstance && screen === "instance" && <button className="data-status" onClick={() => setInstanceTab("data")}><i /> {activeInstance.source ? activeInstance.source.filename : "Données à ajouter"}</button>}<button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Changer de thème">{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button></div></header>
        <div className="screen-content">
          {!ready && <div className="loading-state">Chargement des vues locales…</div>}
          {ready && screen === "catalog" && <ViewCatalog instances={instances} onOpen={openInstance} onCreate={() => setCreateOpen(true)} />}
          {ready && screen === "instance" && activeInstance && activeDefinition && <InstanceWorkspace instance={activeInstance} definition={activeDefinition} tab={instanceTab} onTab={setInstanceTab} onSave={saveInstance} onFlash={flash} />}
          {ready && screen === "settings" && <SettingsScreen theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} />}
        </div>
      </main>
      {createOpen && <CreateViewModal onClose={() => setCreateOpen(false)} onCreate={createInstance} />}
      {toast && <div className="toast-message"><span>✓</span>{toast}</div>}
    </div>
  );
}

function ViewCatalog({ instances, onOpen, onCreate }: { instances: ViewInstance[]; onOpen: (id: string) => void; onCreate: () => void }) {
  return <div className="catalog-screen">
    <section className="catalog-hero"><div><p className="eyebrow">Espace de travail local</p><h1>Une vue, une question,<br /><span>ses propres données.</span></h1><p>Créez plusieurs analyses indépendantes. Chaque vue garde son fichier source et son contexte, sans imposer de référentiel global.</p></div><div className="hero-metrics"><div><strong>{instances.length}</strong><span>vues créées</span></div><div><strong>{instances.filter((item) => item.source).length}</strong><span>fichiers liés</span></div><div><strong>{viewRegistry.list().length}</strong><span>types de vues</span></div></div></section>
    <div className="section-heading"><div><h2>Mes vues</h2><p>Vos analyses enregistrées sur cet appareil.</p></div><button className="primary-button" onClick={onCreate}><Plus size={16} /> Nouvelle vue</button></div>
    <div className="instance-grid">{instances.map((instance) => { const definition = viewRegistry.get(instance.type); if (!definition) return null; const Icon = iconFor(definition); return <button className={`instance-card view-${definition.accent}`} key={instance.id} onClick={() => onOpen(instance.id)}><span className="view-icon"><Icon size={21} /></span><div><p className="eyebrow">{definition.shortTitle}</p><h3>{instance.name}</h3><p>{instance.source ? `Source : ${instance.source.filename}` : "Aucun fichier Excel lié"}</p></div><span className={instance.source ? "instance-state ready" : "instance-state"}>{instance.source ? "Données prêtes" : "À alimenter"}</span><small>Mis à jour {formatDate(instance.updatedAt)}</small></button>; })}</div>
    <div className="section-heading catalog-library-heading"><div><h2>Catalogue de vues</h2><p>Choisissez un type pour créer une nouvelle instance indépendante.</p></div><span>{viewRegistry.list().length} disponibles</span></div>
    <div className="view-card-grid compact-view-cards">{viewRegistry.list().map((definition) => { const Icon = iconFor(definition); return <button className={`view-card view-${definition.accent}`} key={definition.id} onClick={onCreate}><div className="view-card-top"><span className="view-icon"><Icon size={23} /></span><span className="available-chip"><i /> Disponible</span></div><p className="eyebrow">{definition.category}</p><h3>{definition.title}</h3><p>{definition.description}</p><div className="insight-tags">{definition.insights.map((item) => <span key={item}>{item}</span>)}</div><div className="view-card-action">Créer cette vue <span>→</span></div></button>; })}</div>
  </div>;
}

function InstanceWorkspace({ instance, definition, tab, onTab, onSave, onFlash }: { instance: ViewInstance; definition: ViewDefinition; tab: InstanceTab; onTab: (tab: InstanceTab) => void; onSave: (instance: ViewInstance) => Promise<void>; onFlash: (message: string) => void }) {
  const ViewComponent = definition.component;
  return <div className="instance-workspace">
    <div className="instance-tabs"><div><span className={`mini-view-icon view-${definition.accent}`}>{definition.icon === "users" ? <Users size={15} /> : definition.icon === "map" ? <MapPinned size={15} /> : <Boxes size={15} />}</span><strong>{instance.name}</strong></div><nav aria-label="Menu de la vue"><button className={tab === "view" ? "active" : ""} onClick={() => onTab("view")}><LayoutDashboard size={15} /> Vue</button><button className={tab === "data" ? "active" : ""} onClick={() => onTab("data")}><Database size={15} /> Données</button><button className={tab === "guide" ? "active" : ""} onClick={() => onTab("guide")}><CircleHelp size={15} /> Comment ça fonctionne</button></nav></div>
    {tab === "view" && <ViewComponent data={instance.data} />}
    {tab === "data" && <InstanceDataScreen instance={instance} definition={definition} onSave={onSave} onFlash={onFlash} />}
    {tab === "guide" && <ViewGuideScreen definition={definition} />}
  </div>;
}

function InstanceDataScreen({ instance, definition, onSave, onFlash }: { instance: ViewInstance; definition: ViewDefinition; onSave: (instance: ViewInstance) => Promise<void>; onFlash: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const counts = useMemo(() => definition.id === "pos"
    ? [{ label: "Capacités", value: instance.data.capabilities.length }, { label: "Applications", value: instance.data.applications.length }]
    : definition.id === "urban-pos"
      ? [{ label: "Zones", value: instance.data.urbanZones.length }, { label: "Quartiers", value: instance.data.urbanDistricts.length }, { label: "Îlots", value: instance.data.urbanBlocks.length }, { label: "Applications", value: instance.data.applications.length }]
      : [{ label: "Collaborateurs", value: instance.data.collaborators.length }, { label: "Processus", value: instance.data.processes.length }, { label: "Responsabilités", value: instance.data.responsibilities.length }, { label: "Retours", value: instance.data.feedbacks?.length ?? 0 }], [definition.id, instance.data]);
  const handleFile = async (file?: File) => {
    if (!file) return;
    setImporting(true); setError(null); setWarnings([]);
    try {
      const result = await definition.importExcel(file);
      const importedAt = now();
      await onSave({ ...instance, data: result.data, updatedAt: importedAt, source: { kind: "excel", filename: file.name, importedAt, rowCount: result.rowCount } });
      setWarnings(result.warnings);
      onFlash(`${result.rowCount} lignes importées dans cette vue`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le fichier Excel n’a pas pu être lu.");
    } finally { setImporting(false); }
  };
  return <div className="instance-page data-setup-page">
    <div className="page-title-row"><div><p className="eyebrow">Données de cette vue uniquement</p><h1>Alimenter « {instance.name} »</h1><p>Le classeur est lu localement puis enregistré dans cette vue. Il n’alimente aucune autre analyse.</p></div>{instance.source && <span className="source-badge"><CheckCircle2 size={15} /> Source liée</span>}</div>
    <div className="data-setup-grid"><section className="setup-main-card"><span className="setup-step">01</span><div className="setup-icon"><Download size={21} /></div><h2>Télécharger le modèle standard</h2><p>Le classeur contient exactement les feuilles, les titres de colonnes et les valeurs contrôlées nécessaires à cette vue.</p><a className="secondary-button template-download" href={definition.template.url} download={definition.template.filename}><FileSpreadsheet size={16} /> Télécharger {definition.template.filename}</a></section>
      <section className="setup-main-card"><span className="setup-step">02</span><div className="setup-icon"><Upload size={21} /></div><h2>Importer le fichier complété</h2><p>L’import remplace les données de cette instance seulement, après vérification des feuilles, colonnes et identifiants.</p><button className="primary-button import-button" disabled={importing} onClick={() => inputRef.current?.click()}><Upload size={16} /> {importing ? "Contrôle en cours…" : instance.source ? "Remplacer le fichier" : "Choisir un fichier Excel"}</button><input ref={inputRef} className="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} /></section>
    </div>
    {error && <div className="import-message error"><X size={17} /><div><strong>Import refusé</strong><span>{error}</span></div></div>}
    {warnings.map((warning) => <div className="import-message warning" key={warning}><CircleHelp size={17} /><div><strong>Point d’attention</strong><span>{warning}</span></div></div>)}
    <section className="source-overview"><div><p className="eyebrow">État de la source</p><h2>{instance.source ? instance.source.filename : "Aucun fichier importé"}</h2><p>{instance.source ? `Importé le ${formatDate(instance.source.importedAt)} · ${instance.source.rowCount} lignes utiles` : "Téléchargez le modèle, remplissez-le puis importez-le dans cette vue."}</p></div><div className="source-counts">{counts.map((count) => <span key={count.label}><strong>{count.value}</strong><small>{count.label}</small></span>)}</div></section>
  </div>;
}

function ViewGuideScreen({ definition }: { definition: ViewDefinition }) {
  return <div className="instance-page guide-page"><div className="guide-hero"><div><p className="eyebrow">{definition.category}</p><h1>Comment fonctionne la {definition.title.toLocaleLowerCase("fr")} ?</h1><p>{definition.guide.purpose}</p></div><a className="primary-button" href={definition.template.url} download={definition.template.filename}><Download size={16} /> Télécharger le modèle</a></div>
    <section className="guide-section"><h2>Les questions auxquelles elle répond</h2><div className="question-grid">{definition.guide.questions.map((question, index) => <article key={question}><span>0{index + 1}</span><p>{question}</p></article>)}</div></section>
    <section className="guide-section"><h2>Préparer et charger la donnée</h2><div className="step-list">{definition.guide.steps.map((step, index) => <article key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></article>)}</div></section>
    <section className="guide-section"><h2>Structure du classeur</h2><div className="sheet-list">{definition.guide.sheets.map((sheet) => <article key={sheet.name}><div><FileSpreadsheet size={17} /><strong>{sheet.name}</strong></div><p>{sheet.description}</p><code>{sheet.columns.join(" · ")}</code></article>)}</div></section>
  </div>;
}

function CreateViewModal({ onClose, onCreate }: { onClose: () => void; onCreate: (definition: ViewDefinition, name: string) => Promise<void> }) {
  const definitions = viewRegistry.list();
  const [selectedId, setSelectedId] = useState(definitions[0]?.id ?? "");
  const selected = viewRegistry.get(selectedId);
  const [name, setName] = useState(() => definitions[0] ? `${definitions[0].shortTitle} — Nouvelle analyse` : "");
  const [saving, setSaving] = useState(false);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal create-view-modal" role="dialog" aria-modal="true" aria-label="Créer une vue"><div className="modal-header"><div><p className="eyebrow">Nouvelle analyse</p><h2>Choisir un type de vue</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="modal-body"><div className="create-definition-grid">{definitions.map((definition) => { const Icon = iconFor(definition); return <button className={selectedId === definition.id ? "selected" : ""} key={definition.id} onClick={() => { setSelectedId(definition.id); setName(`${definition.shortTitle} — Nouvelle analyse`); }}><span className={`view-icon view-${definition.accent}`}><Icon size={20} /></span><div><strong>{definition.title}</strong><p>{definition.description}</p></div></button>; })}</div><label><span>Nom de la vue</span><input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label><div className="modal-note"><Database size={16} /><span>Cette vue aura son propre jeu de données local. Vous pourrez ensuite télécharger son modèle Excel et l’importer.</span></div></div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={!selected || !name.trim() || saving} onClick={() => { if (!selected) return; setSaving(true); void onCreate(selected, name.trim()).finally(() => setSaving(false)); }}><Plus size={16} /> {saving ? "Création…" : "Créer la vue"}</button></div></div></div>;
}

function SettingsScreen({ theme, accent, setTheme, setAccent }: { theme: "light" | "dark"; accent: "blue" | "violet" | "emerald"; setTheme: (theme: "light" | "dark") => void; setAccent: (accent: "blue" | "violet" | "emerald") => void }) {
  return <div className="settings-screen page-screen"><div className="page-title-row"><div><p className="eyebrow">Préférences locales</p><h1>Paramètres</h1><p>Adaptez l’interface à votre environnement de travail.</p></div></div><section className="settings-card"><div><h2>Apparence</h2><p>Les vues utilisent les mêmes principes visuels que Scalengi.</p></div><div><div className="setting-group"><label>Thème</label><div className="segmented-control"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={16} /> Clair</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={16} /> Sombre</button></div></div><div className="setting-group"><label>Couleur principale</label><div className="color-options">{(["blue", "violet", "emerald"] as const).map((color) => <button className={`${color} ${accent === color ? "active" : ""}`} key={color} onClick={() => setAccent(color)} aria-label={`Couleur ${color}`} />)}</div></div></div></section><section className="settings-card"><div><h2>Stockage</h2><p>Cette version fonctionne sans serveur et sans référentiel.</p></div><div className="storage-status"><i /><div><strong>Documents locaux indépendants</strong><span>Chaque vue et ses données Excel sont conservées séparément dans IndexedDB sur cet appareil.</span></div></div></section></div>;
}
