import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ViewReport,viewRegistry} from "../dist-module/package/scalengi-views-renderer.mjs";
import {createEmptyDataset} from "../library/src/dataset.ts";

test("unclassified feedbacks remain unknown, do not invent a team, and expose canonical navigation",()=>{
 const data=createEmptyDataset();data.verbatims=Array.from({length:25},(_,i)=>({id:`message-${i}`,text:"Améliorer le traitement des demandes",category:"Terrain",team:"",sentiment:"Non renseigné",weight:1}));
 const html=renderToStaticMarkup(createElement(ViewReport,{definition:viewRegistry.get("verbatim-cloud"),data,locale:"fr",onOpenItem:()=>{}}));
 assert.match(html,/Non renseigné/);assert.match(html,/Ouvrir le feedback/);assert.match(html,/12.*25/);assert.match(html,/Afficher plus/);
 assert.match(html,/<strong>0<\/strong>.*équipes/);assert.equal((html.match(/Ouvrir le feedback/g)||[]).length,12);
});
test("standalone citations stay readable without a host action",()=>{
 const data=createEmptyDataset();data.verbatims=[{id:"original",text:"Retour terrain",category:"Terrain",team:"Atelier",sentiment:"Positif",weight:1}];
 const html=renderToStaticMarkup(createElement(ViewReport,{definition:viewRegistry.get("verbatim-cloud"),data,locale:"fr"}));
 assert.match(html,/Positif/);assert.doesNotMatch(html,/Ouvrir le feedback/);
});
