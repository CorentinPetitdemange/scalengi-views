"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, Handle, Position, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { Activity, BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, Eye, EyeOff, FolderGit2, Maximize2, MessageSquareText, Minimize2, Shield, Type, Users, Zap } from "lucide-react";
import { optionOf, sectionOf, type ViewConfiguration } from "./configuration";
import type { Collaborator, Feedback, Process, ResponsibilityKind, ViewDataset } from "./types";

type Visibility = { processes: boolean; responsibilities: boolean; feedbacks: boolean; colleagues: boolean; processLabels: boolean; colleagueLabels: boolean };
const defaultVisibility: Visibility = { processes: true, responsibilities: true, feedbacks: true, colleagues: true, processLabels: false, colleagueLabels: false };
const responsibilityClass: Record<ResponsibilityKind, string> = { Pilote: "rf-role-pilot", Contributeur: "rf-role-contributor", Validation: "rf-role-validation", Consulté: "rf-role-consulted" };

type CenterData = { collaborator: Collaborator };
type ProcessData = { process: Process; responsibility: ResponsibilityKind; selected: boolean; showLabel: boolean; showResponsibility: boolean; onSelect: (processId: string) => void };
type ColleagueData = { collaborator: Collaborator; shared: number; showLabel: boolean };
type ResponsibilityData = { collaborator: Collaborator; kind: ResponsibilityKind };
type FeedbackData = { feedback: Feedback; process: Process };
type OrbitData = { diameter: number; label: string; tone: "primary" | "muted" | "feedback" };

const CenterNode = memo(function CenterNode({ data }: NodeProps<CenterData>) {
  return <div className="rf-user-node"><div className="rf-user-glow" /><div className="rf-user-avatar">{data.collaborator.initials}</div><strong>{data.collaborator.name}</strong><span>{data.collaborator.role}</span></div>;
});

const ProcessNode = memo(function ProcessNode({ data }: NodeProps<ProcessData>) {
  return <button className={`rf-process-node ${data.selected ? "is-selected" : ""} ${data.showLabel ? "show-label" : ""}`} onClick={() => data.onSelect(data.process.id)} title={data.showLabel ? undefined : data.process.name} aria-label={`${data.process.name} — ${data.responsibility}`}>
    <Handle type="target" position={Position.Top} className="rf-hidden-handle" /><Handle type="source" position={Position.Bottom} className="rf-hidden-handle" />
    <div className="rf-process-orbit" /><div className="rf-process-core"><FolderGit2 size={28} /></div>
    {data.showResponsibility && <span className={`rf-role-badge ${responsibilityClass[data.responsibility]}`}><Zap size={11} />{data.responsibility}</span>}
    {data.showLabel && <><strong>{data.process.name}</strong><small>{data.process.status}</small></>}
  </button>;
});

const ColleagueNode = memo(function ColleagueNode({ data }: NodeProps<ColleagueData>) {
  return <div className={`rf-colleague-node ${data.showLabel ? "show-label" : ""}`} title={`${data.collaborator.name} · ${data.shared} processus partagés`}><Handle type="source" position={Position.Top} className="rf-hidden-handle" /><div>{data.collaborator.initials}</div>{data.showLabel && <><strong>{data.collaborator.name}</strong><span>{data.shared} partagé{data.shared > 1 ? "s" : ""}</span></>}</div>;
});

const ResponsibilityNode = memo(function ResponsibilityNode({ data }: NodeProps<ResponsibilityData>) {
  return <div className="rf-responsibility-node"><Handle type="target" position={Position.Top} className="rf-hidden-handle" /><div className={`rf-responsibility-avatar ${responsibilityClass[data.kind]}`}>{data.collaborator.initials}</div><strong>{data.collaborator.name}</strong><span>{data.kind}</span></div>;
});

const FeedbackNode = memo(function FeedbackNode({ data }: NodeProps<FeedbackData>) {
  const [open, setOpen] = useState(false);
  const parsedDate = new Date(data.feedback.createdAt);
  const displayDate = Number.isNaN(parsedDate.getTime()) ? data.feedback.createdAt : parsedDate.toLocaleDateString("fr-FR");
  return <button className={`rf-feedback-node ${open ? "is-open" : ""}`} onClick={() => setOpen((value) => !value)} title={data.feedback.content}><Handle type="target" position={Position.Top} className="rf-hidden-handle" /><MessageSquareText size={18} />{open && <span><strong>{data.process.name}</strong>{data.feedback.content}{displayDate && <small>{displayDate}</small>}</span>}</button>;
});

const OrbitNode = memo(function OrbitNode({ data }: NodeProps<OrbitData>) {
  return <div className={`rf-orbit rf-orbit-${data.tone}`} style={{ width: data.diameter, height: data.diameter }}><span>{data.label}</span></div>;
});

const nodeTypes = { center: CenterNode, process: ProcessNode, colleague: ColleagueNode, responsibility: ResponsibilityNode, feedback: FeedbackNode, orbit: OrbitNode };

function FitController({ signature, fullscreen }: { signature: string; fullscreen: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => { const timeout = window.setTimeout(() => fitView({ padding: .12, duration: 650, maxZoom: 1 }), 80); return () => window.clearTimeout(timeout); }, [fitView, fullscreen, signature]);
  return null;
}

function GalaxyDisplayToolbar({ visibility, onToggle, radius, onRadius, labels, available }: { visibility: Visibility; onToggle: (key: keyof Visibility) => void; radius: number; onRadius: (radius: number) => void; labels: Record<string, string>; available: Set<string> }) {
  const [collapsed, setCollapsed] = useState(true);
  const layers: Array<{ key: keyof Visibility; label: string; icon: typeof Activity }> = [
    { key: "processes", label: labels.processes, icon: Activity }, { key: "responsibilities", label: labels.responsibilities, icon: Shield },
    { key: "feedbacks", label: labels.feedbacks, icon: MessageSquareText }, { key: "colleagues", label: labels.colleagues, icon: Users },
  ].filter((layer) => available.has(layer.key)) as Array<{ key: keyof Visibility; label: string; icon: typeof Activity }>;
  return <aside className={`galaxy-display-toolbar ${collapsed ? "is-collapsed" : ""}`} aria-label="Affichage des anneaux">
    <header>{!collapsed && <strong>Anneaux</strong>}<button onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Ouvrir les options d’affichage" : "Réduire les options d’affichage"}>{collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button></header>
    <div className="galaxy-layer-list">{layers.map((layer) => { const Icon = layer.icon; const active = visibility[layer.key]; return <button key={layer.key} className={active ? "active" : ""} onClick={() => onToggle(layer.key)} title={collapsed ? layer.label : undefined}><Icon size={16} />{!collapsed && <><span>{layer.label}</span>{active ? <Eye size={15} /> : <EyeOff size={15} />}</>}</button>; })}</div>
    <div className="galaxy-toolbar-separator" />
    <button className={visibility.processLabels ? "active" : ""} onClick={() => onToggle("processLabels")} title={collapsed ? "Noms des processus" : undefined}><Type size={16} />{!collapsed && <><span>Noms des processus</span>{visibility.processLabels && <Check size={14} />}</>}</button>
    <button className={visibility.colleagueLabels ? "active" : ""} onClick={() => onToggle("colleagueLabels")} title={collapsed ? "Noms des collègues" : undefined}><Users size={16} />{!collapsed && <><span>Noms des collègues</span>{visibility.colleagueLabels && <Check size={14} />}</>}</button>
    {!collapsed && <div className="galaxy-radius-control"><label><CircleDashed size={14} /> Rayon <span>{radius}px</span></label><input type="range" min="280" max="760" step="40" value={radius} onChange={(event) => onRadius(Number(event.target.value))} /></div>}
  </aside>;
}

function CollaboratorCanvas({ data, current, selectedProcessId, onSelectProcess, fullscreen, visibility, radius, onToggle, onRadius, labels, available }: { data: ViewDataset; current: Collaborator; selectedProcessId: string | null; onSelectProcess: (id: string) => void; fullscreen: boolean; visibility: Visibility; radius: number; onToggle: (key: keyof Visibility) => void; onRadius: (radius: number) => void; labels: Record<string, string>; available: Set<string> }) {
  const { nodes, edges, processCount, colleagueCount, feedbackCount } = useMemo(() => {
    const currentResponsibilities = data.responsibilities.filter((item) => item.collaboratorId === current.id);
    const currentProcesses = currentResponsibilities.map((responsibility) => ({ process: data.processes.find((item) => item.id === responsibility.processId), responsibility })).filter((item): item is { process: Process; responsibility: typeof currentResponsibilities[number] } => Boolean(item.process));
    const processIds = new Set(currentProcesses.map((item) => item.process.id));
    const colleagues = data.collaborators.filter((collaborator) => collaborator.id !== current.id && data.responsibilities.some((responsibility) => responsibility.collaboratorId === collaborator.id && processIds.has(responsibility.processId)));
    const feedbacks = (data.feedbacks ?? []).filter((feedback) => processIds.has(feedback.processId));
    const center = { x: 900, y: 760 };
    const feedbackRadius = radius + 260;
    const colleagueRadius = radius + 500;
    const nextNodes: Node[] = [{ id: "current", type: "center", position: { x: center.x - 78, y: center.y - 78 }, data: { collaborator: current }, draggable: false, zIndex: 10 }];
    const nextEdges: Edge[] = [];

    if (visibility.processes) nextNodes.push({ id: "orbit-process", type: "orbit", position: { x: center.x - radius, y: center.y - radius }, data: { diameter: radius * 2, label: labels.processes, tone: "primary" }, draggable: false, selectable: false, zIndex: -2 });
    if (visibility.feedbacks && feedbacks.length) nextNodes.push({ id: "orbit-feedback", type: "orbit", position: { x: center.x - feedbackRadius, y: center.y - feedbackRadius }, data: { diameter: feedbackRadius * 2, label: labels.feedbacks, tone: "feedback" }, draggable: false, selectable: false, zIndex: -2 });
    if (visibility.colleagues && colleagues.length) nextNodes.push({ id: "orbit-colleague", type: "orbit", position: { x: center.x - colleagueRadius, y: center.y - colleagueRadius }, data: { diameter: colleagueRadius * 2, label: labels.colleagues, tone: "muted" }, draggable: false, selectable: false, zIndex: -3 });

    if (visibility.processes) currentProcesses.forEach(({ process, responsibility }, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(currentProcesses.length, 1);
      nextNodes.push({ id: `process-${process.id}`, type: "process", position: { x: center.x + Math.cos(angle) * radius - 88, y: center.y + Math.sin(angle) * radius - 88 }, data: { process, responsibility: responsibility.kind, selected: selectedProcessId === process.id, showLabel: visibility.processLabels, showResponsibility: visibility.responsibilities, onSelect: onSelectProcess }, draggable: false, zIndex: 5 });
    });

    if (visibility.responsibilities && selectedProcessId && visibility.processes) {
      const selectedIndex = currentProcesses.findIndex((item) => item.process.id === selectedProcessId);
      const baseAngle = -Math.PI / 2 + (Math.PI * 2 * Math.max(selectedIndex, 0)) / Math.max(currentProcesses.length, 1);
      const related = data.responsibilities.filter((item) => item.processId === selectedProcessId);
      related.forEach((responsibility, index) => {
        const collaborator = data.collaborators.find((item) => item.id === responsibility.collaboratorId); if (!collaborator) return;
        const angle = baseAngle - .38 + (related.length <= 1 ? 0 : index * .76 / (related.length - 1));
        const responsibilityRadius = radius + 145;
        const nodeId = `responsibility-${responsibility.id}`;
        nextNodes.push({ id: nodeId, type: "responsibility", position: { x: center.x + Math.cos(angle) * responsibilityRadius - 42, y: center.y + Math.sin(angle) * responsibilityRadius - 42 }, data: { collaborator, kind: responsibility.kind }, draggable: false, zIndex: 8 });
        nextEdges.push({ id: `process-responsibility-${responsibility.id}`, source: `process-${selectedProcessId}`, target: nodeId, animated: true, style: { stroke: "var(--primary)", strokeWidth: 1.2, opacity: .42, strokeDasharray: "5 5" } });
      });
    }

    if (visibility.feedbacks) feedbacks.forEach((feedback, index) => {
      const process = data.processes.find((item) => item.id === feedback.processId); if (!process) return;
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(feedbacks.length, 1);
      const nodeId = `feedback-${feedback.id}`;
      nextNodes.push({ id: nodeId, type: "feedback", position: { x: center.x + Math.cos(angle) * feedbackRadius - 22, y: center.y + Math.sin(angle) * feedbackRadius - 22 }, data: { feedback, process }, draggable: false, zIndex: 7 });
      if (visibility.processes) nextEdges.push({ id: `process-feedback-${feedback.id}`, source: `process-${feedback.processId}`, target: nodeId, style: { stroke: "#ec4899", strokeWidth: 1.2, opacity: .38, strokeDasharray: "4 4" } });
    });

    if (visibility.colleagues) colleagues.forEach((collaborator, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(colleagues.length, 1);
      const sharedProcessIds = data.responsibilities.filter((item) => item.collaboratorId === collaborator.id && processIds.has(item.processId)).map((item) => item.processId);
      const nodeId = `colleague-${collaborator.id}`;
      nextNodes.push({ id: nodeId, type: "colleague", position: { x: center.x + Math.cos(angle) * colleagueRadius - 44, y: center.y + Math.sin(angle) * colleagueRadius - 44 }, data: { collaborator, shared: sharedProcessIds.length, showLabel: visibility.colleagueLabels }, draggable: false, zIndex: 4 });
      if (visibility.processes) sharedProcessIds.forEach((processId) => nextEdges.push({ id: `${processId}-${nodeId}`, source: nodeId, target: `process-${processId}`, animated: selectedProcessId === processId, style: { stroke: "#94a3b8", strokeWidth: 1, opacity: selectedProcessId && selectedProcessId !== processId ? .1 : .34, strokeDasharray: "5 5" } }));
    });
    return { nodes: nextNodes, edges: nextEdges, processCount: currentProcesses.length, colleagueCount: colleagues.length, feedbackCount: feedbacks.length };
  }, [current, data, labels, onSelectProcess, radius, selectedProcessId, visibility]);

  return <><div className="journey-summary rf-summary"><span><BriefcaseBusiness size={15} /> {processCount} processus</span><span><Users size={15} /> {colleagueCount} collaborateurs liés</span><span><MessageSquareText size={15} /> {feedbackCount} retours</span></div>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable fitView fitViewOptions={{ padding: .12, maxZoom: 1 }} minZoom={.18} maxZoom={1.35} proOptions={{ hideAttribution: true }}><Background gap={25} size={1} color="var(--rf-grid)" /><Controls position="bottom-left" showInteractive={false} /><FitController signature={`${current.id}-${nodes.length}-${selectedProcessId ?? ""}-${radius}-${Object.values(visibility).join("")}`} fullscreen={fullscreen} /></ReactFlow>
    <GalaxyDisplayToolbar visibility={visibility} onToggle={onToggle} radius={radius} onRadius={onRadius} labels={labels} available={available} />
  </>;
}

export function CollaboratorJourneyView({ data, configuration }: { data: ViewDataset; configuration?: ViewConfiguration }) {
  const galaxyItems = sectionOf(configuration, "galaxies")?.items;
  const labels = useMemo(() => ({ processes: String(galaxyItems?.find((item) => item.id === "processes")?.label ?? "Processus"), responsibilities: String(galaxyItems?.find((item) => item.id === "roles")?.label ?? "Responsabilités"), feedbacks: String(galaxyItems?.find((item) => item.id === "feedbacks")?.label ?? "Retours"), colleagues: String(galaxyItems?.find((item) => item.id === "colleagues")?.label ?? "Collaborateurs") }), [galaxyItems]);
  const available = useMemo(() => galaxyItems ? new Set(galaxyItems.map((item) => item.id === "roles" ? "responsibilities" : item.id)) : new Set(["processes", "responsibilities", "feedbacks", "colleagues"]), [galaxyItems]);
  const [currentId, setCurrentId] = useState(data.collaborators[0]?.id ?? "");
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>(defaultVisibility);
  const [radius, setRadius] = useState<number>(() => optionOf(configuration, "radius", 400));
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLElement>(null);
  const current = data.collaborators.find((item) => item.id === currentId) ?? data.collaborators[0];
  const selectedProcess = data.processes.find((item) => item.id === selectedProcessId);
  const selectedResponsibilities = data.responsibilities.filter((item) => item.processId === selectedProcessId);
  const onSelectProcess = useCallback((id: string) => setSelectedProcessId((currentValue) => currentValue === id ? null : id), []);
  const toggleVisibility = useCallback((key: keyof Visibility) => setVisibility((currentValue) => ({ ...currentValue, [key]: !currentValue[key] })), []);
  const effectiveVisibility = useMemo(() => ({ ...visibility, processes: visibility.processes && available.has("processes"), responsibilities: visibility.responsibilities && available.has("responsibilities"), feedbacks: visibility.feedbacks && available.has("feedbacks"), colleagues: visibility.colleagues && available.has("colleagues"), processLabels: visibility.processLabels && available.has("processes"), colleagueLabels: visibility.colleagueLabels && available.has("colleagues") }), [available, visibility]);

  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };
  if (!current) return <div className="empty-state">Ajoutez un collaborateur pour afficher cette vue.</div>;

  return <section ref={frameRef} className="view-workspace rf-view-workspace"><div className="view-toolbar rf-view-toolbar"><div><p className="eyebrow">Vue centrée collaborateur</p><h1>Écosystème de collaboration</h1></div><div className="rf-toolbar-actions"><label className="select-control"><span>Point de vue</span><div><select value={current.id} onChange={(event) => { setCurrentId(event.target.value); setSelectedProcessId(null); }}>{data.collaborators.map((collaborator) => <option value={collaborator.id} key={collaborator.id}>{collaborator.name}</option>)}</select><ChevronDown size={15} /></div></label><button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{fullscreen ? "Quitter" : "Plein écran"}</span></button></div></div>
    <div className="rf-canvas-area" data-view-export-content><ReactFlowProvider><CollaboratorCanvas data={data} current={current} selectedProcessId={selectedProcessId} onSelectProcess={onSelectProcess} fullscreen={fullscreen} visibility={effectiveVisibility} radius={radius} onToggle={toggleVisibility} onRadius={setRadius} labels={labels} available={available} /></ReactFlowProvider></div>
    {selectedProcess && <aside className="context-panel rf-context-panel"><button className="panel-close" onClick={() => setSelectedProcessId(null)} aria-label="Fermer le détail">×</button><p className="eyebrow">Processus sélectionné</p><h2>{selectedProcess.name}</h2><span className="status-chip">{selectedProcess.status}</span><div className="panel-section"><h3>Équipe associée</h3>{selectedResponsibilities.map((responsibility) => { const collaborator = data.collaborators.find((item) => item.id === responsibility.collaboratorId); return collaborator ? <div className="person-row" key={responsibility.id}><span className="mini-avatar">{collaborator.initials}</span><div><strong>{collaborator.name}</strong><small>{responsibility.kind}</small></div></div> : null; })}</div><div className="panel-section"><h3>Retours</h3>{(data.feedbacks ?? []).filter((feedback) => feedback.processId === selectedProcess.id).map((feedback) => <div className="journey-feedback-row" key={feedback.id}>{feedback.content}</div>)}</div></aside>}
  </section>;
}
