"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Focus, Layers3, Maximize2, Minimize2, Radar, Settings2, Target, X } from "lucide-react";
import { optionOf, sectionOf, type ViewConfiguration } from "./configuration";
import { useI18n } from "./i18n";
import type { UrbanisationIndicator, ViewDataset } from "./types";

type SeriesKey = "target" | "current" | "mapping";
type Scope = "priority" | "all" | "custom" | `group:${string}`;

const seriesMeta: Record<SeriesKey, { label: string; color: string }> = {
  target: { label: "Objectif", color: "#2563eb" },
  current: { label: "Niveau actuel", color: "#ef4444" },
  mapping: { label: "Niveau de cartographie", color: "#84cc16" },
};

const gapOf = (indicator: UrbanisationIndicator) => Math.max(0, indicator.target - indicator.current);
const average = (items: UrbanisationIndicator[], field: "current" | "target" | "mapping") => items.length ? items.reduce((sum, item) => sum + item[field], 0) / items.length : 0;
const compact = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);

function polarPoint(index: number, count: number, radius: number, centerX: number, centerY: number) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, angle };
}

function wrapLabel(label: string) {
  const words = label.split(/\s+/);
  if (label.length < 25 || words.length < 3) return [label];
  const split = Math.ceil(words.length / 2);
  return [words.slice(0, split).join(" "), words.slice(split).join(" ")];
}

function RadarChart({ indicators, visibleSeries, selectedId, onSelect }: { indicators: UrbanisationIndicator[]; visibleSeries: Record<SeriesKey, boolean>; selectedId: string | null; onSelect: (indicator: UrbanisationIndicator) => void }) {
  const { locale, t } = useI18n();
  const centerX = 390;
  const centerY = 300;
  const radius = indicators.length > 16 ? 192 : 205;
  const maxValue = Math.max(4, Math.ceil(Math.max(...indicators.flatMap((item) => [item.target, item.current, item.mapping]), 4)));
  const polygon = (ratio: number) => indicators.map((_, index) => { const point = polarPoint(index, indicators.length, radius * ratio, centerX, centerY); return `${point.x},${point.y}`; }).join(" ");
  const valuePolygon = (key: SeriesKey) => indicators.map((indicator, index) => { const point = polarPoint(index, indicators.length, radius * Math.min(1, indicator[key] / maxValue), centerX, centerY); return `${point.x},${point.y}`; }).join(" ");

  if (indicators.length < 3) return <div className="radar-selection-empty"><Radar size={27} /><strong>{t("Sélectionnez au moins trois dimensions")}</strong><span>{t("Le radar a besoin de trois axes pour former une surface comparable.")}</span></div>;

  return <svg className="urbanisation-radar-svg" viewBox="0 0 780 610" role="img" aria-label={locale === "fr" ? `Radar de maturité sur ${indicators.length} dimensions` : `Maturity radar across ${indicators.length} dimensions`}>
    {[1, 2, 3, 4].map((level) => <polygon key={level} points={polygon(level / 4)} className="radar-grid-ring" />)}
    {indicators.map((indicator, index) => { const outer = polarPoint(index, indicators.length, radius, centerX, centerY); const labelPoint = polarPoint(index, indicators.length, radius + (indicators.length > 16 ? 29 : 38), centerX, centerY); const lines = wrapLabel(indicator.label); const anchor = Math.cos(labelPoint.angle) > .18 ? "start" : Math.cos(labelPoint.angle) < -.18 ? "end" : "middle"; return <g key={indicator.id} className={selectedId === indicator.id ? "radar-axis selected" : "radar-axis"} onClick={() => onSelect(indicator)}>
      <line x1={centerX} y1={centerY} x2={outer.x} y2={outer.y} />
      <circle cx={outer.x} cy={outer.y} r="3" />
      <text x={labelPoint.x} y={labelPoint.y - (lines.length - 1) * 5} textAnchor={anchor}>{lines.map((line, lineIndex) => <tspan key={line} x={labelPoint.x} dy={lineIndex === 0 ? 0 : 11}>{line}</tspan>)}</text>
    </g>; })}
    {(Object.keys(seriesMeta) as SeriesKey[]).filter((key) => visibleSeries[key]).map((key) => <polygon key={key} points={valuePolygon(key)} className={`radar-series radar-series-${key}`} style={{ "--series-color": seriesMeta[key].color } as React.CSSProperties} />)}
    {(Object.keys(seriesMeta) as SeriesKey[]).filter((key) => visibleSeries[key]).flatMap((key) => indicators.map((indicator, index) => { const point = polarPoint(index, indicators.length, radius * Math.min(1, indicator[key] / maxValue), centerX, centerY); return <circle key={`${key}-${indicator.id}`} cx={point.x} cy={point.y} r={selectedId === indicator.id ? 4 : 2.5} className={`radar-point radar-point-${key}`} style={{ "--series-color": seriesMeta[key].color } as React.CSSProperties} />; }))}
    <g className="radar-scale-labels">{[1, 2, 3, 4].map((level) => <text key={level} x={centerX + 5} y={centerY - radius * level / 4 + 12}>{compact(maxValue * level / 4)}</text>)}</g>
  </svg>;
}

export function UrbanisationRadarView({ data, configuration }: { data: ViewDataset; configuration?: ViewConfiguration }) {
  const { locale, t } = useI18n();
  const frameRef = useRef<HTMLElement>(null);
  const indicators = useMemo(() => {
    const imported = data.urbanisationIndicators ?? [];
    const axes = sectionOf(configuration, "axes")?.items;
    if (!axes) return imported;
    return axes.map((axis) => {
      const existing = imported.find((item) => item.id === axis.id);
      return { id: axis.id, label: String(axis.label ?? axis.id), group: String(axis.group ?? "Non classé"), current: existing?.current ?? 0, target: Number(axis.target ?? existing?.target ?? 0), mapping: existing?.mapping ?? 0, weight: Number(axis.weight ?? existing?.weight ?? 1), owner: existing?.owner ?? "", evidence: existing?.evidence ?? "", action: existing?.action ?? "" } satisfies UrbanisationIndicator;
    });
  }, [configuration, data.urbanisationIndicators]);
  const priorityCount = optionOf(configuration, "priorityCount", 10);
  const ranked = useMemo(() => [...indicators].sort((a, b) => (gapOf(b) * b.weight) - (gapOf(a) * a.weight) || b.target - a.target), [indicators]);
  const priorityIds = useMemo(() => new Set(ranked.slice(0, Math.min(priorityCount, ranked.length)).map((item) => item.id)), [priorityCount, ranked]);
  const groups = useMemo(() => [...new Set(indicators.map((item) => item.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [indicators]);
  const [scope, setScope] = useState<Scope>("priority");
  const [customIds, setCustomIds] = useState<Set<string>>(() => new Set(indicators.map((item) => item.id)));
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({ target: true, current: true, mapping: true });
  const [selectedId, setSelectedId] = useState<string | null>(ranked[0]?.id ?? null);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);

  const visibleIndicators = useMemo(() => {
    if (scope === "priority") return indicators.filter((item) => priorityIds.has(item.id));
    if (scope === "all") return indicators;
    if (scope === "custom") return indicators.filter((item) => customIds.has(item.id));
    return indicators.filter((item) => item.group === scope.slice(6));
  }, [customIds, indicators, priorityIds, scope]);
  const selected = indicators.find((item) => item.id === selectedId) ?? ranked[0] ?? null;
  const weightedGap = indicators.length ? indicators.reduce((sum, item) => sum + gapOf(item) * item.weight, 0) / indicators.reduce((sum, item) => sum + item.weight, 0) : 0;
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };
  const toggleCustom = (id: string) => { setCustomIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); setScope("custom"); };

  return <section ref={frameRef} className="view-workspace urbanisation-workspace">
    <header className="urbanisation-header"><div><p className="eyebrow">{t("Diagnostic d’urbanisation")}</p><h1>{t("État et trajectoire du SI")}</h1></div><div className="urbanisation-header-actions">
      <label className="filter-control urbanisation-scope"><select value={scope} onChange={(event) => setScope(event.target.value as Scope)} aria-label={t("Dimensions affichées")}><option value="priority">{priorityCount} {t("écarts prioritaires")}</option><option value="all">{t("Toutes les dimensions")} ({indicators.length})</option>{groups.map((group) => <option key={group} value={`group:${group}`}>{group}</option>)}<option value="custom">{t("Sélection personnalisée")} ({customIds.size})</option></select><ChevronDown size={15} /></label>
      <button className={configurationOpen ? "secondary-action-button active" : "secondary-action-button"} onClick={() => setConfigurationOpen((value) => !value)}><Settings2 size={15} /> {t("Paramétrer")}</button>
      <button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{t(fullscreen ? "Quitter" : "Plein écran")}</span></button>
    </div></header>
    <div className="urbanisation-legend">{(Object.keys(seriesMeta) as SeriesKey[]).map((key) => <button key={key} className={visibleSeries[key] ? "active" : ""} onClick={() => setVisibleSeries((current) => ({ ...current, [key]: !current[key] }))}><i style={{ background: seriesMeta[key].color }} />{t(seriesMeta[key].label)}</button>)}<span>{locale === "fr" ? `${visibleIndicators.length} dimension${visibleIndicators.length > 1 ? "s" : ""} affichée${visibleIndicators.length > 1 ? "s" : ""}` : `${visibleIndicators.length} displayed dimension${visibleIndicators.length === 1 ? "" : "s"}`}</span></div>
    {!indicators.length ? <div className="urbanisation-empty" data-view-export-content><Radar size={32} /><h2>{t("Aucune évaluation chargée")}</h2><p>{t("Importez le modèle Excel de cette vue pour afficher votre diagnostic.")}</p></div> : <div className="urbanisation-body" data-view-export-content>
      <div className="radar-card"><div className="radar-card-heading"><div><span>{t("Lecture synthétique")}</span><strong>{scope === "priority" ? t("Priorités d’urbanisation") : scope === "all" ? t("Ensemble du diagnostic") : scope === "custom" ? t("Sélection personnalisée") : scope.slice(6)}</strong></div><small>{t("Cliquez sur un axe pour ouvrir son détail")}</small></div><RadarChart indicators={visibleIndicators} visibleSeries={visibleSeries} selectedId={selectedId} onSelect={(item) => setSelectedId(item.id)} /></div>
      <aside className="urbanisation-insights"><div className="urbanisation-kpis"><article><Target size={15} /><span>{t("Actuel")}</span><strong>{compact(average(indicators, "current"))}</strong></article><article><Focus size={15} /><span>{t("Cible")}</span><strong>{compact(average(indicators, "target"))}</strong></article><article><Layers3 size={15} /><span>{t("Cartographié")}</span><strong>{compact(average(indicators, "mapping"))}</strong></article><article className="gap-kpi"><Radar size={15} /><span>{t("Écart pondéré")}</span><strong>{compact(weightedGap)}</strong></article></div>
        <div className="gap-list-heading"><div><strong>{t("Écarts prioritaires")}</strong><span>{t("Classés par écart × poids")}</span></div><em>{ranked.filter((item) => gapOf(item) > 0).length} {t("à traiter")}</em></div>
        <div className="gap-list">{ranked.map((indicator, index) => <button key={indicator.id} className={selected?.id === indicator.id ? "selected" : ""} onClick={() => setSelectedId(indicator.id)}><span className="gap-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{indicator.label}</strong><span>{indicator.group}</span><i><b style={{ width: `${Math.min(100, indicator.current / Math.max(indicator.target, 1) * 100)}%` }} /></i></div><em>−{compact(gapOf(indicator))}</em></button>)}</div>
        {selected && <div className="indicator-detail"><div><span>{selected.group}</span><strong>{selected.label}</strong></div><dl><div><dt>{t("Actuel")}</dt><dd>{compact(selected.current)}</dd></div><div><dt>{t("Cible")}</dt><dd>{compact(selected.target)}</dd></div><div><dt>{t("Cartographie")}</dt><dd>{compact(selected.mapping)}</dd></div></dl>{selected.owner && <p><b>{t("Responsable")}</b>{selected.owner}</p>}{selected.evidence && <p><b>{t("Preuve")}</b>{selected.evidence}</p>}{selected.action && <p className="indicator-action"><b>{t("Action recommandée")}</b>{selected.action}</p>}</div>}
      </aside>
    </div>}
    {configurationOpen && <aside className="urbanisation-config" aria-label={t("Paramètres de la vue")}><button className="panel-close" onClick={() => setConfigurationOpen(false)} aria-label={t("Fermer les paramètres")}><X /></button><p className="eyebrow">{t("Paramètres de la vue")}</p><h2>{t("Composer le diagnostic")}</h2><section><h3>{t("Séries visibles")}</h3>{(Object.keys(seriesMeta) as SeriesKey[]).map((key) => <label key={key}><input type="checkbox" checked={visibleSeries[key]} onChange={() => setVisibleSeries((current) => ({ ...current, [key]: !current[key] }))} /><i style={{ background: seriesMeta[key].color }} /><span>{t(seriesMeta[key].label)}</span></label>)}</section><section><div className="config-section-heading"><h3>{t("Dimensions")}</h3><button onClick={() => { setCustomIds(new Set(indicators.map((item) => item.id))); setScope("custom"); }}>{t("Tout sélectionner")}</button></div><div className="dimension-checklist">{indicators.map((indicator) => <label key={indicator.id}><input type="checkbox" checked={customIds.has(indicator.id)} onChange={() => toggleCustom(indicator.id)} /><span><strong>{indicator.label}</strong><small>{indicator.group}</small></span></label>)}</div></section></aside>}
  </section>;
}
