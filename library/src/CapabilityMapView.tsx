"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  AlertTriangle,
  AppWindow,
  ChevronDown,
  Layers3,
  Maximize2,
  Minimize2,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { Application, Capability, Health, ViewDataset } from "./types";

const healthLabel: Record<Health, string> = { healthy: "Sain", watch: "À surveiller", critical: "Critique" };
type PosHealth = Health | "uncovered";
type DomainData = { name: string; count: number; width: number; height: number };
type CapabilityData = {
  capability: Capability;
  applications: Application[];
  health: PosHealth;
  onSelect: (capability: Capability) => void;
};

const DomainNode = memo(function DomainNode({ data }: NodeProps<DomainData>) {
  return <div className="rf-pos-domain" style={{ width: data.width, height: data.height }}><header><strong>{data.name}</strong><span>{data.count} capacités</span></header></div>;
});

const CapabilityNode = memo(function CapabilityNode({ data }: NodeProps<CapabilityData>) {
  return (
    <button className={`rf-capability-node rf-capability-${data.health}`} onClick={() => data.onSelect(data.capability)}>
      <div className="rf-capability-title"><strong>{data.capability.name}</strong><span>M{data.capability.maturity}</span></div>
      <div className="rf-capability-apps">
        {data.applications.length ? data.applications.map((app) => <span key={app.id}><i className={`health-dot ${app.health}`} />{app.name}</span>) : <span className="rf-uncovered-app">Aucune application</span>}
      </div>
      <footer><span>{data.capability.owner}</span><em>{data.capability.criticality}</em></footer>
    </button>
  );
});

const nodeTypes = { domain: DomainNode, capability: CapabilityNode };

function PosFitController({ signature, fullscreen }: { signature: string; fullscreen: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const timeout = window.setTimeout(() => fitView({ padding: .05, duration: 650, maxZoom: 1 }), 80);
    return () => window.clearTimeout(timeout);
  }, [fitView, fullscreen, signature]);
  return null;
}

function PosCanvas({ data, filtered, domains, onSelect, fullscreen }: {
  data: ViewDataset;
  filtered: Capability[];
  domains: string[];
  onSelect: (capability: Capability) => void;
  fullscreen: boolean;
}) {
  const nodes = useMemo(() => {
    const domainWidth = 310;
    const domainGap = 28;
    const rowHeight = 124;
    const nextNodes: Node[] = [];
    let visibleIndex = 0;
    domains.forEach((domain) => {
      const capabilities = filtered.filter((capability) => capability.domain === domain);
      if (!capabilities.length) return;
      const x = visibleIndex * (domainWidth + domainGap);
      const height = 72 + capabilities.length * rowHeight + 14;
      nextNodes.push({ id: `domain-${domain}`, type: "domain", position: { x, y: 0 }, data: { name: domain, count: capabilities.length, width: domainWidth, height }, draggable: false, selectable: false, zIndex: -1 });
      capabilities.forEach((capability, index) => {
        const applications = capability.applicationIds.map((id) => data.applications.find((app) => app.id === id)).filter((app): app is Application => Boolean(app));
        const health: PosHealth = !applications.length ? "uncovered" : applications.some((app) => app.health === "critical") ? "critical" : applications.some((app) => app.health === "watch") ? "watch" : "healthy";
        nextNodes.push({ id: capability.id, type: "capability", position: { x: x + 13, y: 60 + index * rowHeight }, data: { capability, applications, health, onSelect }, draggable: false, zIndex: 2 });
      });
      visibleIndex += 1;
    });
    return nextNodes;
  }, [data.applications, domains, filtered, onSelect]);

  return (
    <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} fitView fitViewOptions={{ padding: .05, maxZoom: 1 }} minZoom={.3} maxZoom={1.35} proOptions={{ hideAttribution: true }}>
      <Background gap={25} size={1} color="var(--rf-grid)" />
      <Controls position="bottom-left" showInteractive={false} />
      <PosFitController signature={nodes.map((node) => node.id).join("|")} fullscreen={fullscreen} />
      {!nodes.length && <div className="rf-empty-overlay">Aucune capacité ne correspond aux filtres.</div>}
    </ReactFlow>
  );
}

export function CapabilityMapView({ data }: { data: ViewDataset }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Health | "uncovered">("all");
  const [selected, setSelected] = useState<Capability | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLElement>(null);
  const domains = [...new Set(data.capabilities.map((capability) => capability.domain))];
  const filtered = useMemo(() => data.capabilities.filter((capability) => {
    const applications = capability.applicationIds.map((id) => data.applications.find((application) => application.id === id)).filter(Boolean);
    const matchesQuery = `${capability.name} ${capability.domain} ${applications.map((app) => app?.name).join(" ")}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "all" || (filter === "uncovered" && applications.length === 0) || applications.some((app) => app?.health === filter));
  }), [data, filter, query]);
  const covered = Math.round((data.capabilities.filter((capability) => capability.applicationIds.length > 0).length / Math.max(data.capabilities.length, 1)) * 100);
  const criticalApplications = data.applications.filter((application) => application.health === "critical").length;
  const fragileCapabilities = data.capabilities.filter((capability) => capability.maturity <= 2 || capability.applicationIds.length === 0).length;

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await frameRef.current?.requestFullscreen();
  };

  return (
    <section ref={frameRef} className="view-workspace rf-view-workspace rf-pos-workspace">
      <div className="rf-pos-header">
        <div className="rf-pos-title"><p className="eyebrow">Cartographie des capacités</p><h1>Couverture fonctionnelle du SI</h1></div>
        <div className="rf-pos-filters">
          <label className="search-control"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une capacité…" /></label>
          <label className="filter-control"><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Tous les états</option><option value="healthy">Applications saines</option><option value="watch">À surveiller</option><option value="critical">Critiques</option><option value="uncovered">Non couvertes</option></select><ChevronDown size={15} /></label>
        </div>
        <div className="rf-pos-kpis">
          <span><Layers3 size={15} /><small>Couverture</small><strong>{covered}%</strong></span>
          <span><AlertTriangle size={15} /><small>Fragilités</small><strong>{fragileCapabilities}</strong></span>
          <span><AppWindow size={15} /><small>Critiques</small><strong>{criticalApplications}</strong></span>
          <span><ShieldCheck size={15} /><small>Maîtrisées</small><strong>{data.capabilities.filter((item) => item.maturity >= 4).length}</strong></span>
        </div>
        <button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{fullscreen ? "Quitter" : "Plein écran"}</span></button>
      </div>
      <div className="rf-pos-legend"><span><i className="health-dot healthy" /> Sain</span><span><i className="health-dot watch" /> À surveiller</span><span><i className="health-dot critical" /> Critique</span><span><i className="health-dot uncovered" /> Non couvert</span></div>
      <div className="rf-canvas-area rf-pos-canvas"><ReactFlowProvider><PosCanvas data={data} filtered={filtered} domains={domains} onSelect={setSelected} fullscreen={fullscreen} /></ReactFlowProvider></div>

      {selected && <aside className="context-panel rf-context-panel rf-pos-detail"><button className="panel-close" onClick={() => setSelected(null)} aria-label="Fermer le détail">×</button><p className="eyebrow">Capacité métier</p><h2>{selected.name}</h2><div className="detail-score"><span>Maturité</span><strong>{selected.maturity}/5</strong></div><dl className="detail-list"><div><dt>Domaine</dt><dd>{selected.domain}</dd></div><div><dt>Responsable</dt><dd>{selected.owner}</dd></div><div><dt>Criticité</dt><dd>{selected.criticality}</dd></div></dl><div className="panel-section"><h3>Applications de couverture</h3>{selected.applicationIds.length ? selected.applicationIds.map((id) => { const app = data.applications.find((item) => item.id === id); return app ? <div className="application-row" key={id}><i className={`health-dot ${app.health}`} /><div><strong>{app.name}</strong><small>{healthLabel[app.health]} · {app.lifecycle}</small></div></div> : null; }) : <div className="warning-box">Cette capacité n’est couverte par aucune application.</div>}</div></aside>}
    </section>
  );
}
