"use client";

import { useState, type FormEvent } from "react";
import { Building2, KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";
import { ApiClientError, authApi, type AuthUser, type Session } from "./auth-client";

export function AccountScreen({ user, onSessionChange }: { user: AuthUser; onSessionChange: (session: Session) => void }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (operation: () => Promise<Session>, success: string) => {
    setPending(true); setMessage(null); setError(null);
    try { const session = await operation(); onSessionChange(session); setMessage(success); }
    catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "La modification a échoué."); }
    finally { setPending(false); }
  };
  const saveProfile = (event: FormEvent) => { event.preventDefault(); void run(() => authApi.updateProfile(displayName), "Profil mis à jour."); };
  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setMessage(null); setError("Les nouveaux mots de passe ne correspondent pas."); return; }
    void run(() => authApi.changePassword(currentPassword, newPassword), "Mot de passe modifié et autres sessions fermées.").then(() => { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); });
  };

  return <div className="account-page">
    <div className="section-heading"><div><h2>Mon compte</h2><p>Identité, sécurité et session de votre espace Scalengi Views.</p></div><span className={`role-badge role-${user.role}`}><ShieldCheck size={14}/>{roleLabel(user.role)}</span></div>
    {(message || error) && <div className={error ? "account-feedback error" : "account-feedback"} role="status">{error ?? message}</div>}
    <div className="account-grid">
      <form className="account-card" onSubmit={saveProfile}><header><UserRound size={19}/><div><h3>Profil</h3><p>Informations affichées dans l’application.</p></div></header><div className="account-card-body"><label><span>Nom affiché</span><input required minLength={2} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)}/></label><label><span>Adresse e-mail</span><input value={user.email} disabled/><small>L’adresse e-mail identifie le compte et ne peut être changée ici.</small></label></div><footer><button className="primary-button" disabled={pending || displayName.trim() === user.displayName} type="submit"><Save size={15}/>Enregistrer</button></footer></form>
      {user.authProvider !== "oidc" ? <form className="account-card" onSubmit={savePassword}><header><KeyRound size={19}/><div><h3>Mot de passe</h3><p>La modification ferme toutes vos autres sessions.</p></div></header><div className="account-card-body"><label><span>Mot de passe actuel</span><input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}/></label><label><span>Nouveau mot de passe</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><small>12 caractères, majuscule, minuscule, chiffre et symbole.</small></label><label><span>Confirmer le mot de passe</span><input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label></div><footer><button className="primary-button" disabled={pending || !currentPassword || !newPassword || !confirmPassword} type="submit"><KeyRound size={15}/>Modifier</button></footer></form> : <section className="account-card"><header><Building2 size={19}/><div><h3>Compte géré par SSO</h3><p>L’identité et l’accès sont contrôlés par votre fournisseur d’entreprise.</p></div></header><div className="account-card-body"><p className="account-sso-note">Le mot de passe n’est ni créé ni stocké par Scalengi Views. Modifiez vos informations de connexion auprès de votre fournisseur d’identité.</p></div></section>}
    </div>
  </div>;
}

export const roleLabel = (role: AuthUser["role"]) => role === "admin" ? "Administrateur" : "Membre";
