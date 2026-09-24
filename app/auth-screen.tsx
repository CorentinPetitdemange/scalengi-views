"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2, Eye, EyeOff, GalleryVerticalEnd, KeyRound, Layers3, Route } from "lucide-react";
import { ApiClientError, authApi, type BootstrapState, type Session } from "./auth-client";

export function AuthScreen({ bootstrap, onAuthenticated }: { bootstrap: BootstrapState; onAuthenticated: (session: Session) => void }) {
  const firstAccount = !bootstrap.hasAccounts;
  const localEnabled = bootstrap.oidc.localLoginEnabled;
  const [mode, setMode] = useState<"login" | "register">(firstAccount && localEnabled ? "register" : "login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canRegister = firstAccount || bootstrap.registrationEnabled;

  useEffect(() => {
    const url = new URL(window.location.href);
    const ssoError = url.searchParams.get("ssoError");
    if (ssoError) {
      queueMicrotask(() => setError("La connexion SSO n’a pas pu être validée. Réessayez ou contactez un administrateur."));
      url.searchParams.delete("ssoError");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

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
        <span className="auth-eyebrow"><GalleryVerticalEnd size={15}/> Décider avec une vue claire</span>
        <h1>Transformez vos données d’architecture en décisions lisibles.</h1>
        <p>Scalengi Views réunit structure, données et représentation pour expliquer un système d’information, révéler les écarts et partager une trajectoire compréhensible.</p>
      </div>
      <div className="auth-value-list">
        <span><Layers3 size={17}/><strong>Structurer</strong><small>Organisez capacités, couches, acteurs et transformations.</small></span>
        <span><GalleryVerticalEnd size={17}/><strong>Visualiser</strong><small>Choisissez une vue adaptée à la décision à prendre.</small></span>
        <span><Route size={17}/><strong>Aligner</strong><small>Rendez les constats et trajectoires partageables.</small></span>
      </div>
    </section>
    <section className="auth-form-panel">
      <div className="auth-form-card">
        <header>
          <span className="auth-form-icon"><KeyRound size={21}/></span>
          <div><p>{firstAccount ? "Initialisation" : "Accès à l’espace"}</p><h2>{mode === "login" ? "Bon retour" : firstAccount ? "Créer le compte administrateur" : "Créer votre compte"}</h2></div>
        </header>
        {localEnabled && !firstAccount && canRegister && <div className="auth-mode-switch" role="tablist" aria-label="Mode d’authentification">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null); }}>Connexion</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(null); }}>Créer un compte</button>
        </div>}
        {bootstrap.oidc.enabled && <button className="auth-sso-button" type="button" onClick={() => authApi.startOidc("/")}><Building2 size={17}/><span>Continuer avec {bootstrap.oidc.providerName ?? "le SSO"}</span><ArrowRight size={16}/></button>}
        {bootstrap.oidc.enabled && localEnabled && <div className="auth-divider"><span>ou</span></div>}
        {localEnabled && <form onSubmit={submit}>
          {mode === "register" && <label><span>Nom affiché</span><input autoComplete="name" required minLength={2} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Camille Martin" autoFocus/></label>}
          <label><span>Adresse e-mail</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="camille@entreprise.fr" autoFocus={mode === "login"}/></label>
          <label><span>Mot de passe</span><div className="auth-password-field"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "12 caractères minimum" : "Votre mot de passe"}/><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
          {mode === "register" && <p className="auth-password-help">12 caractères, avec majuscule, minuscule, chiffre et symbole.</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Vérification…" : mode === "login" ? "Se connecter" : "Créer le compte"}<ArrowRight size={17}/></button>
        </form>}
        {firstAccount && localEnabled && <footer>Ce premier compte local recevra le rôle administrateur. Les inscriptions suivantes seront fermées par défaut.</footer>}
        {firstAccount && !localEnabled && <footer>Le premier administrateur SSO doit correspondre exactement à l’adresse configurée côté serveur.</footer>}
      </div>
    </section>
  </main>;
}
