"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppWindow, ArrowLeft, Boxes, Database, Download, GalleryVerticalEnd, Import, LayoutDashboard, Moon, Network, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Settings, Sun, Users, X } from "lucide-react";
import { CollaboratorJourneyView, PosView, sampleDataset, type Application, type Capability, type Collaborator, type Process, type Responsibility, type ViewDataset } from "../library/src";

type Screen = "catalog" | "collaborators" | "pos" | "data" | "settings";
type EntityType = "collaborator" | "process" | "responsibility" | "capability" | "application";
const STORAGE_KEY = "scalengi-view-dataset-v1";
const SETTINGS_KEY = "scalengi-view-settings-v1";

const viewCards = [
  { id: "collaborators" as const, eyebrow: "Organisation", title: "Vue Collaborateurs", description: "Comprendre l’environnement d’un collaborateur, ses responsabilités, ses processus et ses relations de travail.", icon: Users, accent: "violet", insights: ["Responsabilités", "Processus partagés", "Réseau de collaboration"] },
  { id: "pos" as const, eyebrow: "Architecture d’entreprise", title: "Plan d’occupation du sol", description: "Lire la couverture fonctionnelle du SI, identifier les fragilités et les capacités non couvertes.", icon: Boxes, accent: "blue", insights: ["Couverture", "Santé applicative", "Maturité"] },
];

function cloneSampleData(): ViewDataset { return JSON.parse(JSON.stringify(sampleDataset)) as ViewDataset; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

export function ScalengiViewsApp() {
  const [screen, setScreen] = useState<Screen>("catalog");
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState<"blue" | "violet" | "emerald">("blue");
  const [dataset, setDataset] = useState<ViewDataset>(cloneSampleData);
  const [ready, setReady] = useState(false);
  const [addType, setAddType] = useState<EntityType | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const settings = localStorage.getItem(SETTINGS_KEY);
      if (stored) setDataset(JSON.parse(stored) as ViewDataset);
      if (settings) {
        const parsed = JSON.parse(settings) as { theme?: "light" | "dark"; accent?: "blue" | "violet" | "emerald" };
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.accent) setAccent(parsed.accent);
      }
    } catch { setDataset(cloneSampleData()); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, accent }));
  }, [accent, dataset, ready, theme]);

  const title = useMemo(() => ({ catalog: "Bibliothèque de vues", collaborators: "Vue Collaborateurs", pos: "Plan d’occupation du sol", data: "Données", settings: "Paramètres" })[screen], [screen]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 2800); };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ViewDataset;
      if (!Array.isArray(parsed.collaborators) || !Array.isArray(parsed.capabilities)) throw new Error("Format invalide");
      setDataset(parsed); flash("Jeu de données importé");
    } catch { flash("Import impossible : utilisez un export Scalengi Views au format JSON"); }
  };
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "scalengi-views-data.json"; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className={`app-shell theme-${theme} accent-${accent} ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="brand-row"><div className="brand-mark">S</div>{!collapsed && <div className="brand-copy"><strong>scalengi</strong><span>Views</span></div>}<button className="icon-button collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Ouvrir le menu" : "Réduire le menu"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
        <nav className="main-navigation" aria-label="Navigation principale">
          <button className={screen === "catalog" ? "active" : ""} onClick={() => setScreen("catalog")} title="Vues"><GalleryVerticalEnd /><span>Vues</span></button>
          <button className={screen === "data" ? "active" : ""} onClick={() => setScreen("data")} title="Données"><Database /><span>Données</span><em>{dataset.capabilities.length + dataset.collaborators.length}</em></button>
          <button className={screen === "settings" ? "active" : ""} onClick={() => setScreen("settings")} title="Paramètres"><Settings /><span>Paramètres</span></button>
        </nav>
        {!collapsed && <div className="sidebar-context"><span>ESPACE LOCAL</span><div><i /> Données enregistrées</div><small>Vos données restent dans ce navigateur.</small></div>}
        <div className="sidebar-footer"><div className="user-avatar">CM</div>{!collapsed && <div><strong>Espace de démonstration</strong><span>Version locale · 0.1</span></div>}</div>
      </aside>

      <main className="app-main">
        <header className="topbar"><div className="breadcrumb">{screen !== "catalog" && <button className="icon-button" onClick={() => setScreen("catalog")} aria-label="Retour aux vues"><ArrowLeft size={17} /></button>}<LayoutDashboard size={16} /><span>/</span><strong>{title}</strong></div><div className="topbar-actions"><button className="data-status" onClick={() => setScreen("data")}><i /> Données locales</button><button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Changer de thème">{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button></div></header>
        <div className="screen-content">
          {screen === "catalog" && <ViewCatalog onOpen={setScreen} dataset={dataset} />}
          {screen === "collaborators" && <CollaboratorJourneyView data={dataset} />}
          {screen === "pos" && <PosView data={dataset} />}
          {screen === "data" && <DataManager data={dataset} onAdd={setAddType} onImport={() => fileRef.current?.click()} onExport={exportData} onReset={() => { setDataset(cloneSampleData()); flash("Données de démonstration restaurées"); }} />}
          {screen === "settings" && <SettingsScreen theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} />}
        </div>
      </main>
      <input ref={fileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { void handleImport(event.target.files?.[0]); event.target.value = ""; }} />
      {addType && <AddDataModal type={addType} data={dataset} onClose={() => setAddType(null)} onSave={(next) => { setDataset(next); setAddType(null); flash("Donnée ajoutée"); }} />}
      {toast && <div className="toast-message"><span>✓</span>{toast}</div>}
    </div>
  );
}

function ViewCatalog({ onOpen, dataset }: { onOpen: (screen: Screen) => void; dataset: ViewDataset }) {
  return <div className="catalog-screen">
    <section className="catalog-hero"><div><p className="eyebrow">Bibliothèque de vues</p><h1>Comprendre le SI.<br /><span>Décider avec le bon point de vue.</span></h1><p>Sélectionnez une vue spécialisée. Chaque vue transforme votre référentiel en lecture directement exploitable.</p></div><div className="hero-metrics"><div><strong>2</strong><span>vues disponibles</span></div><div><strong>{dataset.capabilities.length}</strong><span>capacités</span></div><div><strong>{dataset.collaborators.length}</strong><span>collaborateurs</span></div></div></section>
    <div className="section-heading"><div><h2>Vues disponibles</h2><p>Des lectures spécialisées, conçues pour répondre à une question précise.</p></div><span>2 vues</span></div>
    <div className="view-card-grid">{viewCards.map((view) => { const Icon = view.icon; return <button className={`view-card view-${view.accent}`} key={view.id} onClick={() => onOpen(view.id)}><div className="view-card-top"><span className="view-icon"><Icon size={23} /></span><span className="available-chip"><i /> Disponible</span></div><p className="eyebrow">{view.eyebrow}</p><h3>{view.title}</h3><p>{view.description}</p><div className="insight-tags">{view.insights.map((item) => <span key={item}>{item}</span>)}</div><div className="view-card-action">Ouvrir la vue <span>→</span></div></button>; })}</div>
    <section className="data-callout"><div className="callout-icon"><Database size={22} /></div><div><strong>Vos vues utilisent le jeu de données local</strong><p>Ajoutez vos collaborateurs, processus, capacités et applications sans modifier Scalengi.</p></div><button onClick={() => onOpen("data")}>Gérer les données</button></section>
  </div>;
}

function DataManager({ data, onAdd, onImport, onExport, onReset }: { data: ViewDataset; onAdd: (type: EntityType) => void; onImport: () => void; onExport: () => void; onReset: () => void }) {
  const entities = [
    { type: "collaborator" as const, label: "Collaborateurs", count: data.collaborators.length, icon: Users, description: "Personnes et fonctions" },
    { type: "process" as const, label: "Processus", count: data.processes.length, icon: Network, description: "Processus liés aux responsabilités" },
    { type: "responsibility" as const, label: "Responsabilités", count: data.responsibilities.length, icon: GalleryVerticalEnd, description: "Rôles dans les processus" },
    { type: "capability" as const, label: "Capacités", count: data.capabilities.length, icon: Boxes, description: "Découpage fonctionnel du POS" },
    { type: "application" as const, label: "Applications", count: data.applications.length, icon: AppWindow, description: "Couverture et santé applicative" },
  ];
  return <div className="data-screen page-screen"><div className="page-title-row"><div><p className="eyebrow">Référentiel local</p><h1>Données</h1><p>Alimentez les vues avec un jeu de données autonome, enregistré dans votre navigateur.</p></div><div className="button-row"><button className="secondary-button" onClick={onImport}><Import size={16} /> Importer JSON</button><button className="secondary-button" onClick={onExport}><Download size={16} /> Exporter</button></div></div>
    <div className="entity-grid">{entities.map((entity) => { const Icon = entity.icon; return <article className="entity-card" key={entity.type}><span className="entity-icon"><Icon size={20} /></span><div><strong>{entity.label}</strong><p>{entity.description}</p></div><em>{entity.count}</em><button onClick={() => onAdd(entity.type)}><Plus size={15} /> Ajouter</button></article>; })}</div>
    <section className="dataset-overview"><div className="section-heading"><div><h2>Aperçu du référentiel</h2><p>Les dernières données utilisées par vos vues.</p></div><button className="text-button" onClick={onReset}><RotateCcw size={15} /> Restaurer la démo</button></div><div className="table-wrapper"><table><thead><tr><th>Objet</th><th>Type</th><th>Information principale</th><th>État</th></tr></thead><tbody>{data.capabilities.slice(0, 4).map((capability) => <tr key={capability.id}><td><strong>{capability.name}</strong></td><td>Capacité</td><td>{capability.domain}</td><td><span className="table-status">Maturité {capability.maturity}/5</span></td></tr>)}{data.applications.slice(0, 3).map((app) => <tr key={app.id}><td><strong>{app.name}</strong></td><td>Application</td><td>{app.lifecycle}</td><td><span className={`table-status status-${app.health}`}>{app.health === "healthy" ? "Sain" : app.health === "watch" ? "À surveiller" : "Critique"}</span></td></tr>)}</tbody></table></div></section>
  </div>;
}

function SettingsScreen({ theme, accent, setTheme, setAccent }: { theme: "light" | "dark"; accent: "blue" | "violet" | "emerald"; setTheme: (theme: "light" | "dark") => void; setAccent: (accent: "blue" | "violet" | "emerald") => void }) {
  return <div className="settings-screen page-screen"><div className="page-title-row"><div><p className="eyebrow">Préférences locales</p><h1>Paramètres</h1><p>Adaptez l’interface à votre environnement de travail.</p></div></div><section className="settings-card"><div><h2>Apparence</h2><p>Les vues utilisent les mêmes principes visuels que Scalengi.</p></div><div><div className="setting-group"><label>Thème</label><div className="segmented-control"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={16} /> Clair</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={16} /> Sombre</button></div></div><div className="setting-group"><label>Couleur principale</label><div className="color-options">{(["blue", "violet", "emerald"] as const).map((color) => <button className={`${color} ${accent === color ? "active" : ""}`} key={color} onClick={() => setAccent(color)} aria-label={`Couleur ${color}`} />)}</div></div></div></section><section className="settings-card"><div><h2>Stockage</h2><p>Cette première version fonctionne sans serveur.</p></div><div className="storage-status"><i /><div><strong>Stockage local actif</strong><span>Les données restent sur cet appareil et peuvent être exportées en JSON.</span></div></div></section></div>;
}

function AddDataModal({ type, data, onClose, onSave }: { type: EntityType; data: ViewDataset; onClose: () => void; onSave: (data: ViewDataset) => void }) {
  const [name, setName] = useState(""); const [secondary, setSecondary] = useState(""); const [third, setThird] = useState("");
  const labels: Record<EntityType, string> = { collaborator: "un collaborateur", process: "un processus", responsibility: "une responsabilité", capability: "une capacité", application: "une application" };
  const save = () => {
    const id = `${type}-${Date.now()}`; const next = JSON.parse(JSON.stringify(data)) as ViewDataset;
    if (type === "collaborator") next.collaborators.push({ id, name, role: secondary || "Fonction à préciser", initials: initials(name) } satisfies Collaborator);
    if (type === "process") next.processes.push({ id, name, status: (secondary || "Actif") as Process["status"] } satisfies Process);
    if (type === "responsibility") next.responsibilities.push({ id, collaboratorId: name, processId: secondary, kind: (third || "Contributeur") as Responsibility["kind"] } satisfies Responsibility);
    if (type === "capability") next.capabilities.push({ id, name, domain: secondary || "Autre", maturity: Number(third) || 1, criticality: "Moyenne", owner: "À définir", applicationIds: [] } satisfies Capability);
    if (type === "application") { next.applications.push({ id, name, health: (secondary || "healthy") as Application["health"], lifecycle: "Maintenir" } satisfies Application); const capability = next.capabilities.find((item) => item.id === third); if (capability) capability.applicationIds.push(id); }
    onSave(next);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={`Ajouter ${labels[type]}`}><div className="modal-header"><div><p className="eyebrow">Nouvelle donnée</p><h2>Ajouter {labels[type]}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="modal-body">
    <label><span>{type === "responsibility" ? "Collaborateur" : "Nom"}</span>{type === "responsibility" ? <select value={name} onChange={(event) => setName(event.target.value)}><option value="">Sélectionner…</option>{data.collaborators.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select> : <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={type === "application" ? "Ex. CRM Client" : "Saisir un nom"} />}</label>
    {type === "collaborator" && <label><span>Fonction</span><input value={secondary} onChange={(event) => setSecondary(event.target.value)} placeholder="Ex. Architecte d’entreprise" /></label>}
    {type === "process" && <label><span>État</span><select value={secondary} onChange={(event) => setSecondary(event.target.value)}><option>Actif</option><option>À revoir</option><option>En transformation</option></select></label>}
    {type === "responsibility" && <><label><span>Processus</span><select value={secondary} onChange={(event) => setSecondary(event.target.value)}><option value="">Sélectionner…</option>{data.processes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Rôle</span><select value={third} onChange={(event) => setThird(event.target.value)}><option>Pilote</option><option>Contributeur</option><option>Validation</option><option>Consulté</option></select></label></>}
    {type === "capability" && <><label><span>Domaine</span><input value={secondary} onChange={(event) => setSecondary(event.target.value)} placeholder="Ex. Opérations" /></label><label><span>Maturité</span><select value={third} onChange={(event) => setThird(event.target.value)}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label></>}
    {type === "application" && <><label><span>Santé</span><select value={secondary} onChange={(event) => setSecondary(event.target.value)}><option value="healthy">Sain</option><option value="watch">À surveiller</option><option value="critical">Critique</option></select></label><label><span>Capacité couverte</span><select value={third} onChange={(event) => setThird(event.target.value)}><option value="">Aucune pour le moment</option>{data.capabilities.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></>}
  </div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={!name || (type === "responsibility" && !secondary)} onClick={save}><Plus size={16} /> Ajouter</button></div></div></div>;
}
