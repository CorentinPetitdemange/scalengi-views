"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { ApiClientError, authApi, type BootstrapState, type Session } from "./auth-client";

export function AuthScreen({ bootstrap, onAuthenticated }: { bootstrap: BootstrapState; onAuthenticated: (session: Session) => void }) {
  const firstAccount = !bootstrap.hasAccounts;
  const [mode, setMode] = useState<"login" | "register">(firstAccount ? "register" : "login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canRegister = firstAccount || bootstrap.registrationEnabled;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const session = mode === "login" ? await authApi.login(email, password) : await authApi.register(displayName, email, password);
      onAuthenticated(session);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Le service d’authentification est indisponible.");
    } finally {
      setPending(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-brand-panel">
      <div className="auth-brand"><span className="auth-brand-mark"/><span>Scalengi Views</span></div>
      <div className="auth-brand-message">
        <span className="auth-eyebrow"><ShieldCheck size={15}/> Espace protégé</span>
        <h1>Les décisions d’architecture commencent dans un espace de confiance.</h1>
        <p>Vos vues restent sur cet appareil. Votre compte contrôle qui peut ouvrir l’application et administrer les accès.</p>
      </div>
      <div className="auth-security-note"><LockKeyhole size={18}/><div><strong>Session sécurisée</strong><span>Cookie inaccessible au navigateur, protection CSRF et mots de passe Argon2id.</span></div></div>
    </section>
    <section className="auth-form-panel">
      <div className="auth-form-card">
        <header>
          <span className="auth-form-icon"><KeyRound size={21}/></span>
          <div><p>{firstAccount ? "Initialisation" : "Accès à l’espace"}</p><h2>{mode === "login" ? "Bon retour" : firstAccount ? "Créer le compte administrateur" : "Créer votre compte"}</h2></div>
        </header>
        {!firstAccount && canRegister && <div className="auth-mode-switch" role="tablist" aria-label="Mode d’authentification">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null); }}>Connexion</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(null); }}>Créer un compte</button>
        </div>}
        <form onSubmit={submit}>
          {mode === "register" && <label><span>Nom affiché</span><input autoComplete="name" required minLength={2} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Camille Martin" autoFocus/></label>}
          <label><span>Adresse e-mail</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="camille@entreprise.fr" autoFocus={mode === "login"}/></label>
          <label><span>Mot de passe</span><div className="auth-password-field"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "12 caractères minimum" : "Votre mot de passe"}/><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
          {mode === "register" && <p className="auth-password-help">12 caractères, avec majuscule, minuscule, chiffre et symbole.</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Vérification…" : mode === "login" ? "Se connecter" : "Créer le compte"}<ArrowRight size={17}/></button>
        </form>
        {firstAccount && <footer>Ce premier compte recevra le rôle administrateur. Les inscriptions suivantes seront fermées par défaut.</footer>}
      </div>
    </section>
  </main>;
}
