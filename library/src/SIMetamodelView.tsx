"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { Link2, Maximize2, Minimize2, Search, X } from "lucide-react";
import { optionOf, sectionOf, type ConfigurationItem } from "./configuration";
import type { ViewRendererProps } from "./view-registry";

type Layer = { id: string; label: string; description: string; color: string };
type ObjectType = { id: string; label: string; layerId: string; description: string; color: string };
type RelationType = { id: string; label: string; sourceTypeId: string; targetTypeId: string; sourceCardinality: string; targetCardinality: string; description: string };
type ObjectNodeData = { objectType: ObjectType; layer?: Layer; relationCount: number };
type Selection = { kind: "object"; id: string } | { kind: "relation"; id: string };

const asLayer = (item: ConfigurationItem): Layer => ({ id: item.id, label: String(item.label ?? item.id), description: String(item.description ?? ""), color: String(item.color ?? "#2563eb") });
const asObjectType = (item: ConfigurationItem): ObjectType => ({ id: item.id, label: String(item.label ?? item.id), layerId: String(item.layerId ?? ""), description: String(item.description ?? ""), color: String(item.color ?? "#2563eb") });
const asRelationType = (item: ConfigurationItem): RelationType => ({ id: item.id, label: String(item.label ?? item.id), sourceTypeId: String(item.sourceTypeId ?? ""), targetTypeId: String(item.targetTypeId ?? ""), sourceCardinality: String(item.sourceCardinality ?? ""), targetCardinality: String(item.targetCardinality ?? ""), description: String(item.description ?? "") });

const MetamodelNode = memo(function MetamodelNode({ data }: NodeProps<ObjectNodeData>) {
  return <article className="metamodel-node" style={{ "--metamodel-color": data.objectType.color || data.layer?.color || "#2563eb" } as React.CSSProperties}>
    <Handle type="target" position={Position.Left} /><span>{data.layer?.label ?? "Couche inconnue"}</span><strong>{data.objectType.label}</strong>{data.objectType.description && <small>{data.objectType.description}</small>}<em><Link2 size={11} /> {data.relationCount}</em><Handle type="source" position={Position.Right} />
  </article>;
});

const nodeTypes = { metamodelObject: MetamodelNode };

function FitController({ signature, fullscreen }: { signature: string; fullscreen: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => { const timer = window.setTimeout(() => fitView({ padding: .12, duration: 450, maxZoom: 1.05 }), 80); return () => window.clearTimeout(timer); }, [fitView, fullscreen, signature]);
  return null;
}

function MetamodelCanvas({ layers, objects, relations, selected, onSelect, fullscreen, showCardinalities }: { layers: Layer[]; objects: ObjectType[]; relations: RelationType[]; selected: Selection | null; onSelect: (selection: Selection) => void; fullscreen: boolean; showCardinalities: boolean }) {
  const nodes = useMemo<Node<ObjectNodeData>[]>(() => objects.map((objectType) => {
    const layerIndex = Math.max(0, layers.findIndex((layer) => layer.id === objectType.layerId));
    const peers = objects.filter((item) => item.layerId === objectType.layerId);
    const rowIndex = Math.max(0, peers.findIndex((item) => item.id === objectType.id));
    return { id: objectType.id, type: "metamodelObject", position: { x: layerIndex * 285, y: rowIndex * 145 }, data: { objectType, layer: layers[layerIndex], relationCount: relations.filter((item) => item.sourceTypeId === objectType.id || item.targetTypeId === objectType.id).length }, selected: selected?.kind === "object" && selected.id === objectType.id };
  }), [layers, objects, relations, selected]);
  const edges = useMemo<Edge[]>(() => relations.filter((relation) => objects.some((item) => item.id === relation.sourceTypeId) && objects.some((item) => item.id === relation.targetTypeId)).map((relation) => ({
    id: relation.id, source: relation.sourceTypeId, target: relation.targetTypeId, type: "smoothstep", label: showCardinalities ? `${relation.sourceCardinality}  ${relation.label}  ${relation.targetCardinality}` : relation.label,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 }, selected: selected?.kind === "relation" && selected.id === relation.id,
    style: { stroke: selected?.kind === "relation" && selected.id === relation.id ? "var(--primary)" : "var(--muted)", strokeWidth: selected?.kind === "relation" && selected.id === relation.id ? 2.2 : 1.25 },
    labelStyle: { fontSize: 8, fontWeight: 700, fill: "var(--foreground)" }, labelBgStyle: { fill: "var(--surface)", fillOpacity: .94 }, labelBgPadding: [5, 3], labelBgBorderRadius: 5,
  })), [objects, relations, selected, showCardinalities]);
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={.2} maxZoom={1.5} nodesConnectable={false} nodesDraggable onNodeClick={(_, node) => onSelect({ kind: "object", id: node.id })} onEdgeClick={(_, edge) => onSelect({ kind: "relation", id: edge.id })} proOptions={{ hideAttribution: true }}><Background gap={24} size={1} color="var(--rf-grid)" /><Controls position="bottom-left" showInteractive={false} /><FitController signature={`${nodes.map((node) => node.id).join("|")}:${edges.map((edge) => edge.id).join("|")}`} fullscreen={fullscreen} />{!nodes.length && <div className="rf-empty-overlay">Ajoutez des types d’objets dans la structure du métamodèle.</div>}</ReactFlow>;
}

export function SIMetamodelView({ configuration }: ViewRendererProps) {
  const frameRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [layerFilter, setLayerFilter] = useState("all");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const layers = useMemo(() => (sectionOf(configuration, "layers")?.items ?? []).map(asLayer), [configuration]);
  const allObjects = useMemo(() => (sectionOf(configuration, "objectTypes")?.items ?? []).map(asObjectType), [configuration]);
  const allRelations = useMemo(() => (sectionOf(configuration, "relationTypes")?.items ?? []).map(asRelationType), [configuration]);
  const showCardinalities = Boolean(optionOf(configuration, "showCardinalities", true));
  const needle = query.trim().toLocaleLowerCase("fr");
  const matchingIds = useMemo(() => new Set(allObjects.filter((item) => (layerFilter === "all" || item.layerId === layerFilter) && (!needle || `${item.label} ${item.description}`.toLocaleLowerCase("fr").includes(needle))).map((item) => item.id)), [allObjects, layerFilter, needle]);
  const visibleRelations = useMemo(() => allRelations.filter((item) => matchingIds.has(item.sourceTypeId) && matchingIds.has(item.targetTypeId)), [allRelations, matchingIds]);
  const visibleObjects = useMemo(() => allObjects.filter((item) => matchingIds.has(item.id)), [allObjects, matchingIds]);
  const visibleLayers = useMemo(() => layers.filter((layer) => layerFilter === "all" ? visibleObjects.some((item) => item.layerId === layer.id) : layer.id === layerFilter), [layerFilter, layers, visibleObjects]);
  const selectedObject = selection?.kind === "object" ? allObjects.find((item) => item.id === selection.id) : null;
  const selectedRelation = selection?.kind === "relation" ? allRelations.find((item) => item.id === selection.id) : null;
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };
  return <section ref={frameRef} className="view-workspace rf-view-workspace metamodel-workspace">
    <header className="metamodel-header"><div><p className="eyebrow">Architecture d’entreprise</p><h1>{configuration?.label ?? "Métamodèle du SI"}</h1></div><div className="metamodel-actions"><label className="layers-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un type…" /></label><select value={layerFilter} onChange={(event) => setLayerFilter(event.target.value)}><option value="all">Toutes les couches</option>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select><button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{fullscreen ? "Quitter" : "Plein écran"}</span></button></div></header>
    <div className="metamodel-layer-strip">{visibleLayers.map((layer) => <span key={layer.id} style={{ "--metamodel-color": layer.color } as React.CSSProperties}><i />{layer.label}<strong>{visibleObjects.filter((item) => item.layerId === layer.id).length}</strong></span>)}</div>
    <div className="rf-canvas-area metamodel-canvas" data-view-export-content><ReactFlowProvider><MetamodelCanvas layers={visibleLayers} objects={visibleObjects} relations={visibleRelations} selected={selection} onSelect={setSelection} fullscreen={fullscreen} showCardinalities={showCardinalities} /></ReactFlowProvider></div>
    {(selectedObject || selectedRelation) && <aside className="context-panel rf-context-panel metamodel-detail"><button className="panel-close" onClick={() => setSelection(null)} aria-label="Fermer le détail"><X size={16} /></button>{selectedObject ? <><p className="eyebrow">{layers.find((layer) => layer.id === selectedObject.layerId)?.label ?? "Type d’objet"}</p><h2>{selectedObject.label}</h2><p>{selectedObject.description || "Aucune définition renseignée."}</p><div className="panel-section"><h3>Relations autorisées</h3>{allRelations.filter((item) => item.sourceTypeId === selectedObject.id || item.targetTypeId === selectedObject.id).map((relation) => { const outgoing = relation.sourceTypeId === selectedObject.id; const other = allObjects.find((item) => item.id === (outgoing ? relation.targetTypeId : relation.sourceTypeId)); return <button className="metamodel-relation-row" key={relation.id} onClick={() => setSelection({ kind: "relation", id: relation.id })}><span>{outgoing ? "→" : "←"} {relation.label}</span><strong>{other?.label ?? "Type inconnu"}</strong><small>{outgoing ? `${relation.sourceCardinality} → ${relation.targetCardinality}` : `${relation.targetCardinality} ← ${relation.sourceCardinality}`}</small></button>; })}</div></> : selectedRelation ? <><p className="eyebrow">Relation autorisée</p><h2>{selectedRelation.label}</h2><p>{selectedRelation.description || "Aucune règle documentée."}</p><div className="metamodel-relation-path"><span>{allObjects.find((item) => item.id === selectedRelation.sourceTypeId)?.label}<small>{selectedRelation.sourceCardinality}</small></span><i>→</i><span>{allObjects.find((item) => item.id === selectedRelation.targetTypeId)?.label}<small>{selectedRelation.targetCardinality}</small></span></div></> : null}</aside>}
  </section>;
}
