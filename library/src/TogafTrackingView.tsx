"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { AlertOctagon, CalendarClock, ChevronDown, CircleDashed, Flag, Maximize2, Minimize2, Route, ShieldCheck, UserRound, X } from "lucide-react";
import { sectionOf, type ViewConfiguration } from "./configuration";
import type { TogafItem, TogafPhase, ViewDataset } from "./types";

const phaseStatusClass = (status: TogafPhase["status"]) => status === "Validée" ? "done" : status === "En cours" ? "active" : status === "À valider" ? "review" : status === "Bloquée" ? "blocked" : "todo";
const itemStatusClass = (status: TogafItem["status"]) => status === "Validé" ? "done" : status === "En cours" ? "active" : status === "À valider" ? "review" : status === "Bloqué" ? "blocked" : "todo";
const itemTypeIcon = (type: TogafItem["type"]) => type === "Risque" ? AlertOctagon : type === "Décision" ? Flag : type === "Action" ? CircleDashed : ShieldCheck;
const formatDate = (value: string) => value ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const isPreliminary = (phase: TogafPhase) => phase.code.toLocaleLowerCase("fr") === "pre" || phase.name.toLocaleLowerCase("fr").includes("prélim");
const isRequirements = (phase: TogafPhase) => /requirement|exigence/.test(`${phase.id} ${phase.code} ${phase.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr"));

type AdmPhaseData = {
  phase: TogafPhase;
  items: TogafItem[];
  preliminary?: boolean;
};

type AdmHubData = {
  label: string;
  progress: number;
  phaseCount: number;
  decisionCount: number;
  riskCount: number;
  phase?: TogafPhase;
  items: TogafItem[];
  typeLabel: (type: string) => string;
};

const AdmPhaseNode = memo(function AdmPhaseNode({ data, selected }: NodeProps<AdmPhaseData>) {
  const phase = data.phase;
  return <article className={`adm-phase-node ${data.preliminary ? "preliminary" : ""} ${phaseStatusClass(phase.status)} ${selected ? "selected" : ""}`} title={`${phase.status} · ${data.items.length} élément${data.items.length > 1 ? "s" : ""}`}>
    <Handle type="target" position={Position.Top} className="adm-handle" />
    <span className="adm-phase-code">{phase.code}</span>
    <strong>{phase.name}</strong>
    <em>{phase.progress}%</em>
    <Handle type="source" position={Position.Bottom} className="adm-handle" />
  </article>;
});

const AdmHubNode = memo(function AdmHubNode({ data, selected }: NodeProps<AdmHubData>) {
  return <article className={`adm-hub-node ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Top} className="adm-handle" />
    <span className="adm-hub-kicker">Au cœur de chaque phase</span>
    <Route size={22} />
    <strong>{data.label}</strong>
    <p>{data.phase?.objective || "Les exigences sont identifiées, stockées et alimentent toutes les phases du cycle ADM."}</p>
    <div><span><b>{data.progress}%</b> global</span><span><b>{data.phaseCount}</b> phases</span><span><b>{data.decisionCount}</b> décisions</span><span className={data.riskCount ? "danger" : ""}><b>{data.riskCount}</b> risques</span></div>
    <small>Cliquez pour ouvrir le détail</small>
    <Handle type="source" position={Position.Bottom} className="adm-handle" />
  </article>;
});

type AdmRingData = { phaseCount: number };

const AdmRingNode = memo(function AdmRingNode({ data }: NodeProps<AdmRingData>) {
  const size = 660; const center = size / 2; const radius = center; const count = Math.max(data.phaseCount, 1); const step = Math.PI * 2 / count; const gap = Math.min(.24, step * .28);
  const arcs = Array.from({ length: count }, (_, index) => {
    const startAngle = -Math.PI / 2 + index * step + gap;
    const endAngle = -Math.PI / 2 + (index + 1) * step - gap;
    const start = { x: center + Math.cos(startAngle) * radius, y: center + Math.sin(startAngle) * radius };
    const end = { x: center + Math.cos(endAngle) * radius, y: center + Math.sin(endAngle) * radius };
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  });
  return <div className="adm-cycle-ring"><svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><defs><marker id="adm-cycle-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker></defs><circle cx={center} cy={center} r={radius} fill="none" stroke="#dbe3ee" />{arcs.map((path, index) => <path d={path} fill="none" stroke="#64748b" markerEnd="url(#adm-cycle-arrow)" key={index} />)}</svg></div>;
});

const nodeTypes = { admPhase: AdmPhaseNode, admHub: AdmHubNode, admRing: AdmRingNode };

function AdmFitController({ signature, fullscreen }: { signature: string; fullscreen: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => { const timeout = window.setTimeout(() => fitView({ padding: .08, duration: 650, maxZoom: 1 }), 80); return () => window.clearTimeout(timeout); }, [fitView, fullscreen, signature]);
  return null;
}

function AdmCanvas({ phases, items, typeLabel, selectedId, onSelect, fullscreen, progress }: { phases: TogafPhase[]; items: TogafItem[]; typeLabel: (type: string) => string; selectedId: string | null; onSelect: (id: string) => void; fullscreen: boolean; progress: number }) {
  const { nodes, edges } = useMemo(() => {
    const preliminary = phases.find(isPreliminary);
    const requirements = phases.find(isRequirements);
    const sourceOrder = new Map(phases.map((phase, index) => [phase.id, index]));
    const admOrder = new Map(["A", "B", "C", "D", "E", "F", "G", "H"].map((code, index) => [code, index]));
    const cyclePhases = phases.filter((phase) => phase.id !== preliminary?.id && phase.id !== requirements?.id).sort((left, right) => {
      const leftOrder = admOrder.get(left.code.toLocaleUpperCase("fr")); const rightOrder = admOrder.get(right.code.toLocaleUpperCase("fr"));
      if (leftOrder !== undefined || rightOrder !== undefined) return (leftOrder ?? 100) - (rightOrder ?? 100);
      return (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0);
    });
    const nodeWidth = 118;
    const nodeHeight = 118;
    const center = { x: 700, y: 520 };
    const radius = 330;
    const nextNodes: Node[] = cyclePhases.map((phase, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(cyclePhases.length, 1);
      return { id: phase.id, type: "admPhase", position: { x: center.x + Math.cos(angle) * radius - nodeWidth / 2, y: center.y + Math.sin(angle) * radius - nodeHeight / 2 }, data: { phase, items: items.filter((item) => item.phaseId === phase.id) }, draggable: false, selected: selectedId === phase.id, zIndex: 2 };
    });
    nextNodes.unshift({ id: "__adm-ring", type: "admRing", position: { x: center.x - radius, y: center.y - radius }, data: { phaseCount: cyclePhases.length }, draggable: false, selectable: false, focusable: false, zIndex: -2 });
    const hubItems = requirements ? items.filter((item) => item.phaseId === requirements.id) : [];
    nextNodes.push({ id: "__adm-hub", type: "admHub", position: { x: center.x - 120, y: center.y - 88 }, data: { label: requirements?.name ?? "Gestion des exigences", progress, phaseCount: cyclePhases.length, decisionCount: items.filter((item) => item.type === "Décision" && item.status !== "Validé").length, riskCount: items.filter((item) => item.type === "Risque" && item.status !== "Validé").length, phase: requirements, items: hubItems, typeLabel }, draggable: false, selected: selectedId === "__adm-hub", zIndex: 3 });
    if (preliminary) nextNodes.push({ id: preliminary.id, type: "admPhase", position: { x: center.x - nodeWidth / 2, y: center.y - radius - nodeHeight * 1.5 - 24 }, data: { phase: preliminary, items: items.filter((item) => item.phaseId === preliminary.id), preliminary: true }, draggable: false, selected: selectedId === preliminary.id, zIndex: 2 });

    const sequenceColor = "#64748b";
    const nextEdges: Edge[] = [];
    if (preliminary && cyclePhases[0]) nextEdges.push({ id: "preliminary-entry", source: preliminary.id, target: cyclePhases[0].id, type: "straight", label: "Initialise", labelStyle: { fill: "#64748b", fontSize: 8 }, labelBgStyle: { fill: "var(--surface)", fillOpacity: .9 }, style: { stroke: sequenceColor, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: sequenceColor, width: 15, height: 15 } });
    return { nodes: nextNodes, edges: nextEdges };
  }, [items, phases, progress, selectedId, typeLabel]);

  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, node) => { if (node.id !== "__adm-ring") onSelect(node.id); }} nodesDraggable={false} nodesConnectable={false} elementsSelectable fitView fitViewOptions={{ padding: .12, maxZoom: 1 }} minZoom={.32} maxZoom={1.35} proOptions={{ hideAttribution: true }}>
    <Background gap={32} size={1} color="var(--rf-grid)" />
    <Controls position="bottom-left" showInteractive={false} />
    <AdmFitController signature={`${nodes.map((node) => node.id).join("|")}-${items.length}`} fullscreen={fullscreen} />
  </ReactFlow>;
}

export function TogafTrackingView({ data, configuration }: { data: ViewDataset; configuration?: ViewConfiguration }) {
  const frameRef = useRef<HTMLElement>(null);
  const phases = useMemo(() => {
    const imported = data.togafPhases ?? []; const configured = sectionOf(configuration, "phases")?.items;
    if (!configured) return imported;
    return configured.map((phase) => { const existing = imported.find((candidate) => candidate.id === phase.id); return { id: phase.id, code: String(phase.code ?? phase.id), name: String(phase.label ?? phase.id), status: existing?.status ?? "À démarrer", progress: existing?.progress ?? 0, owner: existing?.owner ?? "", startDate: existing?.startDate ?? "", targetDate: existing?.targetDate ?? "", objective: String(phase.objective ?? existing?.objective ?? ""), gate: String(phase.gate ?? existing?.gate ?? "") } satisfies TogafPhase; });
  }, [configuration, data.togafPhases]);
  const allItems = useMemo(() => data.togafItems ?? [], [data.togafItems]);
  const itemTypes = useMemo(() => (sectionOf(configuration, "itemTypes")?.items ?? []).map((item) => ({ id: item.id, label: String(item.label ?? item.id) })), [configuration]);
  const typeLabel = useMemo(() => (type: string) => itemTypes.find((item) => item.id === type)?.label ?? type, [itemTypes]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("Tous");
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  const items = useMemo(() => typeFilter === "Tous" ? allItems : allItems.filter((item) => item.type === typeFilter), [allItems, typeFilter]);
  const selected = phases.find((phase) => phase.id === selectedId) ?? null;
  const requirements = phases.find(isRequirements) ?? null;
  const requirementsSelected = selectedId === "__adm-hub";
  const selectedItems = items.filter((item) => item.phaseId === selected?.id);
  const requirementsItems = requirements ? items.filter((item) => item.phaseId === requirements.id) : [];
  const blockers = allItems.filter((item) => item.status === "Bloqué" || item.type === "Risque" && item.status !== "Validé");
  const averageProgress = phases.length ? Math.round(phases.reduce((sum, phase) => sum + phase.progress, 0) / phases.length) : 0;
  const gateReady = phases.filter((phase) => phase.status === "À valider").length;
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };

  return <section ref={frameRef} className="view-workspace togaf-workspace togaf-adm-workspace">
    <header className="togaf-header"><div><p className="eyebrow">Architecture Development Method</p><h1>TOGAF ADM</h1></div><div className="togaf-header-metrics"><span><Route size={14} /><b>{averageProgress}%</b> global</span><span className={gateReady ? "review" : ""}><ShieldCheck size={14} /><b>{gateReady}</b> gates</span><span className={blockers.length ? "danger" : ""}><AlertOctagon size={14} /><b>{blockers.length}</b> alertes</span></div><div className="togaf-header-actions"><label className="filter-control"><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrer les éléments TOGAF"><option>Tous</option>{itemTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select><ChevronDown size={14} /></label><button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{fullscreen ? "Quitter" : "Plein écran"}</span></button></div></header>
    <div className="adm-legend"><span><i className="done" /> Validée</span><span><i className="active" /> En cours</span><span><i className="review" /> À valider</span><span><i className="blocked" /> Bloquée</span><span><i className="todo" /> À démarrer</span><em>Cliquez sur une phase pour ouvrir son détail</em></div>
    {!phases.length ? <div className="togaf-empty" data-view-export-content><Route size={32} /><h2>Aucune trajectoire chargée</h2><p>Définissez les phases dans la structure de la vue puis importez leurs éléments.</p></div> : <div className="adm-canvas" data-view-export-content><ReactFlowProvider><AdmCanvas phases={phases} items={items} typeLabel={typeLabel} selectedId={selectedId} onSelect={setSelectedId} fullscreen={fullscreen} progress={averageProgress} /></ReactFlowProvider></div>}
    {selected && <aside className="adm-detail-panel"><button className="panel-close" onClick={() => setSelectedId(null)} aria-label="Fermer le détail"><X size={16} /></button><div className="adm-detail-heading"><span className={`phase-status ${phaseStatusClass(selected.status)}`}>{selected.status}</span><p>{selected.code}</p><h2>{selected.name}</h2><strong>{selected.progress}%</strong><i><b style={{ width: `${selected.progress}%` }} /></i></div><p className="adm-detail-objective">{selected.objective || "Objectif à définir."}</p><dl><div><UserRound size={14} /><dt>Responsable</dt><dd>{selected.owner || "Non défini"}</dd></div><div><CalendarClock size={14} /><dt>Fenêtre</dt><dd>{formatDate(selected.startDate)} → {formatDate(selected.targetDate)}</dd></div><div><ShieldCheck size={14} /><dt>Gate attendue</dt><dd>{selected.gate || "Non définie"}</dd></div></dl><section><header><div><strong>Éléments de la phase</strong><span>{typeFilter === "Tous" ? "Tous les types" : typeLabel(typeFilter)}</span></div><em>{selectedItems.length}</em></header><div>{selectedItems.length ? selectedItems.map((item) => { const Icon = itemTypeIcon(item.type); return <article key={item.id} className={itemStatusClass(item.status)}><Icon size={14} /><div><span>{typeLabel(item.type)} · {item.status}</span><strong>{item.name}</strong><p>{item.detail || "Aucun détail renseigné."}</p><small>{item.owner || "Sans responsable"} · {formatDate(item.dueDate)}</small></div></article>; }) : <p className="adm-detail-empty">Aucun élément avec ce filtre.</p>}</div></section></aside>}
    {requirementsSelected && <aside className="adm-detail-panel"><button className="panel-close" onClick={() => setSelectedId(null)} aria-label="Fermer le détail"><X size={16} /></button><div className="adm-detail-heading requirements"><span className="phase-status active">Transverse</span><p>ADM</p><h2>{requirements?.name ?? "Gestion des exigences"}</h2><strong>{averageProgress}%</strong><i><b style={{ width: `${averageProgress}%` }} /></i></div><p className="adm-detail-objective">{requirements?.objective || "Identifier, documenter, prioriser et maintenir les exigences qui alimentent toutes les phases du cycle ADM."}</p><dl><div><Route size={14} /><dt>Phases pilotées</dt><dd>{phases.filter((phase) => !isPreliminary(phase) && !isRequirements(phase)).length}</dd></div><div><Flag size={14} /><dt>Décisions ouvertes</dt><dd>{allItems.filter((item) => item.type === "Décision" && item.status !== "Validé").length}</dd></div><div><AlertOctagon size={14} /><dt>Risques ouverts</dt><dd>{allItems.filter((item) => item.type === "Risque" && item.status !== "Validé").length}</dd></div></dl><section><header><div><strong>Éléments transverses</strong><span>{typeFilter === "Tous" ? "Tous les types" : typeLabel(typeFilter)}</span></div><em>{requirementsItems.length}</em></header><div>{requirementsItems.length ? requirementsItems.map((item) => { const Icon = itemTypeIcon(item.type); return <article key={item.id} className={itemStatusClass(item.status)}><Icon size={14} /><div><span>{typeLabel(item.type)} · {item.status}</span><strong>{item.name}</strong><p>{item.detail || "Aucun détail renseigné."}</p><small>{item.owner || "Sans responsable"} · {formatDate(item.dueDate)}</small></div></article>; }) : <p className="adm-detail-empty">Aucun élément directement rattaché. Les exigences restent néanmoins transverses à toutes les phases.</p>}</div></section></aside>}
  </section>;
}
