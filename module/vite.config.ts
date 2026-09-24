import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "dist-module/package",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: "module/entry.ts",
      formats: ["es"],
      fileName: () => "scalengi-views.mjs",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        assetFileNames: (asset) => asset.name?.endsWith(".css") ? "scalengi-views.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
