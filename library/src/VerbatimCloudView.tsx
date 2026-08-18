"use client";

import { useMemo, useState } from "react";
import { Cloud, Maximize2, MessageSquareText, Search, Users, X } from "lucide-react";
import { optionOf, sectionOf } from "./configuration";
import { useI18n } from "./i18n";
import type { Verbatim } from "./types";
import type { ViewRendererProps } from "./view-registry";

type CloudShape = "cloud" | "round" | "rectangle";
type CloudWord = { key: string; label: string; count: number; score: number; color: string };
type PlacedCloudWord = CloudWord & { x: number; y: number; fontSize: number; bounds: WordBounds };
type WordBounds = { left: number; right: number; top: number; bottom: number };
const cloudShapes: Array<{ value: CloudShape; label: string }> = [
  { value: "cloud", label: "Nuage" },
  { value: "round", label: "Rond" },
  { value: "rectangle", label: "Rectangle" },
];
const asCloudShape = (value: unknown): CloudShape => cloudShapes.some((shape) => shape.value === value) ? value as CloudShape : "cloud";
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 500;

function isInsideShape(shape: CloudShape, x: number, y: number) {
  if (shape === "rectangle") return x >= 24 && x <= VIEW_WIDTH - 24 && y >= 24 && y <= VIEW_HEIGHT - 24;
  if (shape === "round") return (x - 400) ** 2 + (y - 250) ** 2 <= 220 ** 2;
  const inCircle = (cx: number, cy: number, radius: number) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  return (x >= 135 && x <= 690 && y >= 255 && y <= 400)
    || inCircle(225, 295, 118)
    || inCircle(345, 220, 150)
    || inCircle(495, 215, 142)
    || inCircle(615, 285, 112);
}

function wordBounds(label: string, fontSize: number, x: number, y: number): WordBounds {
  const halfWidth = Math.max(fontSize * .75, label.length * fontSize * .26);
  const halfHeight = fontSize * .54;
  return { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
}

function boundsFitShape(shape: CloudShape, bounds: WordBounds) {
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  return [
    [bounds.left, bounds.top], [centerX, bounds.top], [bounds.right, bounds.top],
    [bounds.left, centerY], [centerX, centerY], [bounds.right, centerY],
    [bounds.left, bounds.bottom], [centerX, bounds.bottom], [bounds.right, bounds.bottom],
  ].every(([x, y]) => isInsideShape(shape, x, y));
}

function intersects(bounds: WordBounds, placed: PlacedCloudWord[]) {
  const gap = 3;
  return placed.some((word) => !(bounds.right + gap < word.bounds.left || bounds.left - gap > word.bounds.right || bounds.bottom + gap < word.bounds.top || bounds.top - gap > word.bounds.bottom));
}

function layoutCloudWords(words: CloudWord[], maxScore: number, shape: CloudShape) {
  const candidates: Array<{ x: number; y: number }> = [];
  for (let y = 24; y <= VIEW_HEIGHT - 24; y += 10) {
    for (let x = 24; x <= VIEW_WIDTH - 24; x += 10) if (isInsideShape(shape, x, y)) candidates.push({ x, y });
  }
  const targets: Array<{ x: number; y: number }> = [];
  const cloudSeeds = [
    { x: 400, y: 285 }, { x: 340, y: 215 }, { x: 495, y: 210 }, { x: 230, y: 295 }, { x: 610, y: 285 },
    { x: 400, y: 125 }, { x: 300, y: 145 }, { x: 510, y: 120 }, { x: 175, y: 315 }, { x: 660, y: 310 },
    { x: 235, y: 370 }, { x: 350, y: 382 }, { x: 480, y: 382 }, { x: 590, y: 365 },
  ];
  for (let index = 0; index < words.length; index += 1) {
    if (shape === "cloud" && cloudSeeds[index]) { targets.push(cloudSeeds[index]); continue; }
    let best = candidates[0] ?? { x: 400, y: 250 };
    let bestDistance = -1;
    for (const candidate of candidates) {
      let distance = -((candidate.x - 400) ** 2 + (candidate.y - 250) ** 2);
      if (targets.length) {
        distance = Number.POSITIVE_INFINITY;
        for (const target of targets) distance = Math.min(distance, ((candidate.x - target.x) / 1.35) ** 2 + (candidate.y - target.y) ** 2);
      }
      const deterministicBias = ((candidate.x * 31 + candidate.y * 17 + index * 13) % 29) / 100;
      if (distance + deterministicBias > bestDistance) { best = candidate; bestDistance = distance + deterministicBias; }
    }
    targets.push(best);
  }

  const placed: PlacedCloudWord[] = [];
  words.forEach((word, index) => {
    const target = targets[index] ?? { x: 400, y: 250 };
    const orderedCandidates = [...candidates].sort((a, b) => ((a.x - target.x) ** 2 + (a.y - target.y) ** 2) - ((b.x - target.x) ** 2 + (b.y - target.y) ** 2));
    const initialSize = 10 + (word.score / maxScore) * 25;
    for (const scale of [1, .9, .8, .7, .6, .5, .42]) {
      const fontSize = Math.max(7.5, initialSize * scale);
      const candidate = orderedCandidates.find(({ x, y }) => {
        const bounds = wordBounds(word.label, fontSize, x, y);
        return boundsFitShape(shape, bounds) && !intersects(bounds, placed);
      });
      if (candidate) {
        placed.push({ ...word, ...candidate, fontSize, bounds: wordBounds(word.label, fontSize, candidate.x, candidate.y) });
        return;
      }
    }
  });
  return placed;
}

const normalizeWord = (value: string) => {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  return normalized.length > 5 ? normalized.replace(/s$/, "") : normalized;
};
const tokensOf = (value: string) => value.replace(/[’']/g, " ").match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];

export function VerbatimCloudView({ data, configuration }: ViewRendererProps) {
  const { locale, t } = useI18n();
  const [category, setCategory] = useState("all");
  const [team, setTeam] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [shape, setShape] = useState<CloudShape>(() => asCloudShape(optionOf(configuration, "cloudShape", "cloud")));
  const categories = useMemo(() => sectionOf(configuration, "categories")?.items ?? [], [configuration]);
  const categoryById = useMemo(() => new Map(categories.map((item) => [String(item.id), { label: String(item.label ?? item.id), color: String(item.color ?? "#2563eb") }])), [categories]);
  const teams = useMemo(() => [...new Set(data.verbatims.map((item) => item.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [data.verbatims]);
  const stopWords = useMemo(() => new Set((sectionOf(configuration, "stopWords")?.items ?? []).map((item) => normalizeWord(String(item.word ?? item.id)))), [configuration]);
  const minWordLength = Math.max(2, Number(optionOf(configuration, "minWordLength", 4)));
  const maxWords = Math.min(100, Math.max(10, Number(optionOf(configuration, "maxWords", 45))));

  const filtered = useMemo(() => {
    const needle = normalizeWord(query.trim());
    return data.verbatims.filter((item) => (category === "all" || item.category === category) && (team === "all" || item.team === team) && (!needle || normalizeWord(item.text).includes(needle)));
  }, [category, data.verbatims, query, team]);

  const words = useMemo(() => {
    const frequencies = new Map<string, { label: string; count: number; score: number; categories: Map<string, number> }>();
    for (const verbatim of filtered) {
      const seen = new Set<string>();
      for (const token of tokensOf(verbatim.text)) {
        const key = normalizeWord(token).replace(/^['’-]+|['’-]+$/g, "");
        if (key.length < minWordLength || stopWords.has(key) || /^\d+$/.test(key)) continue;
        const entry = frequencies.get(key) ?? { label: token.toLocaleLowerCase("fr"), count: 0, score: 0, categories: new Map<string, number>() };
        if (!seen.has(key)) entry.count += 1;
        entry.score += Number.isFinite(verbatim.weight) ? verbatim.weight : 1;
        entry.categories.set(verbatim.category, (entry.categories.get(verbatim.category) ?? 0) + verbatim.weight);
        frequencies.set(key, entry);
        seen.add(key);
      }
    }
    return [...frequencies.entries()].map(([key, value]) => {
      const dominantCategory = [...value.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return { key, ...value, color: categoryById.get(dominantCategory)?.color ?? "#2563eb" };
    }).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "fr")).slice(0, maxWords);
  }, [categoryById, filtered, maxWords, minWordLength, stopWords]);

  const selectedVerbatims = useMemo(() => {
    if (!selectedWord) return filtered.slice(0, 10);
    return filtered.filter((item) => tokensOf(item.text).some((token) => normalizeWord(token) === selectedWord)).slice(0, 12);
  }, [filtered, selectedWord]);
  const maxScore = words[0]?.score ?? 1;
  const placedWords = useMemo(() => layoutCloudWords(words, maxScore, shape), [maxScore, shape, words]);
  const shapeViewBox = shape === "round" ? "150 0 500 500" : shape === "cloud" ? "80 45 680 390" : `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
  const selectedLabel = words.find((word) => word.key === selectedWord)?.label;
  const fullscreen = () => document.querySelector(".verbatim-cloud-workspace")?.requestFullscreen?.();

  return <div className="verbatim-cloud-workspace">
    <header className="verbatim-toolbar">
      <div><span className="verbatim-view-icon"><Cloud size={20} /></span><div><strong>{t("Analyse des verbatims")}</strong><small>{t("Les mots dominants révèlent irritants, besoins et attentes")}</small></div></div>
      <div className="verbatim-filters">
        <label className="verbatim-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Rechercher un verbatim")} /></label>
        <select value={category} onChange={(event) => { setCategory(event.target.value); setSelectedWord(null); }} aria-label={t("Filtrer par catégorie")}><option value="all">{t("Toutes les catégories")}</option>{categories.map((item) => <option key={item.id} value={String(item.id)}>{String(item.label ?? item.id)}</option>)}</select>
        <select value={team} onChange={(event) => { setTeam(event.target.value); setSelectedWord(null); }} aria-label={t("Filtrer par équipe")}><option value="all">{t("Toutes les équipes")}</option>{teams.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="cloud-shape-select" value={shape} onChange={(event) => setShape(asCloudShape(event.target.value))} aria-label={t("Forme du nuage de mots")}>{cloudShapes.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select>
        <button className="icon-button" onClick={fullscreen} aria-label={t("Afficher en plein écran")}><Maximize2 size={17} /></button>
      </div>
    </header>

    <div className="verbatim-kpis">
      <span><MessageSquareText size={16} /><strong>{filtered.length}</strong> {t("verbatims")}</span>
      <span><Users size={16} /><strong>{new Set(filtered.map((item) => item.team)).size}</strong> {t("équipes")}</span>
      <span><Cloud size={16} /><strong>{words.length}</strong> {t("termes significatifs")}</span>
    </div>

    <main className="verbatim-layout" data-view-export-content>
      <section className="word-cloud-panel">
        <div className="word-cloud-legend">{categories.map((item) => <span key={item.id}><i style={{ background: String(item.color ?? "#2563eb") }} />{String(item.label ?? item.id)}</span>)}</div>
        {words.length ? <div className="word-cloud-stage"><svg className={`word-cloud-svg shape-${shape}`} data-shape={shape} viewBox={shapeViewBox} role="img" aria-label={`${locale === "fr" ? "Nuage de mots — forme" : "Word cloud — shape"} ${t(cloudShapes.find((item) => item.value === shape)?.label ?? "Nuage")}`}>
          {placedWords.map((word) => <text key={word.key} x={word.x} y={word.y} fill={word.color} fontSize={word.fontSize} textAnchor="middle" dominantBaseline="middle" role="button" tabIndex={0} className={selectedWord === word.key ? "selected" : ""} aria-label={`${word.label}, ${word.count} ${t("verbatims")}`} onClick={() => setSelectedWord((current) => current === word.key ? null : word.key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedWord((current) => current === word.key ? null : word.key); }}>{word.label}</text>)}
        </svg></div> : <div className="verbatim-empty"><Cloud size={34} /><strong>{t("Aucun terme à afficher")}</strong><p>{t("Ajoutez des verbatims ou élargissez les filtres.")}</p></div>}
      </section>

      <aside className="verbatim-details">
        <header><div><p className="eyebrow">{t("Verbatims associés")}</p><h2>{selectedLabel ? `« ${selectedLabel} »` : t("Retours du terrain")}</h2></div>{selectedWord && <button className="icon-button" onClick={() => setSelectedWord(null)} aria-label={t("Effacer la sélection")}><X size={16} /></button>}</header>
        <p>{selectedLabel ? locale === "fr" ? `${selectedVerbatims.length} retour${selectedVerbatims.length > 1 ? "s" : ""} contient ce terme.` : `${selectedVerbatims.length} feedback entr${selectedVerbatims.length === 1 ? "y contains" : "ies contain"} this term.` : t("Sélectionnez un mot pour retrouver immédiatement les commentaires qui l’expliquent.")}</p>
        <div className="verbatim-quote-list">{selectedVerbatims.map((item) => <VerbatimQuote key={item.id} item={item} category={categoryById.get(item.category)} />)}</div>
      </aside>
    </main>
  </div>;
}

function VerbatimQuote({ item, category }: { item: Verbatim; category?: { label: string; color: string } }) {
  const { t } = useI18n();
  return <article><div><span style={{ color: category?.color, borderColor: `${category?.color}40`, background: `${category?.color}10` }}>{category?.label ?? item.category}</span><em>{item.sentiment}</em></div><blockquote>« {item.text} »</blockquote><small>{item.team} · {t("poids")} {item.weight}</small></article>;
}
