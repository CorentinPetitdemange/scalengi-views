"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, KeyRound, Pencil, Plus, Save, ShieldCheck, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { ApiClientError, authApi, type AuthProvider, type AuthUser, type OidcAdminSettings, type OidcAdminSettingsInput, type UserRole } from "./auth-client";

const emptyDraft = { displayName: "", email: "", password: "", role: "member" as UserRole, authProvider: "local" as AuthProvider };

export function AdminScreen({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcSettings, setOidcSettings] = useState<OidcAdminSettings | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([authApi.listUsers(), authApi.registration(), authApi.oidcAdminSettings()])
      .then(([userResponse, registration, oidc]) => {
        if (!cancelled) {
          setUsers(userResponse.users);
          setRegistrationEnabled(registration.enabled);
          setOidcEnabled(oidc.enabled);
          setOidcSettings(oidc);
          setError(null);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof ApiClientError ? reason.message : "Les comptes n’ont pas pu être chargés.");
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? users.filter((user) => `${user.displayName} ${user.email}`.toLowerCase().includes(normalized)) : users;
  }, [query, users]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setPendingId("create");
    setError(null);
    try {
      const user = await authApi.createUser(draft);
      setUsers((current) => [...current, user].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setDraft(emptyDraft);
      setCreating(false);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Le compte n’a pas pu être créé.");
    } finally {
      setPendingId(null);
    }
  };

  const update = async (user: AuthUser, changes: { role?: UserRole; isActive?: boolean; authProvider?: AuthProvider }) => {
    setPendingId(user.id);
    setError(null);
    try {
      const updated = await authApi.updateUser(user.id, changes);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Le compte n’a pas pu être modifié.");
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (user: AuthUser) => {
    if (!window.confirm(`Supprimer définitivement le compte de ${user.displayName} ?`)) return;
    setPendingId(user.id);
    setError(null);
    try {
      await authApi.deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Le compte n’a pas pu être supprimé.");
    } finally {
      setPendingId(null);
    }
  };

  const toggleRegistration = async () => {
    setPendingId("registration");
    setError(null);
    try {
      const setting = await authApi.updateRegistration(!registrationEnabled);
      setRegistrationEnabled(setting.enabled);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Le réglage n’a pas pu être modifié.");
    } finally {
      setPendingId(null);
    }
  };

  const saveAccount = async (input: { displayName: string; password?: string; authProvider: AuthProvider }) => {
    if (!editing) return;
    setPendingId(editing.id);
    setError(null);
    try {
      const updated = await authApi.updateUser(editing.id, input);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditing(null);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Le compte n’a pas pu être modifié.");
    } finally {
      setPendingId(null);
    }
  };

  return <div className="admin-page">
    <div className="section-heading">
      <div><h2>Administration des comptes</h2><p>Créez les accès, attribuez les rôles et désactivez les comptes sans effacer leurs traces.</p></div>
      <button className="primary-button" onClick={() => setCreating(true)}><Plus size={16}/>Nouveau compte</button>
    </div>
    <section className="admin-registration-card">
      <div><ShieldCheck size={18}/><span><strong>Inscription libre</strong><small>{registrationEnabled ? "Les visiteurs peuvent créer un compte membre." : "Seuls les administrateurs peuvent créer des comptes."}</small></span></div>
      <button type="button" role="switch" aria-checked={registrationEnabled} className={`toggle-switch ${registrationEnabled ? "active" : ""}`} disabled={pendingId === "registration"} onClick={toggleRegistration}><span/></button>
    </section>
    {oidcSettings && <SsoSettingsCard settings={oidcSettings} onSaved={(settings) => { setOidcSettings(settings); setOidcEnabled(settings.enabled); }} onError={setError}/>}
    {error && <div className="account-feedback error" role="alert">{error}</div>}
    <section className="admin-users-card">
      <header>
        <div><Users size={17}/><strong>{users.length} compte{users.length > 1 ? "s" : ""}</strong></div>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un nom ou un e-mail" aria-label="Rechercher un compte"/>
      </header>
      <div className="admin-users-table" role="table" aria-label="Comptes utilisateurs">
        <div className="admin-user-row heading" role="row"><span>Utilisateur</span><span>Rôle</span><span>Statut</span><span>Dernière connexion</span><span>Actions</span></div>
        {filtered.map((user) => <UserRow key={user.id} user={user} own={user.id === currentUser.id} pending={pendingId === user.id} onUpdate={update} onEdit={setEditing} onRemove={remove}/>)}
        {!filtered.length && <div className="admin-users-empty">Aucun compte ne correspond à cette recherche.</div>}
      </div>
    </section>
    {creating && (
      <CreateUserModal draft={draft} oidcEnabled={oidcEnabled} pending={pendingId === "create"} onDraft={setDraft} onClose={() => setCreating(false)} onSubmit={create} />
    )}
    {editing && (
      <EditUserModal user={editing} oidcEnabled={oidcEnabled} pending={pendingId === editing.id} onClose={() => setEditing(null)} onSubmit={saveAccount} />
    )}
  </div>;
}

function SsoSettingsCard({ settings, onSaved, onError }: {
  settings: OidcAdminSettings;
  onSaved: (settings: OidcAdminSettings) => void;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState<OidcAdminSettingsInput>(() => editableOidcSettings(settings));
  const [domains, setDomains] = useState(settings.allowedDomains.join(", "));
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof OidcAdminSettingsInput>(key: K, value: OidcAdminSettingsInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    onError(null);
    try {
      const saved = await authApi.updateOidcAdminSettings({
        ...draft,
        allowedDomains: domains.split(",").map((domain) => domain.trim()).filter(Boolean),
        bootstrapAdminEmail: draft.bootstrapAdminEmail?.trim() || null,
        endSessionUrl: draft.endSessionUrl?.trim() || null,
      });
      setDraft(editableOidcSettings(saved));
      setDomains(saved.allowedDomains.join(", "));
      onSaved(saved);
    } catch (reason) {
      onError(reason instanceof ApiClientError ? reason.message : "La configuration SSO n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  };
  return <form className="admin-sso-card" onSubmit={save}>
    <header>
      <div className="admin-sso-heading"><span className="admin-sso-icon"><Building2 size={18}/></span><div><strong>Authentification SSO</strong><small>Configurez un fournisseur OpenID Connect pour cette installation de Views.</small></div></div>
      <button type="button" role="switch" aria-label="Activer le SSO" aria-checked={draft.enabled} className={`toggle-switch ${draft.enabled ? "active" : ""}`} onClick={() => update("enabled", !draft.enabled)}><span/></button>
    </header>
    <div className="admin-sso-status">
      <span className={settings.clientSecretConfigured ? "ready" : "warning"}>{settings.clientSecretConfigured ? "Secret client disponible" : "Secret client manquant"}</span>
      <small>{settings.source === "environment" ? "Configuration initiale issue de l’environnement" : settings.source === "administration" ? "Configuration administrée dans Views" : "SSO non configuré"}</small>
    </div>
    <div className="admin-sso-grid">
      <label><span>Nom affiché</span><input required maxLength={100} value={draft.providerName} onChange={(event) => update("providerName", event.target.value)} placeholder="Microsoft Entra ID"/></label>
      <label><span>URL de l’émetteur</span><input required={draft.enabled} type="url" maxLength={2048} value={draft.issuerUrl} onChange={(event) => update("issuerUrl", event.target.value)} placeholder="https://login.example.com/tenant/v2.0"/></label>
      <label><span>Identifiant client</span><input required={draft.enabled} maxLength={512} value={draft.clientId} onChange={(event) => update("clientId", event.target.value)} placeholder="Identifiant de l’application OIDC"/></label>
      <label><span>URL de retour</span><input required={draft.enabled} type="url" maxLength={2048} value={draft.redirectUrl} onChange={(event) => update("redirectUrl", event.target.value)} placeholder="https://views.example.com/api/auth/oidc/callback"/></label>
      <label className="wide"><span>Domaines e-mail autorisés</span><input disabled={draft.allowAnyDomain} value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="entreprise.fr, filiale.fr"/><small>Séparez les domaines par une virgule. Les sous-domaines ne sont pas implicitement autorisés.</small></label>
      <label><span>Administrateur SSO initial</span><input type="email" maxLength={254} value={draft.bootstrapAdminEmail ?? ""} onChange={(event) => update("bootstrapAdminEmail", event.target.value || null)} placeholder="admin@entreprise.fr"/></label>
      <label><span>URL de déconnexion (facultative)</span><input type="url" maxLength={2048} value={draft.endSessionUrl ?? ""} onChange={(event) => update("endSessionUrl", event.target.value || null)} placeholder="https://id.example.com/logout"/></label>
    </div>
    <div className="admin-sso-options">
      <SsoOption label="Autoriser tous les domaines" detail="À réserver aux fournisseurs dont le tenant est déjà strictement limité." checked={draft.allowAnyDomain} onChange={(checked) => update("allowAnyDomain", checked)}/>
      <SsoOption label="Création automatique des membres" detail="Le JIT crée uniquement des comptes membre après validation OIDC." checked={draft.jitProvisioning} onChange={(checked) => update("jitProvisioning", checked)}/>
      <SsoOption label="Conserver la connexion locale" detail="Recommandé comme accès de secours pour les administrateurs." checked={draft.localLoginEnabled} onChange={(checked) => update("localLoginEnabled", checked)}/>
      <SsoOption label="Exiger un e-mail vérifié" detail="Empêche l’utilisation d’une adresse non vérifiée par le fournisseur." checked={draft.requireVerifiedEmail} onChange={(checked) => update("requireVerifiedEmail", checked)}/>
    </div>
    <footer><div><KeyRound size={14}/><span>Le secret n’est jamais envoyé au navigateur ni enregistré dans la base. Injectez-le avec <code>SCALENGI_OIDC_CLIENT_SECRET</code>.</span></div><button className="primary-button" type="submit" disabled={saving}><Save size={15}/>{saving ? "Validation du fournisseur…" : "Enregistrer le SSO"}</button></footer>
  </form>;
}

function SsoOption({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label><span><strong>{label}</strong><small>{detail}</small></span><button type="button" role="switch" aria-checked={checked} className={`toggle-switch ${checked ? "active" : ""}`} onClick={() => onChange(!checked)}><span/></button></label>;
}

const editableOidcSettings = (settings: OidcAdminSettings): OidcAdminSettingsInput => ({
  enabled: settings.enabled,
  providerName: settings.providerName,
  issuerUrl: settings.issuerUrl,
  clientId: settings.clientId,
  redirectUrl: settings.redirectUrl,
  allowedDomains: settings.allowedDomains,
  allowAnyDomain: settings.allowAnyDomain,
  jitProvisioning: settings.jitProvisioning,
  localLoginEnabled: settings.localLoginEnabled,
  requireVerifiedEmail: settings.requireVerifiedEmail,
  bootstrapAdminEmail: settings.bootstrapAdminEmail,
  endSessionUrl: settings.endSessionUrl,
});
function UserRow({ user, own, pending, onUpdate, onEdit, onRemove }: {
  user: AuthUser;
  own: boolean;
  pending: boolean;
  onUpdate: (user: AuthUser, changes: { role?: UserRole; isActive?: boolean; authProvider?: AuthProvider }) => Promise<void>;
  onEdit: (user: AuthUser) => void;
  onRemove: (user: AuthUser) => Promise<void>;
}) {
  return <div className="admin-user-row" role="row">
    <div className="admin-user-identity">
      <span className="user-avatar">{initials(user.displayName)}</span>
      <span><strong>{user.displayName}{own && <em>Vous</em>}</strong><small>{user.email} · {authProviderLabel(user.authProvider)}</small></span>
    </div>
    <select value={user.role} disabled={pending || own} aria-label={`Rôle de ${user.displayName}`} onChange={(event) => void onUpdate(user, { role: event.target.value as UserRole })}>
      <option value="admin">Administrateur</option>
      <option value="member">Membre</option>
    </select>
    <span className={`user-status ${user.isActive ? "active" : ""}`}>{user.isActive ? "Actif" : "Désactivé"}</span>
    <span className="user-last-login">{user.lastLoginAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.lastLoginAt * 1000)) : "Jamais"}</span>
    <div className="admin-user-actions">
      <button type="button" disabled={pending || own} title={own ? "Utilisez Mon compte pour modifier votre profil" : "Modifier le profil ou réinitialiser le mot de passe"} aria-label={`Modifier ${user.displayName}`} onClick={() => onEdit(user)}><Pencil size={15}/></button>
      <button type="button" disabled={pending || own} title={user.isActive ? "Désactiver" : "Réactiver"} aria-label={`${user.isActive ? "Désactiver" : "Réactiver"} ${user.displayName}`} onClick={() => void onUpdate(user, { isActive: !user.isActive })}>{user.isActive ? <UserX size={15}/> : <UserCheck size={15}/>}</button>
      <button className="danger" type="button" disabled={pending || own || user.isActive} title={user.isActive ? "Désactivez le compte avant de le supprimer" : "Supprimer"} aria-label={`Supprimer ${user.displayName}`} onClick={() => void onRemove(user)}><Trash2 size={15}/></button>
    </div>
  </div>;
}

function EditUserModal({ user, oidcEnabled, pending, onClose, onSubmit }: {
  user: AuthUser;
  oidcEnabled: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { displayName: string; password?: string; authProvider: AuthProvider }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [password, setPassword] = useState("");
  const [authProvider, setAuthProvider] = useState(user.authProvider);
  return <div className="modal-backdrop" role="presentation">
    <form className="modal admin-create-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit({ displayName, authProvider, ...(password ? { password } : {}) }); }}>
      <header className="modal-header"><div><p className="eyebrow">Compte utilisateur</p><h2>Modifier {user.displayName}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">×</button></header>
      <div className="modal-body">
        <label><span>Nom affiché</span><input required minLength={2} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)}/></label>
        <label><span>Adresse e-mail</span><input value={user.email} disabled/></label>
        {oidcEnabled && <label><span>Méthode de connexion</span><select value={authProvider} onChange={(event) => setAuthProvider(event.target.value as AuthProvider)}><option value="local">Mot de passe local</option><option value="oidc">SSO uniquement</option><option value="both">SSO et mot de passe local</option></select><small>Le premier accès SSO ne sera lié qu’après cette autorisation explicite.</small></label>}
        {authProvider !== "oidc" && <label><span>Nouveau mot de passe {user.authProvider === "oidc" ? "(requis)" : "(facultatif)"}</span><input type="password" required={user.authProvider === "oidc"} minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)}/><small><KeyRound size={12}/> Si renseigné, toutes les sessions de ce compte seront fermées.</small></label>}
      </div>
      <footer className="modal-footer"><button type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={pending || (!password && displayName.trim() === user.displayName && authProvider === user.authProvider)}>{pending ? "Enregistrement…" : "Enregistrer"}</button></footer>
    </form>
  </div>;
}

function CreateUserModal({ draft, oidcEnabled, pending, onDraft, onClose, onSubmit }: {
  draft: typeof emptyDraft;
  oidcEnabled: boolean;
  pending: boolean;
  onDraft: (draft: typeof emptyDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}) {
  return <div className="modal-backdrop" role="presentation">
    <form className="modal admin-create-modal" onSubmit={onSubmit}>
      <header className="modal-header"><div><p className="eyebrow">Administration</p><h2>Créer un compte</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">×</button></header>
      <div className="modal-body">
        <label><span>Nom affiché</span><input required minLength={2} maxLength={100} value={draft.displayName} onChange={(event) => onDraft({ ...draft, displayName: event.target.value })}/></label>
        <label><span>Adresse e-mail</span><input type="email" required value={draft.email} onChange={(event) => onDraft({ ...draft, email: event.target.value })}/></label>
        {oidcEnabled && <label><span>Méthode de connexion</span><select value={draft.authProvider} onChange={(event) => onDraft({ ...draft, authProvider: event.target.value as AuthProvider, password: event.target.value === "oidc" ? "" : draft.password })}><option value="local">Mot de passe local</option><option value="oidc">SSO uniquement</option><option value="both">SSO et mot de passe local</option></select></label>}
        {draft.authProvider !== "oidc" && <label><span>Mot de passe initial</span><input type="password" required minLength={12} maxLength={128} value={draft.password} onChange={(event) => onDraft({ ...draft, password: event.target.value })}/><small>À transmettre par un canal sécurisé. L’utilisateur pourra le changer dans Mon compte.</small></label>}
        {draft.authProvider === "oidc" && <small>Le compte sera lié à l’identité SSO lors de sa première connexion avec cette adresse e-mail vérifiée.</small>}
        <label><span>Rôle</span><select value={draft.role} onChange={(event) => onDraft({ ...draft, role: event.target.value as UserRole })}><option value="member">Membre</option><option value="admin">Administrateur</option></select></label>
      </div>
      <footer className="modal-footer"><button type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={pending}>{pending ? "Création…" : "Créer le compte"}</button></footer>
    </form>
  </div>;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
const authProviderLabel = (provider: AuthProvider) => provider === "local" ? "Local" : provider === "oidc" ? "SSO" : "Local + SSO";
