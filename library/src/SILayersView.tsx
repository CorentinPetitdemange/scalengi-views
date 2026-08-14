"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownUp, Boxes, ChevronDown, Layers3, Maximize2, Minimize2, Search, Target } from "lucide-react";
import { sectionOf, type ViewConfiguration } from "./configuration";
import type { ArchitectureElement, ArchitectureLayer, ViewDataset } from "./types";

const defaultLayerMeta: Record<string, { number: string; label: string; description: string; color: string }> = {
  "Métier": { number: "01", label: "Métier", description: "Ce que l’organisation doit savoir faire", color: "#7c3aed" },
  "Données": { number: "02", label: "Données", description: "Les objets d’information structurants", color: "#0284c7" },
  "Applications": { number: "03", label: "Applications", description: "Les solutions qui réalisent les capacités", color: "#059669" },
  "Technologies": { number: "04", label: "Technologies", description: "Les socles qui exécutent et relient le SI", color: "#d97706" },
};
const defaultLayers = Object.keys(defaultLayerMeta) as ArchitectureLayer[];

export function SILayersView({ data, configuration }: { data: ViewDataset; configuration?: ViewConfiguration }) {
  const frameRef = useRef<HTMLElement>(null);
  const elements = useMemo(() => data.architectureElements ?? [], [data.architectureElements]);
  const relations = useMemo(() => data.architectureRelations ?? [], [data.architectureRelations]);
  const layerItems = sectionOf(configuration, "layers")?.items;
  const layers = useMemo(() => layerItems ? layerItems.map((item) => item.id) : defaultLayers, [layerItems]);
  const layerMeta = useMemo(() => Object.fromEntries(layers.map((layer, index) => { const configured = layerItems?.find((item) => item.id === layer); const fallback = defaultLayerMeta[layer]; return [layer, { number: String(index + 1).padStart(2, "0"), label: String(configured?.label ?? fallback?.label ?? layer), description: String(configured?.description ?? fallback?.description ?? "Couche personnalisée"), color: String(configured?.color ?? fallback?.color ?? ["#7c3aed", "#0284c7", "#059669", "#d97706"][index % 4]) }]; })), [layerItems, layers]);
  const statuses = sectionOf(configuration, "statuses")?.items.map((item) => item.id) ?? ["Cible", "À renforcer", "À transformer", "À retirer"];
  const statusClass = (status: ArchitectureElement["status"]) => ["target", "strengthen", "transform", "retire"][Math.max(0, statuses.indexOf(status)) % 4] ?? "strengthen";
  const [selectedId, setSelectedId] = useState<string | null>(elements[0]?.id ?? null);
  const [domain, setDomain] = useState("all");
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);

  const domains = useMemo(() => [...new Set(elements.map((item) => item.domain).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [elements]);
  const selected = elements.find((item) => item.id === selectedId) ?? null;
  const relatedIds = useMemo(() => new Set(relations.flatMap((item) => item.sourceId === selectedId ? [item.targetId] : item.targetId === selectedId ? [item.sourceId] : [])), [relations, selectedId]);
  const visible = useMemo(() => elements.filter((item) => (domain === "all" || item.domain === domain) && (!query || `${item.name} ${item.domain} ${item.owner}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")))), [domain, elements, query]);
  const selectedRelations = relations.filter((item) => item.sourceId === selectedId || item.targetId === selectedId);
  const orphanCount = elements.filter((item) => !relations.some((relation) => relation.sourceId === item.id || relation.targetId === item.id)).length;
  const transformationCount = elements.filter((item) => statuses.indexOf(item.status) >= Math.max(2, statuses.length - 2)).length;
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };

  return <section ref={frameRef} className="view-workspace si-layers-workspace">
    <header className="si-layers-header"><div><p className="eyebrow">Architecture d’entreprise</p><h1>Le SI, couche par couche</h1></div><div className="si-layers-actions">
      <label className="layers-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un élément" aria-label="Rechercher un élément" /></label>
      <label className="filter-control"><select value={domain} onChange={(event) => setDomain(event.target.value)} aria-label="Filtrer par domaine"><option value="all">Tous les domaines</option>{domains.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
      <button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{fullscreen ? "Quitter" : "Plein écran"}</span></button>
    </div></header>
    <div className="layers-summary"><span><Layers3 size={14} /><strong>{elements.length}</strong> éléments</span><span><ArrowDownUp size={14} /><strong>{relations.length}</strong> relations</span><span className={orphanCount ? "warning" : ""}><Boxes size={14} /><strong>{orphanCount}</strong> isolé{orphanCount > 1 ? "s" : ""}</span><span className={transformationCount ? "danger" : ""}><AlertTriangle size={14} /><strong>{transformationCount}</strong> à transformer</span><em>Cliquez sur un élément pour révéler sa chaîne de dépendances</em></div>
    {!elements.length ? <div className="layers-empty" data-view-export-content><Layers3 size={32} /><h2>Aucune architecture chargée</h2><p>Importez le modèle Excel pour composer votre cartographie en couches.</p></div> : <div className="layers-body" data-view-export-content>
      <div className="layer-stack">{layers.map((layer) => { const meta = layerMeta[layer]; const items = visible.filter((item) => item.layer === layer); return <section className="architecture-layer" key={layer} style={{ "--layer-color": meta.color } as React.CSSProperties}><header><span>{meta.number}</span><div><strong>{meta.label}</strong><small>{meta.description}</small></div><em>{items.length}</em></header><div className="architecture-layer-items">{items.length ? items.map((item) => { const relationsCount = relations.filter((relation) => relation.sourceId === item.id || relation.targetId === item.id).length; return <button key={item.id} className={`${selectedId === item.id ? "selected " : ""}${relatedIds.has(item.id) ? "related " : ""}${selectedId && selectedId !== item.id && !relatedIds.has(item.id) ? "dimmed " : ""}status-${statusClass(item.status)}`} onClick={() => setSelectedId(item.id)}><span className="layer-card-top"><i />{item.domain}</span><strong>{item.name}</strong><small>{item.owner || "Responsable non défini"}</small><span className="layer-card-foot"><em>{item.status}</em><b>{relationsCount} lien{relationsCount > 1 ? "s" : ""}</b></span></button>; }) : <div className="architecture-layer-empty">Aucun élément avec ces filtres</div>}</div></section>; })}</div>
      <aside className="layer-detail">{selected ? <><div className="layer-detail-heading" style={{ "--layer-color": layerMeta[selected.layer]?.color ?? "#2563eb" } as React.CSSProperties}><span>{layerMeta[selected.layer]?.label ?? selected.layer}</span><h2>{selected.name}</h2><p>{selected.description || "Aucune description renseignée."}</p></div><div className="layer-detail-facts"><div><span>Statut</span><strong className={`status-${statusClass(selected.status)}`}>{selected.status}</strong></div><div><span>Criticité</span><strong>{selected.criticality}</strong></div><div><span>Domaine</span><strong>{selected.domain}</strong></div><div><span>Responsable</span><strong>{selected.owner || "Non défini"}</strong></div></div><section><div className="layer-detail-section-title"><strong>Dépendances</strong><em>{selectedRelations.length}</em></div><div className="layer-relation-list">{selectedRelations.length ? selectedRelations.map((relation) => { const incoming = relation.targetId === selected.id; const otherId = incoming ? relation.sourceId : relation.targetId; const other = elements.find((item) => item.id === otherId); if (!other) return null; return <button key={relation.id} onClick={() => setSelectedId(other.id)}><span>{incoming ? "Dépend de" : "Contribue à"}</span><strong>{other.name}</strong><small>{layerMeta[other.layer]?.label ?? other.layer} · {relation.relation}</small></button>; }) : <p>Aucune relation documentée pour cet élément.</p>}</div></section></> : <div className="layer-detail-placeholder"><Target size={24} /><strong>Sélectionnez un élément</strong><span>Ses informations et dépendances apparaîtront ici.</span></div>}</aside>
    </div>}
  </section>;
}
