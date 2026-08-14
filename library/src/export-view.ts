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
  ".rf-fullscreen-button",
].join(",");

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

function visibleBackground(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    const color = window.getComputedStyle(current).backgroundColor;
    if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") return color;
    current = current.parentElement;
  }
  return "#ffffff";
}

function download(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Exporte exactement la surface visible d'une vue, sans les contrôles flottants.
 * Le shell appelle cette fonction : un renderer de vue n'a rien à implémenter.
 */
export async function exportViewElement(element: HTMLElement, options: ExportViewOptions) {
  if (!element.isConnected) throw new Error("La vue à exporter n’est plus affichée.");

  const exportTarget = element.querySelector<HTMLElement>("[data-view-export-content]") ?? element;
  const width = Math.max(1, Math.ceil(exportTarget.scrollWidth));
  const height = Math.max(1, Math.ceil(exportTarget.scrollHeight));
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${safeFilename(options.filename)}_${date}.${options.format}`;
  const imageOptions = {
    width,
    height,
    cacheBust: true,
    backgroundColor: visibleBackground(exportTarget),
    filter: exportFilter,
    fontEmbedCSS: "",
  };

  element.classList.add("exporting-view");
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    // Chargé uniquement au premier export pour ne pas alourdir le démarrage de l'application.
    const { toPng, toSvg } = await import("html-to-image");
    const dataUrl = options.format === "png"
      ? await toPng(exportTarget, { ...imageOptions, pixelRatio: options.pixelRatio ?? 2 })
      : await toSvg(exportTarget, imageOptions);
    download(dataUrl, filename);
  } finally {
    element.classList.remove("exporting-view");
  }
}
