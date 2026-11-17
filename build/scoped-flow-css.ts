/** Scope the dependency at build time so loading Views cannot restyle another canvas. */
export function scopedFlowStyles() {
  return {
    name: "scalengi-views-scope-reactflow",
    enforce: "pre" as const,
    transform(source: string, id: string) {
      if (!id.replaceAll("\\", "/").split("?")[0]?.endsWith("/reactflow/dist/style.css")) return null;
      return { code: `@scope (.app-shell, .scalengi-views-surface) {\n${source}\n}`, map: null };
    },
  };
}
