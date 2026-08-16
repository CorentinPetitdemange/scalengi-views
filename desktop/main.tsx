import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ScalengiViewsApp } from "../app/scalengi-views-app";
import "../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Le point de montage de Scalengi Views est introuvable.");

createRoot(root).render(<StrictMode><ScalengiViewsApp /></StrictMode>);
