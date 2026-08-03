"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  BriefcaseBusiness,
  ChevronDown,
  Eye,
  FolderGit2,
  Maximize2,
  Minimize2,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type {
  Collaborator,
  Process,
  ResponsibilityKind,
  ViewDataset,
} from "./types";

const responsibilityMeta: Record<ResponsibilityKind, { className: string; icon: typeof Zap }> = {
  Pilote: { className: "rf-role-pilot", icon: Zap },
  Contributeur: { className: "rf-role-contributor", icon: TrendingUp },
  Validation: { className: "rf-role-validation", icon: Shield },
  Consulté: { className: "rf-role-consulted", icon: Eye },
};

type CenterData = { collaborator: Collaborator };
type ProcessData = {
  process: Process;
  responsibility: ResponsibilityKind;
  selected: boolean;
  onSelect: (processId: string) => void;
};
type ColleagueData = { collaborator: Collaborator; shared: number };
type OrbitData = { diameter: number; label: string; tone: "primary" | "muted" };

const CenterNode = memo(function CenterNode({ data }: NodeProps<CenterData>) {
  return (
    <div className="rf-user-node">
      <Handle type="source" position={Position.Top} className="rf-hidden-handle" />
      <div className="rf-user-glow" />
      <div className="rf-user-avatar">{data.collaborator.initials}</div>
      <strong>{data.collaborator.name}</strong>
      <span>{data.collaborator.role}</span>
    </div>
  );
});

const ProcessNode = memo(function ProcessNode({ data }: NodeProps<ProcessData>) {
  const meta = responsibilityMeta[data.responsibility];
  const RoleIcon = meta.icon;
  return (
    <button className={`rf-process-node ${data.selected ? "is-selected" : ""}`} onClick={() => data.onSelect(data.process.id)}>
      <Handle type="target" position={Position.Top} className="rf-hidden-handle" />
      <Handle type="source" position={Position.Bottom} className="rf-hidden-handle" />
      <div className="rf-process-orbit" />
      <div className="rf-process-core"><FolderGit2 size={28} /></div>
      <span className={`rf-role-badge ${meta.className}`}><RoleIcon size={11} />{data.responsibility}</span>
      <strong>{data.process.name}</strong>
      <small>{data.process.status}</small>
    </button>
  );
});

const ColleagueNode = memo(function ColleagueNode({ data }: NodeProps<ColleagueData>) {
  return (
    <div className="rf-colleague-node" title={`${data.shared} processus partagés`}>
      <Handle type="target" position={Position.Top} className="rf-hidden-handle" />
      <div>{data.collaborator.initials}</div>
      <strong>{data.collaborator.name}</strong>
      <span>{data.shared} partagé{data.shared > 1 ? "s" : ""}</span>
    </div>
  );
});

const OrbitNode = memo(function OrbitNode({ data }: NodeProps<OrbitData>) {
  return <div className={`rf-orbit rf-orbit-${data.tone}`} style={{ width: data.diameter, height: data.diameter }}><span>{data.label}</span></div>;
});

const nodeTypes = { center: CenterNode, process: ProcessNode, colleague: ColleagueNode, orbit: OrbitNode };

function FitController({ signature, fullscreen }: { signature: string; fullscreen: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const timeout = window.setTimeout(() => fitView({ padding: 0.1, duration: 650, maxZoom: 1 }), 80);
    return () => window.clearTimeout(timeout);
  }, [fitView, fullscreen, signature]);
  return null;
}

function CollaboratorCanvas({ data, current, selectedProcessId, onSelectProcess, fullscreen }: {
  data: ViewDataset;
  current: Collaborator;
  selectedProcessId: string | null;
  onSelectProcess: (id: string) => void;
  fullscreen: boolean;
}) {
  const { nodes, edges, processCount, colleagueCount } = useMemo(() => {
    const currentResponsibilities = data.responsibilities.filter((item) => item.collaboratorId === current.id);
    const currentProcesses = currentResponsibilities.map((responsibility) => ({
      process: data.processes.find((item) => item.id === responsibility.processId),
      responsibility,
    })).filter((item): item is { process: Process; responsibility: typeof currentResponsibilities[number] } => Boolean(item.process));
    const processIds = new Set(currentProcesses.map((item) => item.process.id));
    const colleagues = data.collaborators.filter((collaborator) => collaborator.id !== current.id && data.responsibilities.some((responsibility) => responsibility.collaboratorId === collaborator.id && processIds.has(responsibility.processId)));

    const center = { x: 700, y: 560 };
    const processRadius = Math.max(300, currentProcesses.length * 62);
    const colleagueRadius = processRadius + 330;
    const nextNodes: Node[] = [
      { id: "orbit-process", type: "orbit", position: { x: center.x - processRadius, y: center.y - processRadius }, data: { diameter: processRadius * 2, label: "Processus", tone: "primary" }, draggable: false, selectable: false, zIndex: -2 },
      { id: "orbit-colleague", type: "orbit", position: { x: center.x - colleagueRadius, y: center.y - colleagueRadius }, data: { diameter: colleagueRadius * 2, label: "Collaborateurs", tone: "muted" }, draggable: false, selectable: false, zIndex: -3 },
      { id: "current", type: "center", position: { x: center.x - 78, y: center.y - 78 }, data: { collaborator: current }, draggable: false, zIndex: 10 },
    ];
    const nextEdges: Edge[] = [];

    currentProcesses.forEach(({ process, responsibility }, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(currentProcesses.length, 1);
      const nodeId = `process-${process.id}`;
      nextNodes.push({
        id: nodeId,
        type: "process",
        position: { x: center.x + Math.cos(angle) * processRadius - 88, y: center.y + Math.sin(angle) * processRadius - 88 },
        data: { process, responsibility: responsibility.kind, selected: selectedProcessId === process.id, onSelect: onSelectProcess },
        draggable: false,
        zIndex: 5,
      });
      nextEdges.push({ id: `current-${nodeId}`, source: "current", target: nodeId, type: "smoothstep", style: { stroke: "var(--primary)", strokeWidth: 1.5, opacity: .36 } });
    });

    colleagues.forEach((collaborator, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(colleagues.length, 1);
      const sharedProcessIds = data.responsibilities.filter((item) => item.collaboratorId === collaborator.id && processIds.has(item.processId)).map((item) => item.processId);
      const nodeId = `colleague-${collaborator.id}`;
      nextNodes.push({ id: nodeId, type: "colleague", position: { x: center.x + Math.cos(angle) * colleagueRadius - 44, y: center.y + Math.sin(angle) * colleagueRadius - 44 }, data: { collaborator, shared: sharedProcessIds.length }, draggable: false, zIndex: 4 });
      sharedProcessIds.forEach((processId) => nextEdges.push({ id: `${processId}-${nodeId}`, source: `process-${processId}`, target: nodeId, type: "default", animated: selectedProcessId === processId, style: { stroke: "#94a3b8", strokeWidth: 1, opacity: selectedProcessId && selectedProcessId !== processId ? .1 : .38, strokeDasharray: "5 5" } }));
    });

    return { nodes: nextNodes, edges: nextEdges, processCount: currentProcesses.length, colleagueCount: colleagues.length };
  }, [current, data, onSelectProcess, selectedProcessId]);

  return (
    <>
      <div className="journey-summary rf-summary">
        <span><BriefcaseBusiness size={15} /> {processCount} processus</span>
        <span><Users size={15} /> {colleagueCount} collaborateurs liés</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: .1, maxZoom: 1 }}
        minZoom={.22}
        maxZoom={1.35}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={25} size={1} color="var(--rf-grid)" />
        <Controls position="bottom-left" showInteractive={false} />
        <FitController signature={`${current.id}-${nodes.length}-${selectedProcessId ?? ""}`} fullscreen={fullscreen} />
      </ReactFlow>
    </>
  );
}

export function CollaboratorJourneyView({ data }: { data: ViewDataset }) {
  const [currentId, setCurrentId] = useState(data.collaborators[0]?.id ?? "");
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLElement>(null);
  const current = data.collaborators.find((item) => item.id === currentId) ?? data.collaborators[0];
  const selectedProcess = data.processes.find((item) => item.id === selectedProcessId);
  const selectedResponsibilities = data.responsibilities.filter((item) => item.processId === selectedProcessId);
  const onSelectProcess = useCallback((id: string) => setSelectedProcessId(id), []);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await frameRef.current?.requestFullscreen();
  };

  if (!current) return <div className="empty-state">Ajoutez un collaborateur pour afficher cette vue.</div>;

  return (
    <section ref={frameRef} className="view-workspace rf-view-workspace">
      <div className="view-toolbar rf-view-toolbar">
        <div><p className="eyebrow">Vue centrée collaborateur</p><h1>Écosystème de collaboration</h1></div>
        <div className="rf-toolbar-actions">
          <label className="select-control"><span>Point de vue</span><div><select value={current.id} onChange={(event) => { setCurrentId(event.target.value); setSelectedProcessId(null); }}>{data.collaborators.map((collaborator) => <option value={collaborator.id} key={collaborator.id}>{collaborator.name}</option>)}</select><ChevronDown size={15} /></div></label>
          <button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{fullscreen ? "Quitter" : "Plein écran"}</span></button>
        </div>
      </div>
      <div className="rf-canvas-area">
        <ReactFlowProvider><CollaboratorCanvas data={data} current={current} selectedProcessId={selectedProcessId} onSelectProcess={onSelectProcess} fullscreen={fullscreen} /></ReactFlowProvider>
      </div>
      {selectedProcess && <aside className="context-panel rf-context-panel"><button className="panel-close" onClick={() => setSelectedProcessId(null)} aria-label="Fermer le détail">×</button><p className="eyebrow">Processus sélectionné</p><h2>{selectedProcess.name}</h2><span className="status-chip">{selectedProcess.status}</span><div className="panel-section"><h3>Équipe associée</h3>{selectedResponsibilities.map((responsibility) => { const collaborator = data.collaborators.find((item) => item.id === responsibility.collaboratorId); return collaborator ? <div className="person-row" key={responsibility.id}><span className="mini-avatar">{collaborator.initials}</span><div><strong>{collaborator.name}</strong><small>{responsibility.kind}</small></div></div> : null; })}</div></aside>}
    </section>
  );
}
