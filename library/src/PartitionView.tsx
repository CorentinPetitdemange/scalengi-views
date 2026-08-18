"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, ReactFlowProvider, useReactFlow, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { ChevronDown, Layers3, ListFilter, Maximize2, Minimize2, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { optionOf, sectionOf, type ConfigurationItem } from "./configuration";
import { useI18n } from "./i18n";
import type { PartitionItem, PartitionRelation, PartitionValue } from "./types";
import type { ViewRendererProps } from "./view-registry";

type Level = { id: string; label: string; plural: string; parentLevelId: string; role: "container" | "card" | "reference"; description: string; color: string };
type Attribute = { id: string; label: string; levelId: string; type: "text" | "number" | "choice"; display: "text" | "badge" | "metric"; vocabularyId: string; suffix: string };
type Vocabulary = { vocabularyId: string; value: string; label: string; color: string };
type FilterRule = { id: string; attributeId: string; operator: "include" | "exclude"; values: string[] };
type TreeData = { root: PartitionItem; items: PartitionItem[]; relations: PartitionRelation[]; levels: Level[]; attributes: Attribute[]; vocabularies: Vocabulary[]; showDescriptions: boolean; showReferences: boolean; selectedId: string | null; onSelect: (id: string) => void };

const asLevel = (item: ConfigurationItem): Level => ({ id: item.id, label: String(item.label ?? item.id), plural: String(item.plural ?? item.label ?? item.id), parentLevelId: String(item.parentLevelId ?? ""), role: ["container", "card", "reference"].includes(String(item.role)) ? item.role as Level["role"] : "card", description: String(item.description ?? ""), color: String(item.color ?? "#2563eb") });
const asAttribute = (item: ConfigurationItem): Attribute => ({ id: item.id, label: String(item.label ?? item.id), levelId: String(item.levelId ?? ""), type: ["number", "choice"].includes(String(item.type)) ? item.type as Attribute["type"] : "text", display: ["badge", "metric"].includes(String(item.display)) ? item.display as Attribute["display"] : "text", vocabularyId: String(item.vocabularyId ?? ""), suffix: String(item.suffix ?? "") });
const asVocabulary = (item: ConfigurationItem): Vocabulary => ({ vocabularyId: String(item.vocabularyId ?? ""), value: String(item.value ?? item.id), label: String(item.label ?? item.value ?? item.id), color: String(item.color ?? "#64748b") });

function valueMeta(value: unknown, attribute: Attribute, vocabularies: Vocabulary[]) {
  const entry = vocabularies.find((item) => item.vocabularyId === attribute.vocabularyId && item.value === String(value));
  return { label: entry?.label ?? String(value ?? ""), color: entry?.color ?? "#64748b" };
}

function PartitionElement({ item, items, relations, levels, attributes, vocabularies, showDescriptions, showReferences, selectedId, onSelect, depth = 0 }: TreeData & { item: PartitionItem; depth?: number }) {
  const level = levels.find((candidate) => candidate.id === item.levelId);
  const children = items.filter((candidate) => candidate.parentId === item.id && levels.find((candidateLevel) => candidateLevel.id === candidate.levelId)?.role !== "reference");
  const itemAttributes = attributes.filter((attribute) => attribute.levelId === item.levelId && item.values[attribute.id] !== undefined && item.values[attribute.id] !== "");
  const references = relations.filter((relation) => relation.sourceId === item.id).map((relation) => items.find((candidate) => candidate.id === relation.targetId)).filter((candidate): candidate is PartitionItem => Boolean(candidate));
  const isContainer = level?.role === "container" || children.length > 0;
  return <article className={`partition-element ${isContainer ? "is-container" : "is-card"} ${selectedId === item.id ? "selected" : ""}`} style={{ "--partition-color": level?.color ?? "#2563eb", "--partition-depth": depth } as React.CSSProperties}>
    <button className="partition-element-heading" onClick={() => onSelect(item.id)}>
      <span>{level?.label ?? item.levelId}</span><strong>{item.name}</strong>{showDescriptions && item.description && <small>{item.description}</small>}
    </button>
    {itemAttributes.length > 0 && <div className="partition-attribute-list">{itemAttributes.map((attribute) => { const meta = valueMeta(item.values[attribute.id], attribute, vocabularies); return <span className={`partition-attribute is-${attribute.display}`} key={attribute.id} style={attribute.display === "badge" ? { "--attribute-color": meta.color } as React.CSSProperties : undefined}><small>{attribute.label}</small><strong>{meta.label}{attribute.suffix}</strong></span>; })}</div>}
    {showReferences && references.length > 0 && <div className="partition-references">{references.map((reference) => { const referenceLevel = levels.find((candidate) => candidate.id === reference.levelId); const coloredAttribute = attributes.find((attribute) => attribute.levelId === reference.levelId && attribute.display === "badge" && reference.values[attribute.id] !== undefined); const meta = coloredAttribute ? valueMeta(reference.values[coloredAttribute.id], coloredAttribute, vocabularies) : null; return <button key={reference.id} onClick={() => onSelect(reference.id)}><i style={{ background: meta?.color ?? referenceLevel?.color }} /><span>{reference.name}</span></button>; })}</div>}
    {children.length > 0 && <div className="partition-children">{children.map((child) => <PartitionElement key={child.id} {...{ root: item, item: child, items, relations, levels, attributes, vocabularies, showDescriptions, showReferences, selectedId, onSelect }} depth={depth + 1} />)}</div>}
  </article>;
}

const PartitionTreeNode = memo(function PartitionTreeNode({ data }: NodeProps<TreeData>) {
  return <div className="partition-root-node"><PartitionElement {...data} item={data.root} /></div>;
});

const nodeTypes = { partitionTree: PartitionTreeNode };

function FitController({ signature, fullscreen }: { signature: string; fullscreen: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => { const timeout = window.setTimeout(() => fitView({ padding: .04, duration: 550, maxZoom: 1 }), 100); return () => window.clearTimeout(timeout); }, [fitView, fullscreen, signature]);
  return null;
}

function PartitionCanvas({ roots, items, relations, levels, attributes, vocabularies, showDescriptions, showReferences, selectedId, onSelect, fullscreen }: Omit<TreeData, "root"> & { roots: PartitionItem[]; fullscreen: boolean }) {
  const { t } = useI18n();
  const nodes = useMemo<Node[]>(() => {
    const columns = roots.length <= 1 ? 1 : 2;
    const rowHeights: number[] = [];
    const itemById = new Map(items.map((item) => [item.id, item]));
    const rootIds = new Set(roots.map((root) => root.id));
    const descendantCounts = new Map(roots.map((root) => [root.id, 0]));
    for (const item of items) {
      let current = item; const seen = new Set([item.id]);
      while (current.parentId) { const parent = itemById.get(current.parentId); if (!parent || seen.has(parent.id)) break; current = parent; seen.add(parent.id); }
      if (current.id !== item.id && rootIds.has(current.id)) descendantCounts.set(current.id, (descendantCounts.get(current.id) ?? 0) + 1);
    }
    const estimatedHeight = (root: PartitionItem) => 150 + (descendantCounts.get(root.id) ?? 0) * 125;
    roots.forEach((root, index) => { const row = Math.floor(index / columns); rowHeights[row] = Math.max(rowHeights[row] ?? 0, estimatedHeight(root)); });
    const yForRow = (row: number) => rowHeights.slice(0, row).reduce((sum, height) => sum + height + 45, 0);
    return roots.map((root, index) => ({ id: root.id, type: "partitionTree", position: { x: index % columns * 760, y: yForRow(Math.floor(index / columns)) }, data: { root, items, relations, levels, attributes, vocabularies, showDescriptions, showReferences, selectedId, onSelect }, draggable: false, selectable: false }));
  }, [attributes, items, levels, onSelect, relations, roots, selectedId, showDescriptions, showReferences, vocabularies]);
  return <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} fitView fitViewOptions={{ padding: .04, maxZoom: 1 }} minZoom={.12} maxZoom={1.35} proOptions={{ hideAttribution: true }}><Background gap={25} size={1} color="var(--rf-grid)" /><Controls position="bottom-left" showInteractive={false} /><FitController signature={`${nodes.map((node) => node.id).join("|")}:${items.map((item) => item.id).join("|")}`} fullscreen={fullscreen} />{!nodes.length && <div className="rf-empty-overlay">{t("Aucun élément à afficher dans ce découpage.")}</div>}</ReactFlow>;
}

export function PartitionView({ data, configuration }: ViewRendererProps) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [levelFilters, setLevelFilters] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "any">("all");
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const levels = useMemo(() => (sectionOf(configuration, "levels")?.items ?? []).map(asLevel), [configuration]);
  const attributes = useMemo(() => (sectionOf(configuration, "attributes")?.items ?? []).map(asAttribute), [configuration]);
  const vocabularies = useMemo(() => (sectionOf(configuration, "vocabularies")?.items ?? []).map(asVocabulary), [configuration]);
  const relations = useMemo(() => data.partitionRelations ?? [], [data.partitionRelations]);
  const allItems = useMemo(() => data.partitionItems.filter((item) => levels.some((level) => level.id === item.levelId)), [data.partitionItems, levels]);
  const showDescriptions = Boolean(optionOf(configuration, "showDescriptions", true));
  const showReferences = Boolean(optionOf(configuration, "showReferences", true));
  const valuesForAttribute = useCallback((attribute: Attribute) => {
    const values = [...new Set(allItems.map((item) => item.values[attribute.id]).filter((value): value is PartitionValue => value !== undefined && value !== "").map(String))];
    return values.map((value) => ({ value, label: valueMeta(value, attribute, vocabularies).label })).sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [allItems, vocabularies]);
  const activeRules = useMemo(() => filterRules.filter((rule) => rule.attributeId && rule.values.length > 0), [filterRules]);
  const activeFilterCount = levelFilters.length + activeRules.length;
  const displayedLevels = levelFilters.length ? levels.filter((level) => levelFilters.includes(level.id)) : levels;
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    if (!needle && !levelFilters.length && !activeRules.length) return allItems;
    const valuesForItem = (item: PartitionItem, attributeId: string) => {
      const values: Array<PartitionValue | undefined> = [item.values[attributeId]];
      for (const relation of relations.filter((candidate) => candidate.sourceId === item.id)) values.push(allItems.find((candidate) => candidate.id === relation.targetId)?.values[attributeId]);
      return values.filter((value): value is PartitionValue => value !== undefined && value !== "").map(String);
    };
    const direct = new Set(allItems.filter((item) => {
      const matchesQuery = !needle || `${item.name} ${item.description} ${Object.values(item.values).join(" ")}`.toLocaleLowerCase("fr").includes(needle);
      const matchesRules = !activeRules.length || (filterMode === "all" ? activeRules.every((rule) => { const hasValue = valuesForItem(item, rule.attributeId).some((value) => rule.values.includes(value)); return rule.operator === "include" ? hasValue : !hasValue; }) : activeRules.some((rule) => { const hasValue = valuesForItem(item, rule.attributeId).some((value) => rule.values.includes(value)); return rule.operator === "include" ? hasValue : !hasValue; }));
      return matchesQuery && matchesRules;
    }).map((item) => item.id));
    const keep = new Set(direct);
    let changed = true;
    while (changed) { changed = false; for (const item of allItems) if (keep.has(item.id) && item.parentId && !keep.has(item.parentId)) { keep.add(item.parentId); changed = true; } }
    const contextualItems = allItems.filter((item) => keep.has(item.id) || relations.some((relation) => keep.has(relation.sourceId) && relation.targetId === item.id));
    if (!levelFilters.length) return contextualItems;
    const displayedIds = new Set(contextualItems.filter((item) => levelFilters.includes(item.levelId)).map((item) => item.id));
    return contextualItems.filter((item) => displayedIds.has(item.id) || levels.find((level) => level.id === item.levelId)?.role === "reference" && relations.some((relation) => displayedIds.has(relation.sourceId) && relation.targetId === item.id));
  }, [activeRules, allItems, filterMode, levelFilters, levels, query, relations]);
  const roots = useMemo(() => visibleItems.filter((item) => levels.find((level) => level.id === item.levelId)?.role !== "reference" && (!item.parentId || !visibleItems.some((candidate) => candidate.id === item.parentId))), [levels, visibleItems]);
  const selected = allItems.find((item) => item.id === selectedId) ?? null;
  const selectedLevel = selected ? levels.find((level) => level.id === selected.levelId) : null;
  const selectedAttributes = selected ? attributes.filter((attribute) => attribute.levelId === selected.levelId && selected.values[attribute.id] !== undefined && selected.values[attribute.id] !== "") : [];
  const onSelect = useCallback((id: string) => setSelectedId((current) => current === id ? null : id), []);
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === frameRef.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current?.requestFullscreen(); };

  if (!levels.length) return <div className="empty-state">{t("Ajoutez au moins un niveau dans la structure de cette vue.")}</div>;
  const resetFilters = () => { setLevelFilters([]); setFilterRules([]); setFilterMode("all"); };
  const addRule = () => { const attribute = attributes.find((candidate) => !filterRules.some((rule) => rule.attributeId === candidate.id)) ?? attributes[0]; if (attribute) setFilterRules((current) => [...current, { id: globalThis.crypto?.randomUUID?.() ?? `filter-${Date.now()}`, attributeId: attribute.id, operator: "include", values: [] }]); };
  const updateRule = (id: string, patch: Partial<FilterRule>) => setFilterRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  return <section ref={frameRef} className="view-workspace rf-view-workspace partition-workspace">
    <header className="partition-header"><div><p className="eyebrow">{t("Vue en découpage")}</p><h1>{configuration?.label ?? t("Découpage personnalisé")}</h1></div><div className="partition-filters"><label className="search-control"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Rechercher un élément…")} /></label><button className={`partition-filter-button ${filtersOpen || activeFilterCount ? "active" : ""}`} onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen}><ListFilter size={15} /><span>{t("Filtres")}</span>{activeFilterCount > 0 && <em>{activeFilterCount}</em>}</button></div><div className="partition-kpis">{displayedLevels.slice(0, 4).map((level) => <span key={level.id}><Layers3 size={14} /><small>{level.plural}</small><strong>{allItems.filter((item) => item.levelId === level.id).length}</strong></span>)}</div><button className="rf-fullscreen-button" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{t(fullscreen ? "Quitter" : "Plein écran")}</span></button></header>
    {filtersOpen && <aside className="partition-filter-panel partition-condition-panel" data-export-exclude aria-label={t("Filtres de la vue")}><header><div><ListFilter size={15} /><strong>{t("Construire les filtres")}</strong></div><button onClick={() => setFiltersOpen(false)} aria-label={t("Fermer les filtres")}><X size={15} /></button></header><section className="partition-filter-section"><span>{t("Niveaux réellement visibles")}</span><div className="partition-filter-chips">{levels.filter((level) => level.role !== "reference").map((level) => <label key={level.id}><input type="checkbox" checked={levelFilters.includes(level.id)} onChange={() => setLevelFilters((current) => current.includes(level.id) ? current.filter((id) => id !== level.id) : [...current, level.id])} /><i style={{ background: level.color }} />{level.plural}</label>)}</div><small className="partition-filter-help">{t("Sans sélection, tous les niveaux sont visibles. Un niveau masqué disparaît réellement, même s’il est parent d’un autre.")}</small></section><div className="partition-filter-mode"><span>{t("Les éléments doivent respecter")}</span><div className="segmented-control"><button className={filterMode === "all" ? "active" : ""} onClick={() => setFilterMode("all")}>{t("Toutes les conditions")}</button><button className={filterMode === "any" ? "active" : ""} onClick={() => setFilterMode("any")}>{t("Au moins une")}</button></div></div><section className="partition-filter-section partition-rule-list"><div className="partition-rule-heading"><span>{t("Conditions sur les informations")}</span><button onClick={addRule} disabled={!attributes.length}><Plus size={13} /> {t("Ajouter")}</button></div>{filterRules.map((rule, index) => { const attribute = attributes.find((candidate) => candidate.id === rule.attributeId) ?? attributes[0]; const choices = attribute ? valuesForAttribute(attribute) : []; return <article className="partition-filter-rule" key={rule.id}><div className="partition-rule-number">{index + 1}</div><label><span>{t("Information")}</span><div><select value={rule.attributeId} onChange={(event) => updateRule(rule.id, { attributeId: event.target.value, values: [] })}>{attributes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={14} /></div></label><label><span>{t("Condition")}</span><div><select value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as FilterRule["operator"] })}><option value="include">{t("est parmi")}</option><option value="exclude">{t("n’est pas parmi")}</option></select><ChevronDown size={14} /></div></label><div className="partition-rule-values"><span>{t("Valeurs — plusieurs choix possibles")}</span>{choices.length ? <div>{choices.map((choice) => <label key={choice.value}><input type="checkbox" checked={rule.values.includes(choice.value)} onChange={() => updateRule(rule.id, { values: rule.values.includes(choice.value) ? rule.values.filter((value) => value !== choice.value) : [...rule.values, choice.value] })} /><span>{choice.label}</span></label>)}</div> : <small>{t("Aucune valeur disponible dans les données.")}</small>}</div><button className="partition-remove-rule" onClick={() => setFilterRules((current) => current.filter((item) => item.id !== rule.id))} aria-label={`${t("Supprimer")} ${t("Condition").toLocaleLowerCase()} ${index + 1}`}><Trash2 size={14} /></button></article>; })}{!filterRules.length && <div className="partition-filter-empty">{t("Ajoutez une condition pour croiser plusieurs informations.")}</div>}</section><button className="partition-reset-filters" disabled={!activeFilterCount && !filterRules.length} onClick={resetFilters}><RotateCcw size={14} /> {t("Réinitialiser tous les filtres")}</button></aside>}
    <div className="partition-legend">{displayedLevels.map((level) => <span key={level.id}><i style={{ background: level.color }} />{level.label}</span>)}</div>
    <div className="rf-canvas-area partition-canvas" data-view-export-content><ReactFlowProvider><PartitionCanvas roots={roots} items={visibleItems} relations={relations} levels={levels} attributes={attributes} vocabularies={vocabularies} showDescriptions={showDescriptions} showReferences={showReferences} selectedId={selectedId} onSelect={onSelect} fullscreen={fullscreen} /></ReactFlowProvider></div>
    {selected && <aside className="context-panel rf-context-panel partition-detail"><button className="panel-close" onClick={() => setSelectedId(null)} aria-label={t("Fermer le détail")}><X size={16} /></button><p className="eyebrow">{selectedLevel?.label ?? selected.levelId}</p><h2>{selected.name}</h2>{selected.description && <p className="partition-detail-description">{selected.description}</p>}<dl className="detail-list">{selectedAttributes.map((attribute) => { const meta = valueMeta(selected.values[attribute.id], attribute, vocabularies); return <div key={attribute.id}><dt>{attribute.label}</dt><dd>{meta.label}{attribute.suffix}</dd></div>; })}</dl><div className="panel-section"><h3>{t("Position dans le découpage")}</h3><div className="partition-breadcrumb">{ancestryOf(selected, allItems).map((item) => <span key={item.id}>{item.name}</span>)}</div></div>{relations.some((relation) => relation.sourceId === selected.id || relation.targetId === selected.id) && <div className="panel-section"><h3>{t("Éléments liés")}</h3>{relations.filter((relation) => relation.sourceId === selected.id || relation.targetId === selected.id).map((relation) => { const otherId = relation.sourceId === selected.id ? relation.targetId : relation.sourceId; const other = allItems.find((item) => item.id === otherId); return other ? <button className="partition-related-row" key={relation.id} onClick={() => setSelectedId(other.id)}><span>{other.name}</span><small>{relation.type}</small></button> : null; })}</div>}</aside>}
  </section>;
}

function ancestryOf(item: PartitionItem, items: PartitionItem[]) {
  const path = [item]; let current = item;
  while (current.parentId) { const parent = items.find((candidate) => candidate.id === current.parentId); if (!parent || path.some((candidate) => candidate.id === parent.id)) break; path.unshift(parent); current = parent; }
  return path;
}
