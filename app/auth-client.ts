export type UserRole = "admin" | "member";
export type AuthProvider = "local" | "oidc" | "both";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  authProvider: AuthProvider;
  isActive: boolean;
  lastLoginAt: number | null;
  createdAt: number;
};

export type Session = { user: AuthUser; csrfToken: string };
export type OidcConfig = {
  enabled: boolean;
  providerName: string | null;
  localLoginEnabled: boolean;
  jitProvisioning: boolean;
  endSessionUrl: string | null;
};
export type BootstrapState = { hasAccounts: boolean; registrationEnabled: boolean; oidc: OidcConfig };
export type RegistrationSetting = { enabled: boolean };

type RuntimeConfig = { authApiUrl?: string };

declare global {
  interface Window { __SCALENGI_CONFIG__?: RuntimeConfig; }
}

let csrfToken: string | null = null;

function apiBase() {
  if (typeof window === "undefined") return "/api";
  const configured = window.__SCALENGI_CONFIG__?.authApiUrl?.trim().replace(/\/$/, "");
  if (configured) return configured.endsWith("/api") ? configured : `${configured}/api`;
  if (window.location.port === "1420" || window.location.protocol === "tauri:") return "http://127.0.0.1:8787/api";
  return "/api";
}

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (init.method && init.method !== "GET" && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`${apiBase()}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { code?: string; message?: string; field?: string } }).error
      : undefined;
    throw new ApiClientError(response.status, error?.code ?? "request_failed", error?.message ?? "La requête a échoué.", error?.field);
  }
  return payload as T;
}

function rememberSession(session: Session) {
  csrfToken = session.csrfToken;
  return session;
}

export const authApi = {
  bootstrap: () => request<BootstrapState>("/auth/bootstrap"),
  oidcConfig: () => request<OidcConfig>("/auth/oidc/config"),
  startOidc: (returnTo = "/") => {
    window.location.assign(`${apiBase()}/auth/oidc/start?returnTo=${encodeURIComponent(returnTo)}`);
  },
  session: async () => rememberSession(await request<Session>("/auth/me")),
  login: async (email: string, password: string) => rememberSession(await request<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })),
  register: async (displayName: string, email: string, password: string) => rememberSession(await request<Session>("/auth/register", { method: "POST", body: JSON.stringify({ displayName, email, password }) })),
  logout: async () => { await request<void>("/auth/logout", { method: "POST" }); csrfToken = null; },
  updateProfile: async (displayName: string) => rememberSession(await request<Session>("/auth/me", { method: "PATCH", body: JSON.stringify({ displayName }) })),
  changePassword: async (currentPassword: string, newPassword: string) => rememberSession(await request<Session>("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) })),
  listUsers: () => request<{ users: AuthUser[] }>("/admin/users"),
  createUser: (input: { displayName: string; email: string; password?: string; role: UserRole; authProvider: AuthProvider }) => request<AuthUser>("/admin/users", { method: "POST", body: JSON.stringify(input) }),
  updateUser: (id: string, input: { displayName?: string; password?: string; role?: UserRole; isActive?: boolean; authProvider?: AuthProvider }) => request<AuthUser>(`/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteUser: (id: string) => request<void>(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
  registration: () => request<RegistrationSetting>("/admin/settings/registration"),
  updateRegistration: (enabled: boolean) => request<RegistrationSetting>("/admin/settings/registration", { method: "PATCH", body: JSON.stringify({ enabled }) }),
};
