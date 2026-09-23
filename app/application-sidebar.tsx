"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronsUpDown, GalleryVerticalEnd, Moon, Network, Plus, Settings, Star, Sun, X, type LucideIcon } from "lucide-react";
import { APP_LOCALES, useI18n, type AppLocale } from "../library/src";

export type SidebarFavorite = { id: string; name: string; icon: LucideIcon; active: boolean };
type Theme = "light" | "dark";
type Accent = "blue" | "violet" | "emerald";

type ApplicationSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  instancesCount: number;
  catalogActive: boolean;
  createActive: boolean;
  favorites: SidebarFavorite[];
  theme: Theme;
  accent: Accent;
  appVersion: string;
  appChannel: string;
  onCollapsedChange: (collapsed: boolean) => void;
  onMobileOpenChange: (open: boolean) => void;
  onCatalog: () => void;
  onCreate: () => void;
  onInterconnections: () => void;
  onOpenFavorite: (id: string) => void;
  onThemeChange: (theme: Theme) => void;
  onAccentChange: (accent: Accent) => void;
};

type HighlightStyle = CSSProperties & { opacity: number };
const hiddenHighlight: HighlightStyle = { height: 0, opacity: 0, transform: "translate3d(0, 0, 0)" };

function ScalengiMark() {
  return <span className="scalengi-brand-mark" aria-hidden="true" />;
}

export function ApplicationSidebar({ collapsed, mobileOpen, instancesCount, catalogActive, createActive, favorites, theme, accent, appVersion, appChannel, onCollapsedChange, onMobileOpenChange, onCatalog, onCreate, onInterconnections, onOpenFavorite, onThemeChange, onAccentChange }: ApplicationSidebarProps) {
  const { locale, setLocale, t } = useI18n();
  const rootRef = useRef<HTMLElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highlightStyle, setHighlightStyle] = useState<HighlightStyle>(hiddenHighlight);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        onCollapsedChange(!collapsed);
      }
      if (event.key === "Escape") {
        setWorkspaceMenuOpen(false);
        setAccountMenuOpen(false);
        setSettingsOpen(false);
        onMobileOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, onCollapsedChange, onMobileOpenChange]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
        setAccountMenuOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const moveHighlight = (element: HTMLElement) => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const navigationBox = navigation.getBoundingClientRect();
    const itemBox = element.getBoundingClientRect();
    const transform = `translate3d(0, ${itemBox.top - navigationBox.top}px, 0)`;
    setHighlightStyle((previous) => previous.transform === transform && previous.height === itemBox.height && previous.opacity === 1 ? previous : { height: itemBox.height, opacity: 1, transform });
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>("[data-sidebar-item]");
    if (item) moveHighlight(item);
  };
  const navigate = (action: () => void) => { action(); onMobileOpenChange(false); };

  return <>
    <button className="sidebar-mobile-backdrop" type="button" aria-label={t("Fermer le menu")} aria-hidden={!mobileOpen} tabIndex={mobileOpen ? 0 : -1} onClick={() => onMobileOpenChange(false)} />
    <aside className="app-sidebar" ref={rootRef} aria-label={t("Navigation principale")}>
      <header className="sidebar-header">
        <button className="sidebar-workspace-button" type="button" aria-haspopup="menu" aria-expanded={workspaceMenuOpen} onClick={() => { setWorkspaceMenuOpen((open) => !open); setAccountMenuOpen(false); setSettingsOpen(false); }} title={collapsed ? "Scalengi Views" : undefined}>
          <span className="sidebar-logo"><ScalengiMark /></span>
          <span className="sidebar-workspace-copy"><strong>Scalengi Views</strong><small>{t("Local")}</small></span>
          <ChevronsUpDown size={16} />
        </button>
        {workspaceMenuOpen && <div className="sidebar-dropdown workspace-dropdown" role="menu"><span className="sidebar-dropdown-label">{t("Espace de démonstration")}</span><div className="workspace-current"><span className="sidebar-logo"><ScalengiMark /></span><div><strong>Scalengi Views</strong><small>{t("Local")}</small></div><Check size={15} /></div></div>}
      </header>

      <div className="sidebar-content">
        <nav className="main-navigation" ref={navigationRef} aria-label={t("Navigation principale")} onPointerMove={handlePointerMove} onPointerLeave={() => setHighlightStyle((previous) => ({ ...previous, opacity: 0 }))} onFocusCapture={(event) => { const item = (event.target as HTMLElement).closest<HTMLElement>("[data-sidebar-item]"); if (item) moveHighlight(item); }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHighlightStyle((previous) => ({ ...previous, opacity: 0 })); }}>
          <span className="sidebar-hover-highlight" style={highlightStyle} aria-hidden="true" />
          <div className="sidebar-group"><ul className="sidebar-menu">
            <li><button data-sidebar-item type="button" className={catalogActive ? "active" : ""} onClick={() => navigate(onCatalog)} aria-current={catalogActive ? "page" : undefined} title={collapsed ? t("Mes vues") : undefined}><GalleryVerticalEnd /><span>{t("Mes vues")}</span><em>{instancesCount}</em></button></li>
            <li><button data-sidebar-item type="button" className={createActive ? "active" : ""} onClick={() => navigate(onCreate)} aria-current={createActive ? "page" : undefined} title={collapsed ? t("Créer une vue") : undefined}><Plus /><span>{t("Nouvelle vue")}</span></button></li>
          </ul></div>
          {favorites.length > 0 && <div className="sidebar-group sidebar-view-list"><div className="sidebar-group-label">{t("Favoris")}</div><ul className="sidebar-menu">{favorites.map(({ id, name, icon: Icon, active }) => <li key={id}><button data-sidebar-item type="button" className={active ? "active" : ""} onClick={() => navigate(() => onOpenFavorite(id))} aria-current={active ? "page" : undefined} title={collapsed ? name : undefined}><Icon /><span>{name}</span><Star className="sidebar-favorite-icon" fill="currentColor" /></button></li>)}</ul></div>}
        </nav>
      </div>

      <footer className="sidebar-footer">
        <button className="sidebar-account-button" type="button" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => { setAccountMenuOpen((open) => !open); setWorkspaceMenuOpen(false); setSettingsOpen(false); }} title={collapsed ? t("Espace de démonstration") : undefined}>
          <span className="user-avatar">SV</span><span className="sidebar-account-copy"><strong>{t("Espace de démonstration")}</strong><small>{t(appChannel)} · v{appVersion}</small></span><ChevronsUpDown size={16} />
        </button>
        {accountMenuOpen && <div className="sidebar-dropdown account-dropdown" role="menu"><div className="account-menu-summary"><span className="user-avatar">SV</span><div><strong>{t("Espace de démonstration")}</strong><small>Scalengi Views</small></div></div><div className="sidebar-dropdown-separator"/><button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); setSettingsOpen(true); }}><Settings size={16}/><span>{t("Paramètres")}</span></button><button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); setSettingsOpen(false); navigate(onInterconnections); }}><Network size={16}/><span>{locale === "fr" ? "Interconnexions" : "Connections"}</span></button><div className="sidebar-dropdown-separator"/><div className="sidebar-version-row"><span>{t(appChannel)}</span><small>v{appVersion}</small></div></div>}
      </footer>


      {settingsOpen && <section className="sidebar-settings-popover" role="dialog" aria-modal="false" aria-labelledby="sidebar-settings-title">
        <header><div><h2 id="sidebar-settings-title">{t("Paramètres")}</h2><p>{t("Préférences locales")}</p></div><button type="button" onClick={() => setSettingsOpen(false)} aria-label={t("Fermer les paramètres")}><X size={16}/></button></header>
        <div className="sidebar-settings-field"><label htmlFor="sidebar-language">{t("Langue")}</label><select id="sidebar-language" value={locale} onChange={(event) => setLocale(event.target.value as AppLocale)}>{APP_LOCALES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></div>
        <div className="sidebar-settings-field"><label>{t("Thème")}</label><div className="sidebar-theme-options"><button type="button" className={theme === "light" ? "active" : ""} aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}><Sun size={15}/>{t("Clair")}</button><button type="button" className={theme === "dark" ? "active" : ""} aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}><Moon size={15}/>{t("Sombre")}</button></div></div>
        <div className="sidebar-settings-field"><label>{t("Couleur principale")}</label><div className="sidebar-color-options">{(["blue", "violet", "emerald"] as const).map((color) => <button type="button" className={`${color} ${accent === color ? "active" : ""}`} key={color} aria-label={t(`Couleur ${color}`)} aria-pressed={accent === color} onClick={() => onAccentChange(color)}/>)}</div></div>
      </section>}

      <button className="sidebar-rail" type="button" onClick={() => onCollapsedChange(!collapsed)} aria-label={t(collapsed ? "Ouvrir le menu" : "Réduire le menu")} title={t(collapsed ? "Ouvrir le menu" : "Réduire le menu")}/>
    </aside>
  </>;
}
