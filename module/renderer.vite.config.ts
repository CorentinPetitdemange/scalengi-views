import { scopedFlowStyles } from "../build/scoped-flow-css.ts";
import react from "@vitejs/plugin-react";
import { defineConfig, esmExternalRequirePlugin } from "vite";

export default defineConfig({
  publicDir: false,
  plugins: [scopedFlowStyles(), react(), esmExternalRequirePlugin({ external: ["react", "react-dom", "react/jsx-runtime"] })],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist-module/package",
    emptyOutDir: false,
    sourcemap: false,
    cssCodeSplit: false,
    lib: { entry: "module/renderer.ts", formats: ["es"], fileName: () => "scalengi-views-renderer.mjs" },
    rollupOptions: {
      output: { assetFileNames: (asset) => asset.name?.endsWith(".css") ? "scalengi-views-renderer.css" : "assets/[name]-[hash][extname]" },
    },
  },
});
