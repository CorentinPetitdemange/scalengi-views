"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { Eye, EyeOff, Focus, Layers3, Link2, Maximize2, Minimize2, Search, X } from "lucide-react";
import { sectionOf, type ConfigurationItem } from "./configuration";
import { useI18n } from "./i18n";
import type { ViewRendererProps } from "./view-registry";

type LayerLayout = "stacked" | "transverse";
type LayerSide = "left" | "right";
type Layer = { id: string; label: string; description: string; color: string; layout: LayerLayout; side: LayerSide; row: number; column: number };
type ObjectType = { id: string; label: string; layerId: string; description: string; color: string };
type RelationType = { id: string; label: string; sourceTypeId: string; targetTypeId: string; sourceCardinality: string; targetCardinality: string; description: string };
type ObjectNodeData = { objectType: ObjectType; layer?: Layer; relationCount: number; dimmed: boolean };
type LayerNodeData = { layer: Layer; objectCount: number };
type Selection = { kind: "object"; id: string } | { kind: "relation"; id: string };
type RelationMode = "hidden" | "focus" | "all";

const NODE_WIDTH = 210;
const NODE_HEIGHT = 100;
const LAYER_HEADER = 48;
const LAYER_PADDING = 28;
const spacingForLevel = (level: number) => {
  const safeLevel = Math.min(10, Math.max(1, Math.round(level)));
  return { horizontal: 24 + (safeLevel - 1) * 18, vertical: 16 + (safeLevel - 1) * 12 };
};

const asLayer = (item: ConfigurationItem, index: number): Layer => ({
  id: item.id,
  label: String(item.label ?? item.id),
  description: String(item.description ?? ""),
  color: String(item.color ?? "#2563eb"),
  layout: item.layout === "transverse" ? "transverse" : "stacked",
  side: item.side === "left" ? "left" : "right",
  row: Number.isInteger(Number(item.row)) && Number(item.row) > 0 ? Number(item.row) : index + 1,
  column: Number.isInteger(Number(item.column)) && Number(item.column) > 0 ? Number(item.column) : index + 1,
});
const asObjectType = (item: ConfigurationItem): ObjectType => ({ id: item.id, label: String(item.label ?? item.id), layerId: String(item.layerId ?? ""), description: String(item.description ?? ""), color: String(item.color ?? "#2563eb") });
const asRelationType = (item: ConfigurationItem): RelationType => ({ id: item.id, label: String(item.label ?? item.id), sourceTypeId: String(item.sourceTypeId ?? ""), targetTypeId: String(item.targetTypeId ?? ""), sourceCardinality: String(item.sourceCardinality ?? ""), targetCardinality: String(item.targetCardinality ?? ""), description: String(item.description ?? "") });

const MetamodelLayer = memo(function MetamodelLayer({ data }: NodeProps<LayerNodeData>) {
  return <section className={`metamodel-layer ${data.layer.layout}`} style={{ "--metamodel-color": data.layer.color } as React.CSSProperties}>
    <header><span><Layers3 size={14} /></span><div><strong>{data.layer.label}</strong>{data.layer.description && <small>{data.layer.description}</small>}</div><em>{data.objectCount}</em></header>
  </section>;
});

const MetamodelNode = memo(function MetamodelNode({ data }: NodeProps<ObjectNodeData>) {
  const { locale, t } = useI18n();
  return <article className={`metamodel-node${data.dimmed ? " dimmed" : ""}`} style={{ "--metamodel-color": data.objectType.color || data.layer?.color || "#2563eb" } as React.CSSProperties}>
    <Handle id="target-top" type="target" position={Position.Top} /><Handle id="target-right" type="target" position={Position.Right} /><Handle id="target-bottom" type="target" position={Position.Bottom} /><Handle id="target-left" type="target" position={Position.Left} />
    <Handle id="source-top" type="source" position={Position.Top} /><Handle id="source-right" type="source" position={Position.Right} /><Handle id="source-bottom" type="source" position={Position.Bottom} /><Handle id="source-left" type="source" position={Position.Left} />
    <span>{data.layer?.label ?? t("Couche inconnue")}</span><strong>{data.objectType.label}</strong>{data.objectType.description && <small>{data.objectType.description}</small>}<em><Link2 size={11} /> {data.relationCount} {locale === "fr" ? `relation${data.relationCount > 1 ? "s" : ""}` : `relation${data.relationCount === 1 ? "" : "s"}`}</em>
  </article>;
});

const nodeTypes = { metamodelLayer: MetamodelLayer, metamodelObject: MetamodelNode };

function FitController({ signature, fullscreen }: { signature: string; fullscreen: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => { const timer = window.setTimeout(() => fitView({ padding: .08, duration: 450, minZoom: fullscreen ? .5 : .44, maxZoom: 1.05 }), 80); return () => window.clearTimeout(timer); }, [fitView, fullscreen, signature]);
  return null;
}

function edgeHandles(sourceLayer: Layer | undefined, targetLayer: Layer | undefined, layerOrder: Map<string, number>) {
  if (sourceLayer?.layout === "transverse" && targetLayer?.layout !== "transverse") return sourceLayer.side === "left" ? { sourceHandle: "source-right", targetHandle: "target-left" } : { sourceHandle: "source-left", targetHandle: "target-right" };
  if (sourceLayer?.layout !== "transverse" && targetLayer?.layout === "transverse") return targetLayer.side === "left" ? { sourceHandle: "source-left", targetHandle: "target-right" } : { sourceHandle: "source-right", targetHandle: "target-left" };
  const sourceIndex = layerOrder.get(sourceLayer?.id ?? "") ?? 0;
  const targetIndex = layerOrder.get(targetLayer?.id ?? "") ?? 0;
  if (sourceLayer?.layout === "transverse" && targetLayer?.layout === "transverse" && sourceLayer.side === targetLayer.side && sourceLayer.column !== targetLayer.column) {
    return sourceIndex <= targetIndex ? { sourceHandle: "source-right", targetHandle: "target-left" } : { sourceHandle: "source-left", targetHandle: "target-right" };
  }
  if (sourceLayer?.layout === "stacked" && targetLayer?.layout === "stacked" && sourceLayer.id !== targetLayer.id && sourceLayer.row === targetLayer.row) {
    return sourceIndex <= targetIndex ? { sourceHandle: "source-right", targetHandle: "target-left" } : { sourceHandle: "source-left", targetHandle: "target-right" };
  }
  return sourceIndex <= targetIndex ? { sourceHandle: "source-bottom", targetHandle: "target-top" } : { sourceHandle: "source-top", targetHandle: "target-bottom" };
}

function MetamodelCanvas({ layers, objects, relations, selected, onSelect, onClearSelection, fullscreen, relationMode, density }: { layers: Layer[]; objects: ObjectType[]; relations: RelationType[]; selected: Selection | null; onSelect: (selection: Selection) => void; onClearSelection: () => void; fullscreen: boolean; relationMode: RelationMode; density: number }) {
  const { locale, t } = useI18n();
  const spacing = spacingForLevel(density);
  const objectById = useMemo(() => new Map(objects.map((item) => [item.id, item])), [objects]);
  const layerById = useMemo(() => new Map(layers.map((item) => [item.id, item])), [layers]);
  const layerOrder = useMemo(() => new Map(layers.map((item, index) => [item.id, index])), [layers]);
  const focusedRelationIds = useMemo(() => {
    if (!selected) return new Set<string>();
    if (selected.kind === "relation") return new Set([selected.id]);
    return new Set(relations.filter((relation) => relation.sourceTypeId === selected.id || relation.targetTypeId === selected.id).map((relation) => relation.id));
  }, [relations, selected]);
  const displayedRelations = useMemo(() => relationMode === "hidden" ? [] : relationMode === "all" ? relations : relations.filter((relation) => focusedRelationIds.has(relation.id)), [focusedRelationIds, relationMode, relations]);
  const relatedObjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const relation of displayedRelations) { ids.add(relation.sourceTypeId); ids.add(relation.targetTypeId); }
    return ids;
  }, [displayedRelations]);
  const nodes = useMemo<Node[]>(() => {
    const stackedLayers = layers.filter((layer) => layer.layout === "stacked");
    const transverseColumns = (side: LayerSide) => [...layers.filter((layer) => layer.layout === "transverse" && layer.side === side).reduce((columns, layer) => {
      const column = columns.get(layer.column) ?? [];
      column.push(layer);
      columns.set(layer.column, column);
      return columns;
    }, new Map<number, Layer[]>()).values()];
    const leftTransverseColumns = transverseColumns("left");
    const rightTransverseColumns = transverseColumns("right");
    const stackedRows = [...stackedLayers.reduce((rows, layer) => {
      const row = rows.get(layer.row) ?? [];
      row.push(layer);
      rows.set(layer.row, row);
      return rows;
    }, new Map<number, Layer[]>()).values()];
    const naturalLayerWidth = (layer: Layer) => {
      const objectCount = Math.max(1, objects.filter((item) => item.layerId === layer.id).length);
      return LAYER_PADDING * 2 + objectCount * NODE_WIDTH + Math.max(0, objectCount - 1) * spacing.horizontal;
    };
    const rowNaturalWidth = (row: Layer[]) => row.reduce((width, layer) => width + naturalLayerWidth(layer), 0) + Math.max(0, row.length - 1) * spacing.horizontal;
    const stackedWidth = stackedLayers.length ? Math.max(780, ...stackedRows.map(rowNaturalWidth)) : 0;
    const stackedLayerHeight = LAYER_HEADER + NODE_HEIGHT + LAYER_PADDING * 2;
    const stackedHeight = Math.max(360, stackedRows.length * stackedLayerHeight + Math.max(0, stackedRows.length - 1) * spacing.vertical);
    const transverseWidth = NODE_WIDTH + LAYER_PADDING * 2;
    const naturalTransverseHeight = (layer: Layer) => {
      const objectCount = objects.filter((item) => item.layerId === layer.id).length;
      return LAYER_HEADER + LAYER_PADDING * 2 + objectCount * NODE_HEIGHT + Math.max(0, objectCount - 1) * spacing.vertical;
    };
    const naturalColumnHeight = (column: Layer[]) => column.reduce((height, layer) => height + naturalTransverseHeight(layer), 0) + Math.max(0, column.length - 1) * spacing.vertical;
    const graphHeight = Math.max(stackedHeight, ...leftTransverseColumns.map(naturalColumnHeight), ...rightTransverseColumns.map(naturalColumnHeight));
    const leftTransverseWidth = leftTransverseColumns.length * transverseWidth + Math.max(0, leftTransverseColumns.length - 1) * spacing.horizontal;
    const stackedX = leftTransverseColumns.length ? leftTransverseWidth + spacing.horizontal * 1.5 : 0;
    const rightTransverseX = stackedX + stackedWidth + (stackedLayers.length && rightTransverseColumns.length ? spacing.horizontal * 1.5 : 0);
    const graphNodes: Node[] = [];

    stackedRows.forEach((row, rowIndex) => {
      const extraWidthPerLayer = (stackedWidth - rowNaturalWidth(row)) / row.length;
      let layerX = stackedX;
      row.forEach((layer) => {
        const peers = objects.filter((item) => item.layerId === layer.id);
        const groupId = `layer:${layer.id}`;
        const layerWidth = naturalLayerWidth(layer) + extraWidthPerLayer;
        graphNodes.push({ id: groupId, type: "metamodelLayer", position: { x: layerX, y: rowIndex * (stackedLayerHeight + spacing.vertical) }, data: { layer, objectCount: peers.length }, style: { width: layerWidth, height: stackedLayerHeight }, draggable: false, selectable: false, zIndex: 0 });
        peers.forEach((objectType, objectIndex) => graphNodes.push({ id: objectType.id, type: "metamodelObject", parentNode: groupId, extent: "parent", position: { x: LAYER_PADDING + objectIndex * (NODE_WIDTH + spacing.horizontal), y: LAYER_HEADER + LAYER_PADDING }, data: { objectType, layer, relationCount: relations.filter((item) => item.sourceTypeId === objectType.id || item.targetTypeId === objectType.id).length, dimmed: relationMode === "focus" && Boolean(selected) && !relatedObjectIds.has(objectType.id) }, selected: selected?.kind === "object" && selected.id === objectType.id, zIndex: 2 }));
        layerX += layerWidth + spacing.horizontal;
      });
    });

    const addTransverseColumns = (columns: Layer[][], startX: number) => columns.forEach((column, columnIndex) => {
      const extraHeightPerLayer = (graphHeight - naturalColumnHeight(column)) / column.length;
      let layerY = 0;
      column.forEach((layer) => {
        const peers = objects.filter((item) => item.layerId === layer.id);
        const groupId = `layer:${layer.id}`;
        const height = naturalTransverseHeight(layer) + extraHeightPerLayer;
        const x = startX + columnIndex * (transverseWidth + spacing.horizontal);
        graphNodes.push({ id: groupId, type: "metamodelLayer", position: { x, y: layerY }, data: { layer, objectCount: peers.length }, style: { width: transverseWidth, height }, draggable: false, selectable: false, zIndex: 0 });
        peers.forEach((objectType, objectIndex) => graphNodes.push({ id: objectType.id, type: "metamodelObject", parentNode: groupId, extent: "parent", position: { x: LAYER_PADDING, y: LAYER_HEADER + LAYER_PADDING + objectIndex * (NODE_HEIGHT + spacing.vertical) }, data: { objectType, layer, relationCount: relations.filter((item) => item.sourceTypeId === objectType.id || item.targetTypeId === objectType.id).length, dimmed: relationMode === "focus" && Boolean(selected) && !relatedObjectIds.has(objectType.id) }, selected: selected?.kind === "object" && selected.id === objectType.id, zIndex: 2 }));
        layerY += height + spacing.vertical;
      });
    });
    addTransverseColumns(leftTransverseColumns, 0);
    addTransverseColumns(rightTransverseColumns, rightTransverseX);
    return graphNodes;
  }, [layers, objects, relationMode, relatedObjectIds, relations, selected, spacing.horizontal, spacing.vertical]);
  const edges = useMemo<Edge[]>(() => displayedRelations.filter((relation) => objectById.has(relation.sourceTypeId) && objectById.has(relation.targetTypeId)).map((relation) => {
    const isSelected = selected?.kind === "relation" && selected.id === relation.id;
    const sourceObject = objectById.get(relation.sourceTypeId);
    const targetObject = objectById.get(relation.targetTypeId);
    return { id: relation.id, source: relation.sourceTypeId, target: relation.targetTypeId, ...edgeHandles(layerById.get(sourceObject?.layerId ?? ""), layerById.get(targetObject?.layerId ?? ""), layerOrder), type: "smoothstep", label: relation.label, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: isSelected ? "var(--primary)" : "var(--metamodel-edge)" }, selected: isSelected, animated: isSelected, style: { stroke: isSelected ? "var(--primary)" : "var(--metamodel-edge)", strokeWidth: isSelected ? 2.4 : relationMode === "focus" ? 1.8 : 1.1, opacity: relationMode === "all" && !isSelected ? .55 : 1 }, labelStyle: { fontSize: 9, fontWeight: 750, fill: "var(--foreground)" }, labelBgStyle: { fill: "var(--surface)", fillOpacity: .97, stroke: "var(--border)", strokeWidth: .5 }, labelBgPadding: [6, 4] as [number, number], labelBgBorderRadius: 6, zIndex: isSelected ? 5 : 1 };
  }), [displayedRelations, layerById, layerOrder, objectById, relationMode, selected]);
  const relationStatus = relationMode === "hidden" ? t("Relations masquées") : relationMode === "all" ? locale === "fr" ? `${edges.length} relations affichées` : `${edges.length} displayed relation${edges.length === 1 ? "" : "s"}` : selected ? locale === "fr" ? `${edges.length} relation${edges.length > 1 ? "s" : ""} au focus` : `${edges.length} focused relation${edges.length === 1 ? "" : "s"}` : t("Sélectionnez un type pour afficher ses relations");

  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={.35} maxZoom={1.65} nodesConnectable={false} nodesDraggable onNodeClick={(_, node) => { if (node.type === "metamodelObject") onSelect({ kind: "object", id: node.id }); }} onEdgeClick={(_, edge) => onSelect({ kind: "relation", id: edge.id })} onPaneClick={onClearSelection} proOptions={{ hideAttribution: true }}>
    <Background gap={24} size={1} color="var(--rf-grid)" /><Controls position="bottom-left" showInteractive={false} /><FitController signature={`${density}:${nodes.map((node) => node.id).join("|")}:${edges.map((edge) => edge.id).join("|")}`} fullscreen={fullscreen} />
    <div className="metamodel-reading-status"><Focus size={13} /><span>{relationStatus}</span></div>{!objects.length && <div className="rf-empty-overlay">{t("Sélectionnez au moins une couche contenant des types d’objets.")}</div>}
  </ReactFlow>;
}

export function SIMetamodelView({ configuration }: ViewRendererProps) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(() => new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [relationMode, setRelationMode] = useState<RelationMode>("focus");
  const [density, setDensity] = useState(3);
  const [fullscreen, setFullscreen] = useState(false);
  const layers = useMemo(() => (sectionOf(configuration, "layers")?.items ?? []).map(asLayer), [configuration]);
  const allObjects = useMemo(() => (sectionOf(configuration, "objectTypes")?.items ?? []).map(asObjectType), [configuration]);
  const allRelations = useMemo(() => (sectionOf(configuration, "relationTypes")?.items ?? []).map(asRelationType), [configuration]);
  const needle = query.trim().toLocaleLowerCase("fr");
  const visibleLayerIds = useMemo(() => new Set(layers.filter((layer) => !hiddenLayerIds.has(layer.id)).map((layer) => layer.id)), [hiddenLayerIds, layers]);
  const matchingIds = useMemo(() => new Set(allObjects.filter((item) => visibleLayerIds.has(item.layerId) && (!needle || `${item.label} ${item.description}`.toLocaleLowerCase("fr").includes(needle))).map((item) => item.id)), [allObjects, needle, visibleLayerIds]);
  const visibleRelations = useMemo(() => allRelations.filter((item) => matchingIds.has(item.sourceTypeId) && matchingIds.has(item.targetTypeId)), [allRelations, matchingIds]);
  const visibleObjects = useMemo(() => allObjects.filter((item) => matchingIds.has(item.id)), [allObjects, matchingIds]);
  const visibleLayers = useMemo(() => layers.filter((layer) => visibleLayerIds.has(layer.id) && visibleObjects.some((item) => item.layerId === layer.id)), [layers, visibleLayerIds, visibleObjects]);
  const visibleSelection = selection?.kind === "object" ? (matchingIds.has(selection.id) ? selection : null) : selection?.kind === "relation" ? (visibleRelations.some((relation) => relation.id === selection.id) ? selection : null) : null;
  const selectedObject = visibleSelection?.kind === "object" ? allObjects.find((item) => item.id === visibleSelection.id) : null;
  const selectedRelation = visibleSelection?.kind === "relation" ? allRelations.find((item) => item.id === visibleSelection.id) : null;
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };
  const toggleLayer = (layerId: string) => setHiddenLayerIds((current) => { const next = new Set(current); if (next.has(layerId)) next.delete(layerId); else next.add(layerId); return next; });
  return <section ref={frameRef} className="view-workspace rf-view-workspace metamodel-workspace">
    <header className="metamodel-header"><div><p className="eyebrow">{t("Architecture d’entreprise")}</p><h1>{configuration?.label ?? t("Métamodèle du SI")}</h1></div><div className="metamodel-actions"><label className="layers-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Rechercher un type…")} /></label><div className="segmented-control metamodel-relation-modes" aria-label={t("Affichage des relations")}><button className={relationMode === "hidden" ? "active" : ""} onClick={() => setRelationMode("hidden")} title={t("Masquer les relations")}><EyeOff size={14} /><span>{t("Masquées")}</span></button><button className={relationMode === "focus" ? "active" : ""} onClick={() => setRelationMode("focus")} title={t("Afficher uniquement les relations du type sélectionné")}><Focus size={14} /><span>{t("Au focus")}</span></button><button className={relationMode === "all" ? "active" : ""} onClick={() => setRelationMode("all")} title={t("Afficher toutes les relations")}><Eye size={14} /><span>{t("Toutes")}</span></button></div><button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{t(fullscreen ? "Quitter" : "Plein écran")}</span></button></div></header>
    <div className="metamodel-display-bar"><div className="metamodel-layer-filters"><span>{t("Couches")}</span>{layers.map((layer) => { const visible = visibleLayerIds.has(layer.id); return <button key={layer.id} className={visible ? "active" : ""} onClick={() => toggleLayer(layer.id)} style={{ "--metamodel-color": layer.color } as React.CSSProperties} aria-pressed={visible}><i />{layer.label}<strong>{allObjects.filter((item) => item.layerId === layer.id).length}</strong>{layer.layout === "transverse" && <em>{t(layer.side === "left" ? "Gauche" : "Droite")} · col. {layer.column}</em>}</button>; })}{layers.some((layer) => hiddenLayerIds.has(layer.id)) && <button className="metamodel-show-all" onClick={() => setHiddenLayerIds(new Set())}>{t("Tout afficher")}</button>}</div><label className="metamodel-density"><span>{t("Espacement")}</span><input type="range" min="1" max="10" step="1" value={density} onChange={(event) => setDensity(Number(event.target.value))} /></label></div>
    <div className="rf-canvas-area metamodel-canvas" data-view-export-content><ReactFlowProvider><MetamodelCanvas layers={visibleLayers} objects={visibleObjects} relations={visibleRelations} selected={visibleSelection} onSelect={setSelection} onClearSelection={() => setSelection(null)} fullscreen={fullscreen} relationMode={relationMode} density={density} /></ReactFlowProvider></div>
    {(selectedObject || selectedRelation) && <aside className="context-panel rf-context-panel metamodel-detail"><button className="panel-close" onClick={() => setSelection(null)} aria-label={t("Fermer le détail")}><X size={16} /></button>{selectedObject ? <><p className="eyebrow">{layers.find((layer) => layer.id === selectedObject.layerId)?.label ?? t("Type d’objet")}</p><h2>{selectedObject.label}</h2><p>{selectedObject.description || t("Aucune définition renseignée.")}</p><div className="panel-section"><h3>{t("Relations autorisées")}</h3>{allRelations.filter((item) => item.sourceTypeId === selectedObject.id || item.targetTypeId === selectedObject.id).map((relation) => { const outgoing = relation.sourceTypeId === selectedObject.id; const other = allObjects.find((item) => item.id === (outgoing ? relation.targetTypeId : relation.sourceTypeId)); return <button className="metamodel-relation-row" key={relation.id} onClick={() => setSelection({ kind: "relation", id: relation.id })}><span>{outgoing ? "→" : "←"} {relation.label}</span><strong>{other?.label ?? t("Type inconnu")}</strong><small>{outgoing ? `${relation.sourceCardinality} → ${relation.targetCardinality}` : `${relation.targetCardinality} ← ${relation.sourceCardinality}`}</small></button>; })}</div></> : selectedRelation ? <><p className="eyebrow">{t("Relation autorisée")}</p><h2>{selectedRelation.label}</h2><p>{selectedRelation.description || t("Aucune règle documentée.")}</p><div className="metamodel-relation-path"><span>{allObjects.find((item) => item.id === selectedRelation.sourceTypeId)?.label}<small>{selectedRelation.sourceCardinality}</small></span><i>→</i><span>{allObjects.find((item) => item.id === selectedRelation.targetTypeId)?.label}<small>{selectedRelation.targetCardinality}</small></span></div></> : null}</aside>}
  </section>;
}
