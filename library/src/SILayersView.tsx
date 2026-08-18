"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, Boxes, ChevronDown, CircleDot, Layers3, Maximize2, Minimize2, RotateCcw, Search, Target } from "lucide-react";
import { sectionOf, type ViewConfiguration } from "./configuration";
import { useI18n } from "./i18n";
import type { ArchitectureElement, ArchitectureLayer, ArchitectureRelation, ViewDataset } from "./types";

const defaultLayerMeta: Record<string, { label: string; description: string; color: string }> = {
  "Métier": { label: "Métier", description: "Finalités, capacités et activités soutenues", color: "#7c3aed" },
  "Données": { label: "Données", description: "Informations créées, utilisées ou exposées", color: "#0284c7" },
  "Applications": { label: "Applications", description: "Solutions et services applicatifs impliqués", color: "#059669" },
  "Technologies": { label: "Technologies", description: "Socles techniques dont dépend l’exécution", color: "#d97706" },
};
const defaultLayers = Object.keys(defaultLayerMeta) as ArchitectureLayer[];
type ImpactDirection = "both" | "incoming" | "outgoing";
type ImpactInfo = { depth: number; direction: "focus" | "incoming" | "outgoing" };

function impactScope(selectedId: string | null, relations: ArchitectureRelation[], maxDepth: number, direction: ImpactDirection) {
  const scope = new Map<string, ImpactInfo>();
  if (!selectedId) return scope;
  scope.set(selectedId, { depth: 0, direction: "focus" });
  const walk = (walkDirection: "incoming" | "outgoing") => {
    let frontier = new Set([selectedId]);
    for (let depth = 1; depth <= maxDepth && frontier.size; depth += 1) {
      const next = new Set<string>();
      for (const relation of relations) {
        const origin = walkDirection === "outgoing" ? relation.sourceId : relation.targetId;
        const target = walkDirection === "outgoing" ? relation.targetId : relation.sourceId;
        if (!frontier.has(origin)) continue;
        const known = scope.get(target);
        if (!known || depth < known.depth) scope.set(target, { depth, direction: walkDirection });
        if (target !== selectedId) next.add(target);
      }
      frontier = next;
    }
  };
  if (direction !== "outgoing") walk("incoming");
  if (direction !== "incoming") walk("outgoing");
  return scope;
}

export function SILayersView({ data, configuration }: { data: ViewDataset; configuration?: ViewConfiguration }) {
  const { locale, t } = useI18n();
  const frameRef = useRef<HTMLElement>(null);
  const elements = useMemo(() => data.architectureElements ?? [], [data.architectureElements]);
  const relations = useMemo(() => data.architectureRelations ?? [], [data.architectureRelations]);
  const layerItems = sectionOf(configuration, "layers")?.items;
  const layers = useMemo(() => layerItems ? layerItems.map((item) => item.id) : defaultLayers, [layerItems]);
  const layerMeta = useMemo(() => Object.fromEntries(layers.map((layer, index) => { const configured = layerItems?.find((item) => item.id === layer); const fallback = defaultLayerMeta[layer]; return [layer, { number: String(index + 1).padStart(2, "0"), label: String(configured?.label ?? fallback?.label ?? layer), description: String(configured?.description ?? fallback?.description ?? t("Couche personnalisée")), color: String(configured?.color ?? fallback?.color ?? ["#7c3aed", "#0284c7", "#059669", "#d97706"][index % 4]) }]; })), [layerItems, layers, t]);
  const statuses = sectionOf(configuration, "statuses")?.items.map((item) => item.id) ?? ["Cible", "À renforcer", "À transformer", "À retirer"];
  const statusClass = (status: ArchitectureElement["status"]) => ["target", "strengthen", "transform", "retire"][Math.max(0, statuses.indexOf(status)) % 4] ?? "strengthen";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [domain, setDomain] = useState("all");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<ImpactDirection>("both");
  const [maxDepth, setMaxDepth] = useState(2);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);

  const domains = useMemo(() => [...new Set(elements.map((item) => item.domain).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [elements]);
  const selected = elements.find((item) => item.id === selectedId) ?? null;
  const scope = useMemo(() => impactScope(selectedId, relations, maxDepth, direction), [direction, maxDepth, relations, selectedId]);
  const filtered = useMemo(() => elements.filter((item) => (domain === "all" || item.domain === domain) && (!query || `${item.name} ${item.domain} ${item.owner} ${item.description}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")))), [domain, elements, query]);
  const visible = selected ? filtered.filter((item) => scope.has(item.id)) : filtered;
  const visibleIds = new Set(visible.map((item) => item.id));
  const visibleRelations = relations.filter((relation) => visibleIds.has(relation.sourceId) && visibleIds.has(relation.targetId));
  const selectedRelations = relations.filter((item) => item.sourceId === selectedId || item.targetId === selectedId);
  const incomingCount = [...scope.values()].filter((item) => item.direction === "incoming").length;
  const outgoingCount = [...scope.values()].filter((item) => item.direction === "outgoing").length;
  const criticalCount = visible.filter((item) => item.id !== selectedId && item.criticality === "Forte").length;
  const orphanCount = elements.filter((item) => !relations.some((relation) => relation.sourceId === item.id || relation.targetId === item.id)).length;
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };
  const clearFocus = () => setSelectedId(null);

  return <section ref={frameRef} className="view-workspace si-layers-workspace impact-layers-workspace">
    <header className="si-layers-header"><div><p className="eyebrow">{t("Analyse d’impact inter-couches")}</p><h1>{configuration?.label ?? t("SI par couches")}</h1></div><div className="si-layers-actions">
      <label className="layers-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Rechercher un point de départ")} aria-label={t("Rechercher un élément")} /></label>
      <label className="filter-control"><select value={domain} onChange={(event) => setDomain(event.target.value)} aria-label={t("Filtrer par domaine")}><option value="all">{t("Tous les domaines")}</option>{domains.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
      <button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{t(fullscreen ? "Quitter" : "Plein écran")}</span></button>
    </div></header>
    <div className="layers-summary impact-toolbar">{selected ? <><span className="impact-focus-label"><Target size={14} /><strong>{selected.name}</strong></span><div className="segmented-control" aria-label={t("Sens de l’analyse")}><button className={direction === "incoming" ? "active" : ""} onClick={() => setDirection("incoming")}><ArrowUp size={12} /> {t("Entrants")}</button><button className={direction === "both" ? "active" : ""} onClick={() => setDirection("both")}><ArrowDownUp size={12} /> {t("Les deux")}</button><button className={direction === "outgoing" ? "active" : ""} onClick={() => setDirection("outgoing")}><ArrowDown size={12} /> {t("Sortants")}</button></div><label className="impact-depth">{t("Profondeur")} <select value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))}>{[1, 2, 3, 4].map((depth) => <option key={depth} value={depth}>{depth}</option>)}</select></label><button className="impact-reset" onClick={clearFocus}><RotateCcw size={13} /> {t("Vue d’ensemble")}</button></> : <><span><Layers3 size={14} /><strong>{elements.length}</strong> {t("objets")}</span><span><ArrowDownUp size={14} /><strong>{relations.length}</strong> {t("relations")}</span><span className={orphanCount ? "warning" : ""}><Boxes size={14} /><strong>{orphanCount}</strong> {t("objets isolés")}</span><em>{t("Sélectionnez un objet pour isoler ses impacts entrants et sortants.")}</em></>}</div>
    {!elements.length ? <div className="layers-empty" data-view-export-content><Layers3 size={32} /><h2>{t("Aucune architecture chargée")}</h2><p>{t("Importez le modèle Excel pour analyser les dépendances entre les couches du SI.")}</p></div> : <div className="layers-body impact-layers-body" data-view-export-content>
      <main className="layer-stack impact-layer-stack" style={{ gridTemplateRows: `${selected ? "auto " : ""}repeat(${Math.max(1, layers.length)}, minmax(0, 1fr))` }}>{selected && <section className="impact-kpis"><article><ArrowUp size={15} /><span>{t("Entrants")}</span><strong>{incomingCount}</strong><small>{t("objets pouvant affecter le point focal")}</small></article><article><ArrowDown size={15} /><span>{t("Sortants")}</span><strong>{outgoingCount}</strong><small>{t("objets potentiellement affectés")}</small></article><article className={criticalCount ? "warning" : ""}><AlertTriangle size={15} /><span>{t("Critiques")}</span><strong>{criticalCount}</strong><small>{t("dépendances de criticité forte")}</small></article><article><CircleDot size={15} /><span>{t("Relations visibles")}</span><strong>{visibleRelations.length}</strong><small>{t("dans le périmètre analysé")}</small></article></section>}{layers.map((layer) => { const meta = layerMeta[layer]; const items = visible.filter((item) => item.layer === layer); return <section className="architecture-layer impact-layer" key={layer} style={{ "--layer-color": meta.color } as React.CSSProperties}><header><span>{meta.number}</span><div><strong>{meta.label}</strong><small>{meta.description}</small></div><em>{items.length}</em></header><div className="architecture-layer-items">{items.length ? items.map((item) => { const impact = scope.get(item.id); const directRelations = relations.filter((relation) => relation.sourceId === item.id || relation.targetId === item.id); return <button key={item.id} className={`${selectedId === item.id ? "selected " : ""}status-${statusClass(item.status)}`} onClick={() => setSelectedId(item.id)}><span className="layer-card-top"><i />{item.domain}</span><strong>{item.name}</strong><small>{item.owner || t("Responsable non défini")}</small><span className="layer-card-foot"><em>{item.status}</em><b>{directRelations.length} {locale === "fr" ? `lien${directRelations.length > 1 ? "s" : ""}` : `link${directRelations.length === 1 ? "" : "s"}`}</b></span>{impact && impact.direction !== "focus" && <span className={`impact-badge ${impact.direction}`}><b>{t(impact.direction === "incoming" ? "Entrant" : "Sortant")}</b> · {t("niveau")} {impact.depth}</span>}{impact?.direction === "focus" && <span className="impact-badge focus"><Target size={10} /> {t("Point focal")}</span>}</button>; }) : <div className="architecture-layer-empty">{t(selected ? "Aucun objet dans le périmètre d’impact" : "Aucun élément avec ces filtres")}</div>}</div></section>; })}</main>
      <aside className="layer-detail impact-detail">{selected ? <><div className="layer-detail-heading" style={{ "--layer-color": layerMeta[selected.layer]?.color ?? "#2563eb" } as React.CSSProperties}><span>{t("Point focal")} · {layerMeta[selected.layer]?.label ?? selected.layer}</span><h2>{selected.name}</h2><p>{selected.description || t("Aucune description renseignée.")}</p></div><div className="layer-detail-facts"><div><span>{t("Statut")}</span><strong className={`status-${statusClass(selected.status)}`}>{selected.status}</strong></div><div><span>{t("Criticité")}</span><strong>{selected.criticality}</strong></div><div><span>{t("Domaine")}</span><strong>{selected.domain}</strong></div><div><span>{t("Responsable")}</span><strong>{selected.owner || t("Non défini")}</strong></div></div><section><div className="layer-detail-section-title"><strong>{t("Relations directes")}</strong><em>{selectedRelations.length}</em></div><div className="layer-relation-list">{selectedRelations.length ? selectedRelations.map((relation) => { const incoming = relation.targetId === selected.id; const otherId = incoming ? relation.sourceId : relation.targetId; const other = elements.find((item) => item.id === otherId); if (!other) return null; return <button key={relation.id} onClick={() => setSelectedId(other.id)}><span className={incoming ? "incoming" : "outgoing"}>{incoming ? `${t("Entrant").toUpperCase()} → ${t("Point focal").toUpperCase()}` : `${t("Point focal").toUpperCase()} → ${t("Sortant").toUpperCase()}`}</span><strong>{other.name}</strong><small>{layerMeta[other.layer]?.label ?? other.layer} · {relation.relation}</small></button>; }) : <p>{t("Aucune relation documentée pour cet élément.")}</p>}</div></section><section className="impact-reading-help"><strong>{t("Comment lire cette analyse ?")}</strong><p>{t("« Entrant » remonte vers les objets qui atteignent le point focal selon le sens des relations. « Sortant » suit les relations depuis le point focal vers les objets susceptibles d’être affectés.")}</p></section></> : <div className="layer-detail-placeholder"><Target size={24} /><strong>{t("Choisissez le point de départ")}</strong><span>{t("La vue isolera sa chaîne d’impact, couche par couche, avec le sens et la profondeur de chaque dépendance.")}</span></div>}</aside>
    </div>}
  </section>;
}
