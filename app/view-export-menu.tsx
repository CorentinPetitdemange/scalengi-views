"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Download, FileCode2, Image as ImageIcon, LoaderCircle } from "lucide-react";
import { exportViewElement, type ViewExportFormat } from "../library/src/export-view";

interface ViewExportMenuProps {
  targetRef: RefObject<HTMLElement | null>;
  filename: string;
  onExported: (message: string) => void;
}

export function ViewExportMenu({ targetRef, filename, onExported }: ViewExportMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<ViewExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const runExport = async (format: ViewExportFormat) => {
    const target = targetRef.current;
    if (!target) {
      setError("La vue n’est pas disponible.");
      return;
    }
    setExporting(format);
    setError(null);
    try {
      await exportViewElement(target, { format, filename });
      setOpen(false);
      onExported(`Export ${format.toUpperCase()} généré`);
    } catch (cause) {
      console.error("Erreur pendant l’export de la vue", cause);
      setError("L’export a échoué. Réessayez après le chargement complet de la vue.");
    } finally {
      setExporting(null);
    }
  };

  return <div className="view-export-menu" ref={rootRef}>
    <button className="view-export-trigger" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen((value) => !value); setError(null); }}>
      <Download size={15} /> Exporter
    </button>
    {open && <div className="view-export-popover" role="menu" aria-label="Formats d’export">
      <div className="view-export-popover-title"><Download size={14} /><strong>Exporter la vue</strong></div>
      <button type="button" role="menuitem" disabled={exporting !== null} onClick={() => void runExport("png")}>
        {exporting === "png" ? <LoaderCircle className="export-spinner" size={15} /> : <ImageIcon size={15} />}
        <span><strong>{exporting === "png" ? "Exportation…" : "Image (PNG)"}</strong><small>Haute résolution</small></span>
      </button>
      <button type="button" role="menuitem" disabled={exporting !== null} onClick={() => void runExport("svg")}>
        {exporting === "svg" ? <LoaderCircle className="export-spinner" size={15} /> : <FileCode2 size={15} />}
        <span><strong>{exporting === "svg" ? "Exportation…" : "Vecteur (SVG)"}</strong><small>Format éditable</small></span>
      </button>
      {error && <p className="view-export-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
