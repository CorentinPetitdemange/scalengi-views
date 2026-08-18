export type ViewExportFormat = "png" | "svg";

export interface ExportViewOptions {
  format: ViewExportFormat;
  filename: string;
  pixelRatio?: number;
}

const EXPORT_EXCLUDE_SELECTOR = [
  "[data-export-exclude]",
  ".react-flow__controls",
  ".react-flow__minimap",
  ".react-flow__panel",
  ".react-flow__resize-control",
  ".react-flow__background",
  ".react-flow__handle",
  ".react-flow__attribution",
  ".rf-fullscreen-button",
  ".metamodel-reading-status",
].join(",");

const GRAPH_PADDING = 64;
const MAX_GRAPH_EXPORT_EDGE = 2400;

interface ExportSurface {
  target: HTMLElement;
  width: number;
  height: number;
  dispose: () => void;
}

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("fr");
  return normalized || "vue-scalengi";
}

function exportFilter(node: HTMLElement) {
  return !(node instanceof Element && (node.matches(EXPORT_EXCLUDE_SELECTOR) || node.closest(EXPORT_EXCLUDE_SELECTOR)));
}

function dataUrlToBlob(dataUrl: string) {
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Le fichier exporté est invalide.");

  const metadata = dataUrl.slice(5, separator);
  const payload = dataUrl.slice(separator + 1);
  const mimeType = metadata.split(";")[0] || "application/octet-stream";
  if (!metadata.includes(";base64")) return new Blob([decodeURIComponent(payload)], { type: mimeType });

  const decoded = window.atob(payload);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function download(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = objectUrl;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

function copyInheritedAppearance(source: HTMLElement, target: HTMLElement) {
  const styles = window.getComputedStyle(source);
  for (let index = 0; index < styles.length; index += 1) {
    const property = styles.item(index);
    if (property.startsWith("--")) target.style.setProperty(property, styles.getPropertyValue(property));
  }
  target.style.color = styles.color;
  target.style.fontFamily = styles.fontFamily;
}

/**
 * React Flow ne dimensionne pas son conteneur sur les nœuds : scrollWidth ne
 * représente donc que le cadre à l'écran. Cette surface temporaire recadre le
 * viewport sur l'ensemble des nœuds sans modifier la vue affichée.
 */
function createReactFlowExportSurface(exportTarget: HTMLElement): ExportSurface | null {
  const flow = exportTarget.querySelector<HTMLElement>(".react-flow");
  const viewport = flow?.querySelector<HTMLElement>(".react-flow__viewport");
  const nodes = viewport ? Array.from(viewport.querySelectorAll<HTMLElement>(".react-flow__node")) : [];
  if (!flow || !viewport || nodes.length === 0) return null;

  const flowRect = flow.getBoundingClientRect();
  const transform = window.getComputedStyle(viewport).transform;
  const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
  const zoom = Math.abs(matrix.a) || 1;
  const nodeBounds = nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: (rect.left - flowRect.left - matrix.e) / zoom,
      top: (rect.top - flowRect.top - matrix.f) / zoom,
      right: (rect.right - flowRect.left - matrix.e) / zoom,
      bottom: (rect.bottom - flowRect.top - matrix.f) / zoom,
    };
  });
  const left = Math.min(...nodeBounds.map((bounds) => bounds.left));
  const top = Math.min(...nodeBounds.map((bounds) => bounds.top));
  const right = Math.max(...nodeBounds.map((bounds) => bounds.right));
  const bottom = Math.max(...nodeBounds.map((bounds) => bounds.bottom));
  if (![left, top, right, bottom].every(Number.isFinite)) return null;

  const naturalWidth = Math.max(1, right - left + GRAPH_PADDING * 2);
  const naturalHeight = Math.max(1, bottom - top + GRAPH_PADDING * 2);
  const scale = Math.min(1, MAX_GRAPH_EXPORT_EDGE / naturalWidth, MAX_GRAPH_EXPORT_EDGE / naturalHeight);
  const width = Math.max(1, Math.ceil(naturalWidth * scale));
  const height = Math.max(1, Math.ceil(naturalHeight * scale));
  const offsetX = GRAPH_PADDING * scale - left * scale;
  const offsetY = GRAPH_PADDING * scale - top * scale;

  const stagingTarget = exportTarget.cloneNode(true) as HTMLElement;
  stagingTarget.setAttribute("aria-hidden", "true");
  copyInheritedAppearance(exportTarget, stagingTarget);
  Object.assign(stagingTarget.style, {
    position: "relative",
    inset: "auto",
    background: "transparent",
    width: `${width}px`,
    height: `${height}px`,
    minWidth: "0",
    minHeight: "0",
    overflow: "hidden",
  });
  const stagingViewport = stagingTarget.querySelector<HTMLElement>(".react-flow__viewport");
  if (!stagingViewport) return null;
  stagingViewport.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  stagingTarget.querySelectorAll<HTMLElement>([
    ".react-flow",
    ".react-flow__renderer",
    ".react-flow__pane",
    ".metamodel-layer",
  ].join(",")).forEach((node) => {
    node.style.background = "transparent";
  });
  const stagingWrapper = document.createElement("div");
  Object.assign(stagingWrapper.style, {
    position: "fixed",
    inset: "0 auto auto -10000px",
    width: `${width}px`,
    height: `${height}px`,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "-1",
  });
  stagingWrapper.appendChild(stagingTarget);
  document.body.appendChild(stagingWrapper);

  return {
    target: stagingTarget,
    width,
    height,
    dispose: () => stagingWrapper.remove(),
  };
}

function createExportSurface(exportTarget: HTMLElement): ExportSurface {
  return createReactFlowExportSurface(exportTarget) ?? {
    target: exportTarget,
    width: Math.max(1, Math.ceil(exportTarget.scrollWidth)),
    height: Math.max(1, Math.ceil(exportTarget.scrollHeight)),
    dispose: () => undefined,
  };
}

/**
 * Exporte le contenu utile de la vue. Pour un graphe React Flow, tous les
 * objets sont automatiquement cadrés, y compris ceux hors de l'écran.
 */
export async function exportViewElement(element: HTMLElement, options: ExportViewOptions) {
  if (!element.isConnected) throw new Error("La vue à exporter n’est plus affichée.");

  const exportTarget = element.querySelector<HTMLElement>("[data-view-export-content]") ?? element;
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${safeFilename(options.filename)}_${date}.${options.format}`;
  const surface = createExportSurface(exportTarget);
  const imageOptions = {
    width: surface.width,
    height: surface.height,
    cacheBust: true,
    style: { background: "transparent" },
    filter: exportFilter,
    fontEmbedCSS: "",
  };

  element.classList.add("exporting-view");
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    // Chargé uniquement au premier export pour ne pas alourdir le démarrage de l'application.
    const { toBlob, toSvg } = await import("html-to-image");
    const blob = options.format === "png"
      ? await toBlob(surface.target, { ...imageOptions, pixelRatio: options.pixelRatio ?? 2 })
      : dataUrlToBlob(await toSvg(surface.target, imageOptions));
    if (!blob) throw new Error("La génération du fichier exporté a échoué.");
    download(blob, filename);
  } finally {
    surface.dispose();
    element.classList.remove("exporting-view");
  }
}
