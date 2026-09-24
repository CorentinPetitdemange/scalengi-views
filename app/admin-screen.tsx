"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { ApiClientError, authApi, type AuthUser, type UserRole } from "./auth-client";

const emptyDraft = { displayName: "", email: "", password: "", role: "member" as UserRole };

export function AdminScreen({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([authApi.listUsers(), authApi.registration()])
      .then(([userResponse, registration]) => {
        if (!cancelled) {
          setUsers(userResponse.users);
          setRegistrationEnabled(registration.enabled);
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

  const update = async (user: AuthUser, changes: { role?: UserRole; isActive?: boolean }) => {
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

  const saveAccount = async (input: { displayName: string; password?: string }) => {
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
      <CreateUserModal draft={draft} pending={pendingId === "create"} onDraft={setDraft} onClose={() => setCreating(false)} onSubmit={create} />
    )}
    {editing && (
      <EditUserModal user={editing} pending={pendingId === editing.id} onClose={() => setEditing(null)} onSubmit={saveAccount} />
    )}
  </div>;
}
function UserRow({ user, own, pending, onUpdate, onEdit, onRemove }: {
  user: AuthUser;
  own: boolean;
  pending: boolean;
  onUpdate: (user: AuthUser, changes: { role?: UserRole; isActive?: boolean }) => Promise<void>;
  onEdit: (user: AuthUser) => void;
  onRemove: (user: AuthUser) => Promise<void>;
}) {
  return <div className="admin-user-row" role="row">
    <div className="admin-user-identity">
      <span className="user-avatar">{initials(user.displayName)}</span>
      <span><strong>{user.displayName}{own && <em>Vous</em>}</strong><small>{user.email}</small></span>
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

function EditUserModal({ user, pending, onClose, onSubmit }: {
  user: AuthUser;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { displayName: string; password?: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [password, setPassword] = useState("");
  return <div className="modal-backdrop" role="presentation">
    <form className="modal admin-create-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit({ displayName, ...(password ? { password } : {}) }); }}>
      <header className="modal-header"><div><p className="eyebrow">Compte utilisateur</p><h2>Modifier {user.displayName}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">×</button></header>
      <div className="modal-body">
        <label><span>Nom affiché</span><input required minLength={2} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)}/></label>
        <label><span>Adresse e-mail</span><input value={user.email} disabled/></label>
        <label><span>Nouveau mot de passe (facultatif)</span><input type="password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)}/><small><KeyRound size={12}/> Si renseigné, toutes les sessions de ce compte seront fermées.</small></label>
      </div>
      <footer className="modal-footer"><button type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={pending || (!password && displayName.trim() === user.displayName)}>{pending ? "Enregistrement…" : "Enregistrer"}</button></footer>
    </form>
  </div>;
}

function CreateUserModal({ draft, pending, onDraft, onClose, onSubmit }: {
  draft: typeof emptyDraft;
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
        <label><span>Mot de passe initial</span><input type="password" required minLength={12} maxLength={128} value={draft.password} onChange={(event) => onDraft({ ...draft, password: event.target.value })}/><small>À transmettre par un canal sécurisé. L’utilisateur pourra le changer dans Mon compte.</small></label>
        <label><span>Rôle</span><select value={draft.role} onChange={(event) => onDraft({ ...draft, role: event.target.value as UserRole })}><option value="member">Membre</option><option value="admin">Administrateur</option></select></label>
      </div>
      <footer className="modal-footer"><button type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={pending}>{pending ? "Création…" : "Créer le compte"}</button></footer>
    </form>
  </div>;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
