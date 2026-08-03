"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, AppWindow, ChevronDown, Layers3, Search, ShieldCheck } from "lucide-react";
import type { Capability, Health, ViewDataset } from "./types";

const healthLabel: Record<Health, string> = { healthy: "Sain", watch: "À surveiller", critical: "Critique" };

export function PosView({ data }: { data: ViewDataset }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Health | "uncovered">("all");
  const [selected, setSelected] = useState<Capability | null>(null);
  const filtered = useMemo(() => data.capabilities.filter((capability) => {
    const applications = capability.applicationIds.map((id) => data.applications.find((application) => application.id === id)).filter(Boolean);
    const matchesQuery = `${capability.name} ${capability.domain} ${applications.map((app) => app?.name).join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "uncovered" && applications.length === 0) || applications.some((app) => app?.health === filter);
    return matchesQuery && matchesFilter;
  }), [data, filter, query]);
  const domains = [...new Set(data.capabilities.map((capability) => capability.domain))];
  const covered = Math.round((data.capabilities.filter((capability) => capability.applicationIds.length > 0).length / Math.max(data.capabilities.length, 1)) * 100);
  const criticalApplications = data.applications.filter((application) => application.health === "critical").length;
  const fragileCapabilities = data.capabilities.filter((capability) => capability.maturity <= 2 || capability.applicationIds.length === 0).length;

  return (
    <section className="view-workspace pos-workspace">
      <div className="view-toolbar pos-heading">
        <div><p className="eyebrow">Plan d’occupation du sol</p><h1>Couverture fonctionnelle du SI</h1></div>
        <div className="toolbar-actions">
          <label className="search-control"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une capacité…" /></label>
          <label className="filter-control"><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Tous les états</option><option value="healthy">Applications saines</option><option value="watch">À surveiller</option><option value="critical">Critiques</option><option value="uncovered">Non couvertes</option></select><ChevronDown size={15} /></label>
        </div>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card"><span className="kpi-icon kpi-blue"><Layers3 size={18} /></span><div><small>Couverture du POS</small><strong>{covered}%</strong></div><em>{data.capabilities.length} capacités</em></article>
        <article className="kpi-card"><span className="kpi-icon kpi-red"><AlertTriangle size={18} /></span><div><small>Points de fragilité</small><strong>{fragileCapabilities}</strong></div><em>à traiter</em></article>
        <article className="kpi-card"><span className="kpi-icon kpi-orange"><AppWindow size={18} /></span><div><small>Applications critiques</small><strong>{criticalApplications}</strong></div><em>sur {data.applications.length}</em></article>
        <article className="kpi-card"><span className="kpi-icon kpi-green"><ShieldCheck size={18} /></span><div><small>Capacités maîtrisées</small><strong>{data.capabilities.filter((item) => item.maturity >= 4).length}</strong></div><em>maturité ≥ 4</em></article>
      </div>

      <div className="pos-legend"><span><i className="health-dot healthy" /> Sain</span><span><i className="health-dot watch" /> À surveiller</span><span><i className="health-dot critical" /> Critique</span><span><i className="health-dot uncovered" /> Non couvert</span></div>
      <div className="pos-grid">
        {domains.map((domain) => {
          const capabilities = filtered.filter((capability) => capability.domain === domain);
          if (!capabilities.length) return null;
          return <section className="pos-domain" key={domain}><header><span>{domain}</span><small>{capabilities.length} capacités</small></header><div className="capability-list">
            {capabilities.map((capability) => {
              const applications = capability.applicationIds.map((id) => data.applications.find((app) => app.id === id)).filter(Boolean);
              const worstHealth: Health | "uncovered" = !applications.length ? "uncovered" : applications.some((app) => app?.health === "critical") ? "critical" : applications.some((app) => app?.health === "watch") ? "watch" : "healthy";
              return <button className={`capability-card capability-${worstHealth}`} key={capability.id} onClick={() => setSelected(capability)}><div className="capability-title"><strong>{capability.name}</strong><span>M{capability.maturity}</span></div><div className="application-tags">{applications.length ? applications.map((app) => <span key={app?.id}><i className={`health-dot ${app?.health}`} /> {app?.name}</span>) : <span className="no-coverage">Aucune application</span>}</div></button>;
            })}
          </div></section>;
        })}
      </div>

      {selected && <aside className="context-panel pos-detail-panel"><button className="panel-close" onClick={() => setSelected(null)} aria-label="Fermer le détail">×</button><p className="eyebrow">Capacité métier</p><h2>{selected.name}</h2><div className="detail-score"><span>Maturité</span><strong>{selected.maturity}/5</strong></div><dl className="detail-list"><div><dt>Domaine</dt><dd>{selected.domain}</dd></div><div><dt>Responsable</dt><dd>{selected.owner}</dd></div><div><dt>Criticité</dt><dd>{selected.criticality}</dd></div></dl><div className="panel-section"><h3>Applications de couverture</h3>{selected.applicationIds.length ? selected.applicationIds.map((id) => { const app = data.applications.find((item) => item.id === id); return app ? <div className="application-row" key={id}><i className={`health-dot ${app.health}`} /><div><strong>{app.name}</strong><small>{healthLabel[app.health]} · {app.lifecycle}</small></div></div> : null; }) : <div className="warning-box">Cette capacité n’est couverte par aucune application.</div>}</div></aside>}
    </section>
  );
}

