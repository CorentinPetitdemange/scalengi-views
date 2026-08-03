"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, ReactFlowProvider, useReactFlow, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { AppWindow, Building2, ChevronDown, Layers3, MapPinned, Maximize2, Minimize2, Search } from "lucide-react";
import type { Application, Health, UrbanBlock, UrbanDistrict, UrbanZone, ViewDataset } from "./types";

const healthLabel: Record<Health, string> = { healthy: "Sain", watch: "À surveiller", critical: "Critique" };
type ZoneData = UrbanZone & { width: number; height: number; districtCount: number };
type DistrictData = UrbanDistrict & { width: number; height: number; blockCount: number };
type BlockData = UrbanBlock & { width: number; height: number; applicationCount: number };
type ApplicationData = { application: Application };

const ZoneNode = memo(function ZoneNode({ data }: NodeProps<ZoneData>) {
  return <section className="urban-zone-node" style={{ width: data.width, height: data.height }}><header><div><span>Zone</span><strong>{data.name}</strong></div><em>{data.districtCount} quartier{data.districtCount > 1 ? "s" : ""}</em></header><p>{data.description}</p></section>;
});

const DistrictNode = memo(function DistrictNode({ data }: NodeProps<DistrictData>) {
  return <section className="urban-district-node" style={{ width: data.width, height: data.height }}><header><div><span>Quartier</span><strong>{data.name}</strong></div><em>{data.blockCount} îlot{data.blockCount > 1 ? "s" : ""}</em></header><p>{data.description}</p></section>;
});

const BlockNode = memo(function BlockNode({ data }: NodeProps<BlockData>) {
  return <section className="urban-block-node" style={{ width: data.width, height: data.height }}><header><div><span>Îlot</span><strong>{data.name}</strong></div><em className={`urban-block-status status-${data.status.toLowerCase().replaceAll(" ", "-").replaceAll("à", "a")}`}>{data.status}</em></header><footer><span>{data.owner}</span><strong>{data.applicationCount} application{data.applicationCount > 1 ? "s" : ""}</strong></footer></section>;
});

const ApplicationNode = memo(function ApplicationNode({ data }: NodeProps<ApplicationData>) {
  return <div className={`urban-application-node health-${data.application.health}`}><span className={`health-dot ${data.application.health}`} /><div><strong>{data.application.name}</strong><small>{data.application.lifecycle}</small></div></div>;
});

const nodeTypes = { urbanZone: ZoneNode, urbanDistrict: DistrictNode, urbanBlock: BlockNode, urbanApplication: ApplicationNode };

function FitController({ signature, fullscreen }: { signature: string; fullscreen: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => { const timeout = window.setTimeout(() => fitView({ padding: .045, duration: 650, maxZoom: 1 }), 80); return () => window.clearTimeout(timeout); }, [fitView, fullscreen, signature]);
  return null;
}

function UrbanCanvas({ data, applications, onSelect, fullscreen }: { data: ViewDataset; applications: Application[]; onSelect: (application: Application) => void; fullscreen: boolean }) {
  const nodes = useMemo(() => {
    const districtWidth = 410;
    const districtGap = 18;
    const blockWidth = 380;
    const appWidth = 170;
    const appHeight = 58;
    const appGapX = 10;
    const appGapY = 9;
    const zoneGap = 30;
    const nextNodes: Node[] = [];
    let zoneX = 0;

    data.urbanZones.forEach((zone) => {
      const districts = data.urbanDistricts.filter((district) => district.zoneId === zone.id);
      const districtLayouts = districts.map((district) => {
        const blocks = data.urbanBlocks.filter((block) => block.districtId === district.id);
        const blockLayouts = blocks.map((block) => {
          const blockApplications = applications.filter((application) => application.urbanBlockId === block.id);
          const rows = Math.max(1, Math.ceil(blockApplications.length / 2));
          return { block, applications: blockApplications, height: 82 + rows * appHeight + Math.max(0, rows - 1) * appGapY };
        });
        const height = 64 + blockLayouts.reduce((total, block) => total + block.height + 14, 0) + 12;
        return { district, blocks: blockLayouts, height };
      });
      const zoneWidth = 38 + Math.max(1, districts.length) * districtWidth + Math.max(0, districts.length - 1) * districtGap;
      const zoneHeight = 76 + Math.max(210, ...districtLayouts.map((district) => district.height)) + 18;
      nextNodes.push({ id: `urban-zone-${zone.id}`, type: "urbanZone", position: { x: zoneX, y: 0 }, data: { ...zone, width: zoneWidth, height: zoneHeight, districtCount: districts.length }, draggable: false, selectable: false, zIndex: 0 });

      districtLayouts.forEach(({ district, blocks, height }, districtIndex) => {
        const districtX = zoneX + 19 + districtIndex * (districtWidth + districtGap);
        const districtY = 65;
        nextNodes.push({ id: `urban-district-${district.id}`, type: "urbanDistrict", position: { x: districtX, y: districtY }, data: { ...district, width: districtWidth, height, blockCount: blocks.length }, draggable: false, selectable: false, zIndex: 1 });
        let blockY = districtY + 54;
        blocks.forEach(({ block, applications: blockApplications, height: blockHeight }) => {
          const blockX = districtX + 15;
          nextNodes.push({ id: `urban-block-${block.id}`, type: "urbanBlock", position: { x: blockX, y: blockY }, data: { ...block, width: blockWidth, height: blockHeight, applicationCount: blockApplications.length }, draggable: false, selectable: false, zIndex: 2 });
          blockApplications.forEach((application, applicationIndex) => {
            const column = applicationIndex % 2;
            const row = Math.floor(applicationIndex / 2);
            nextNodes.push({ id: `urban-application-${application.id}`, type: "urbanApplication", position: { x: blockX + 14 + column * (appWidth + appGapX), y: blockY + 45 + row * (appHeight + appGapY) }, data: { application }, draggable: false, zIndex: 3 });
          });
          blockY += blockHeight + 14;
        });
      });
      zoneX += zoneWidth + zoneGap;
    });
    return nextNodes;
  }, [applications, data]);

  return <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onNodeClick={(_, node) => { if (node.type === "urbanApplication") onSelect((node.data as ApplicationData).application); }} fitView fitViewOptions={{ padding: .045, maxZoom: 1 }} minZoom={.22} maxZoom={1.4} proOptions={{ hideAttribution: true }}><Background gap={25} size={1} color="var(--rf-grid)" /><Controls position="bottom-left" showInteractive={false} /><FitController signature={nodes.map((node) => node.id).join("|")} fullscreen={fullscreen} />{!applications.length && <div className="rf-empty-overlay">Aucune application ne correspond aux filtres.</div>}</ReactFlow>;
}

export function UrbanPosView({ data }: { data: ViewDataset }) {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<"all" | Health>("all");
  const [selected, setSelected] = useState<Application | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLElement>(null);
  const applications = useMemo(() => data.applications.filter((application) => `${application.name} ${application.lifecycle}`.toLowerCase().includes(query.toLowerCase()) && (health === "all" || application.health === health)), [data.applications, health, query]);
  const selectedBlock = selected ? data.urbanBlocks.find((block) => block.id === selected.urbanBlockId) : undefined;
  const selectedDistrict = selectedBlock ? data.urbanDistricts.find((district) => district.id === selectedBlock.districtId) : undefined;
  const selectedZone = selectedDistrict ? data.urbanZones.find((zone) => zone.id === selectedDistrict.zoneId) : undefined;

  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };

  return <section ref={frameRef} className="view-workspace rf-view-workspace urban-pos-workspace"><div className="urban-pos-header"><div className="rf-pos-title"><p className="eyebrow">Plan d’occupation du sol</p><h1>Cartographie urbaine du SI</h1></div><div className="rf-pos-filters"><label className="search-control"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une application…" /></label><label className="filter-control"><select value={health} onChange={(event) => setHealth(event.target.value as typeof health)}><option value="all">Toutes les santés</option><option value="healthy">Saines</option><option value="watch">À surveiller</option><option value="critical">Critiques</option></select><ChevronDown size={15} /></label></div><div className="urban-pos-kpis"><span><MapPinned size={15} /><small>Zones</small><strong>{data.urbanZones.length}</strong></span><span><Building2 size={15} /><small>Quartiers</small><strong>{data.urbanDistricts.length}</strong></span><span><Layers3 size={15} /><small>Îlots</small><strong>{data.urbanBlocks.length}</strong></span><span><AppWindow size={15} /><small>Applications</small><strong>{data.applications.length}</strong></span></div><button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{fullscreen ? "Quitter" : "Plein écran"}</span></button></div><div className="urban-pos-legend"><span><i className="urban-level zone" /> Zone</span><span><i className="urban-level district" /> Quartier</span><span><i className="urban-level block" /> Îlot</span><span className="legend-separator" /><span><i className="health-dot healthy" /> Sain</span><span><i className="health-dot watch" /> À surveiller</span><span><i className="health-dot critical" /> Critique</span></div><div className="rf-canvas-area urban-pos-canvas"><ReactFlowProvider><UrbanCanvas data={data} applications={applications} onSelect={setSelected} fullscreen={fullscreen} /></ReactFlowProvider></div>
    {selected && <aside className="context-panel rf-context-panel urban-pos-detail"><button className="panel-close" onClick={() => setSelected(null)} aria-label="Fermer le détail">×</button><p className="eyebrow">Application</p><h2>{selected.name}</h2><span className={`status-chip health-${selected.health}`}>{healthLabel[selected.health]}</span><dl className="detail-list"><div><dt>Zone</dt><dd>{selectedZone?.name ?? "—"}</dd></div><div><dt>Quartier</dt><dd>{selectedDistrict?.name ?? "—"}</dd></div><div><dt>Îlot</dt><dd>{selectedBlock?.name ?? "—"}</dd></div><div><dt>Cycle de vie</dt><dd>{selected.lifecycle}</dd></div></dl>{selectedBlock && <div className="panel-section"><h3>Positionnement urbain</h3><div className="warning-box"><strong>{selectedBlock.status}</strong><br />Responsable : {selectedBlock.owner}</div></div>}</aside>}
  </section>;
}
