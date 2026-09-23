"use client";

import { useState } from "react";
import { Database, Globe, Info, LockKeyhole, Network } from "lucide-react";
import { useI18n } from "../library/src";

const connectors = [
  { id: "database", name: "Base de données (BDD)", port: "", kind: "database" },
  { id: "scalengi", name: "Scalengi", port: "", kind: "service" },
  { id: "scalengi-inventory", name: "Scalengi Inventory", port: "", kind: "inventory" },
  { id: "rest", name: "API REST", port: "", kind: "service" },
  { id: "mcp", name: "MCP", port: "", kind: "service" },
] as const;

/** UI preview only. No credentials, persistence, or transport are implemented here. */
export function InterconnectionsScreen() {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [selected, setSelected] = useState<string>("database");
  const connector = connectors.find((item) => item.id === selected)!;
  return <div className="page-screen connections-screen">
    <div className="section-heading"><div><p className="eyebrow">{fr ? "Configuration" : "Configuration"}</p><h2>{fr ? "Interconnexions" : "Connections"}</h2><p>{fr ? "Les sources de données de votre espace, au même endroit." : "Your workspace data sources, in one place."}</p></div><span className="connection-preview-badge">{fr ? "Aperçu uniquement" : "Preview only"}</span></div>
    <div className="connection-notice"><Info size={18}/><p>{fr ? "Cette page présente la future configuration. Aucun service n’est connecté : les champs et les actions sont désactivés, et aucune information n’est enregistrée." : "This is a preview of future configuration. No service is connected: fields and actions are disabled, and no information is saved."}</p></div>
    <div className="connections-layout">
      <section className="connection-catalog" aria-label={fr ? "Types de connexion" : "Connection types"}>
        <h3>{fr ? "Sources disponibles en aperçu" : "Preview sources"}</h3>
        {connectors.map((item) => { const Icon = item.kind === "database" ? Database : item.id.startsWith("scalengi") ? Network : Globe; const category = item.kind === "database" ? (fr ? "Source BDD générique" : "Generic database source") : item.kind === "inventory" ? (fr ? "Référentiel Scalengi" : "Scalengi repository") : (fr ? "Service externe" : "External service"); return <button key={item.id} type="button" aria-pressed={selected === item.id} className={selected === item.id ? "selected" : ""} onClick={() => setSelected(item.id)}><Icon size={19}/><span><strong>{item.name}</strong><small>{category}</small></span><span className="connection-soon">{fr ? "À venir" : "Planned"}</span></button>; })}
      </section>
      <section className="connection-panel" aria-labelledby="connection-title">
        <header><div><h3 id="connection-title">{connector.name}</h3><p>{fr ? "Paramètres de connexion" : "Connection settings"}</p></div><span className="connection-preview-badge">{fr ? "Non connecté" : "Not connected"}</span></header>
        <fieldset disabled key={connector.id}><legend>{fr ? "Informations générales" : "General information"}</legend>
          <label>{fr ? "Nom de la connexion" : "Connection name"}<input placeholder={fr ? "Ma source de données" : "My data source"} /></label>
          <div className="connection-fields"><label>{connector.kind === "database" ? (fr ? "Hôte" : "Host") : "URL"}<input placeholder={connector.kind === "database" ? "db.example.com" : "https://api.example.com"} /></label>{connector.kind === "database" && <label>Port<input placeholder={fr ? "Selon le moteur" : "Depends on engine"}/></label>}</div>
          {connector.kind === "database" && <label>{fr ? "Base de données" : "Database"}<input placeholder={fr ? "Nom de la base" : "Database name"}/></label>}
          <h4><LockKeyhole size={16}/>{fr ? "Authentification et sécurité" : "Authentication and security"}</h4>
          <label>{fr ? "Méthode d’authentification" : "Authentication method"}<select defaultValue="credentials"><option value="credentials">{connector.kind === "database" ? (fr ? "Identifiant et mot de passe" : "Username and password") : (fr ? "Jeton d’accès" : "Access token")}</option></select></label>
          {connector.kind === "database" && <label>{fr ? "Identifiant" : "Username"}<input placeholder={fr ? "Utilisateur de lecture" : "Read-only user"}/></label>}
          <label>{connector.kind === "database" ? (fr ? "Mot de passe" : "Password") : (fr ? "Jeton d’accès" : "Access token")}<input type="password" autoComplete="off" placeholder={fr ? "Non disponible dans cet aperçu" : "Unavailable in this preview"}/></label>
          <label className="connection-checkbox"><input type="checkbox" defaultChecked/>{fr ? "Connexion chiffrée (TLS)" : "Encrypted connection (TLS)"}</label>
        </fieldset>
        <footer><span>{fr ? "Configuration non enregistrée" : "Configuration not saved"}</span><button type="button" disabled>{fr ? "Tester la connexion" : "Test connection"}</button><button type="button" className="primary-button" disabled>{fr ? "Enregistrer" : "Save"}</button></footer>
      </section>
    </div>
  </div>;
}
