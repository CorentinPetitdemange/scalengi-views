# Authentication, SSO and account administration

Scalengi Views uses a dedicated Rust service for authentication. The React application consumes its HTTP contract; authentication rules and OIDC token validation are never implemented in JavaScript.

## Design

```text
browser / desktop shell
        │  same-origin /api (recommended)
        ▼
Rust service (Axum)
        ├── axum-login + tower-sessions (SQLite sessions)
        ├── password-auth (Argon2 password hashes)
        ├── openidconnect (OIDC discovery and token validation)
        ├── CSRF validation, Origin checks and login lockout
        └── local / OIDC / combined accounts and admin roles
        ▼
SQLite (users, OIDC identities, sessions and settings only)
```

View structures and imported business data are not sent to this service. They remain in IndexedDB, partitioned by authenticated user id.

The product behavior was informed by a functional review of Turbo EA: first-user bootstrap, closed registration by default, explicit roles, account deactivation, last-administrator safeguards, generic OIDC configuration and local fallback. No Turbo EA frontend component or backend code was copied.

The protocol and session primitives deliberately come from maintained crates instead of local implementations:

- `openidconnect` performs provider discovery, authorization-code exchange and ID-token signature/issuer/audience/expiry/nonce validation;
- `axum-login` manages the authenticated identity, session fixation protection and auth-hash invalidation;
- `tower-sessions` and `tower-sessions-sqlx-store` persist opaque server-side sessions;
- `password-auth` applies the RustCrypto password-hashing defaults.

## Local development

Run the Rust service and the application in separate terminals:

```bash
pnpm auth:dev
pnpm dev
```

The first local account becomes administrator. Public local registration is then closed unless an administrator enables it.

Checks:

```bash
pnpm auth:check
pnpm auth:test
```

## Base configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SCALENGI_AUTH_BIND` | `127.0.0.1:8787` | Rust listener address |
| `SCALENGI_AUTH_DATABASE_PATH` | `data/scalengi-auth.sqlite3` | SQLite file |
| `SCALENGI_AUTH_ALLOWED_ORIGINS` | local web and Tauri origins | Comma-separated CORS/origin allowlist |
| `SCALENGI_AUTH_COOKIE_SECURE` | `false` | Must be `true` behind production HTTPS |
| `SCALENGI_AUTH_SESSION_HOURS` | `8` | Inactivity lifetime, bounded from 1 to 168 hours |
| `RUST_LOG` | service info logs | Rust log filter |

## OIDC SSO configuration

OIDC is provider-neutral and works with standards-compliant services such as Microsoft Entra ID, Google Workspace, Okta, Keycloak, Auth0 and Authentik. Register this callback at the provider:

```text
https://views.example.com/api/auth/oidc/callback
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `SCALENGI_OIDC_ENABLED` | `false` | Enables OIDC discovery and the SSO interface |
| `SCALENGI_OIDC_ISSUER_URL` | required | Exact issuer URL from the provider |
| `SCALENGI_OIDC_CLIENT_ID` | required | Confidential web-client identifier |
| `SCALENGI_OIDC_CLIENT_SECRET` | required | Client secret; inject through a secret manager, never commit it |
| `SCALENGI_OIDC_REDIRECT_URL` | required | Exact callback URL registered at the provider |
| `SCALENGI_OIDC_PROVIDER_NAME` | `SSO d’entreprise` | Label displayed on the login screen |
| `SCALENGI_OIDC_ALLOWED_DOMAINS` | required by default | Comma-separated exact e-mail domains |
| `SCALENGI_OIDC_ALLOW_ANY_DOMAIN` | `false` | Explicitly disables the domain allowlist requirement |
| `SCALENGI_OIDC_JIT_PROVISIONING` | `false` | Creates member accounts after a validated first SSO login |
| `SCALENGI_OIDC_LOCAL_LOGIN_ENABLED` | `true` | Keeps local-password login available as an operational fallback |
| `SCALENGI_OIDC_REQUIRE_VERIFIED_EMAIL` | `true` | Rejects identities without `email_verified=true` |
| `SCALENGI_OIDC_BOOTSTRAP_ADMIN_EMAIL` | unset | Exact e-mail allowed to become the initial SSO administrator |
| `SCALENGI_OIDC_END_SESSION_URL` | unset | Optional provider logout URL opened after local logout |

Issuer, callback and logout endpoints must use HTTPS; HTTP is accepted only for `localhost` and loopback development. If local login is disabled, `SCALENGI_OIDC_BOOTSTRAP_ADMIN_EMAIL` is mandatory. When configured, that exact identity must bootstrap the first administrator before other JIT accounts can be created.

Some enterprise providers omit `email_verified`. Relaxing `SCALENGI_OIDC_REQUIRE_VERIFIED_EMAIL` is an explicit trust decision and should only be done after confirming the provider contract and tenant restriction.

Example (secrets omitted):

```bash
export SCALENGI_OIDC_ENABLED=true
export SCALENGI_OIDC_ISSUER_URL=https://login.example.com/realms/scalengi
export SCALENGI_OIDC_CLIENT_ID=scalengi-views
export SCALENGI_OIDC_CLIENT_SECRET='injected-by-secret-manager'
export SCALENGI_OIDC_REDIRECT_URL=https://views.example.com/api/auth/oidc/callback
export SCALENGI_OIDC_ALLOWED_DOMAINS=example.com
export SCALENGI_OIDC_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
```

## Account linking and provisioning

An OIDC identity is keyed by the immutable `(issuer, subject)` pair, never by the current e-mail alone.

- An administrator may create an `SSO` account in advance. Its first validated SSO login binds the identity to that account.
- An existing local account is never silently linked by matching e-mail. An administrator must first change its method to `Local + SSO` or `SSO`.
- JIT provisioning is off by default. When enabled, new validated identities become members, never administrators.
- Only the exact bootstrap e-mail may become the initial SSO administrator.
- Roles remain controlled in Scalengi Views; upstream group claims cannot silently grant administrator privileges.
- Disabled users remain denied even if the upstream provider authenticates them.
- Switching roles, status, password or authentication method invalidates existing sessions through the `axum-login` auth hash.

## OIDC security properties

The authorization flow is server-initiated and uses authorization code + PKCE (`S256`), cryptographically random `state`, and `nonce`. Pending flows are stored in the server-side session, expire after ten minutes and are consumed before validation or token exchange, preventing replay. Redirect targets are restricted to relative same-origin paths.

Provider metadata and keys are obtained through OIDC Discovery. The HTTP client refuses redirects to reduce SSRF exposure. The library validates the ID-token signature, issuer, audience, expiry and nonce. When the provider supplies an access-token hash, it is checked as well.

The session cookie is `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` in production. Secure deployments use the `__Host-` cookie prefix. Mutations additionally require the session-bound CSRF token and an allowed Origin.

## HTTP contract

Public endpoints:

- `GET /api/auth/bootstrap`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/oidc/config`
- `GET /api/auth/oidc/start`
- `GET /api/auth/oidc/callback`

Authenticated endpoints:

- `GET/PATCH /api/auth/me`
- `POST /api/auth/password`
- `POST /api/auth/logout`

Administrator endpoints:

- `GET/POST /api/admin/users`
- `PATCH/DELETE /api/admin/users/{id}`
- `GET/PATCH /api/admin/settings/registration`

## Deployment

Route `/api/` to the Rust service and all other paths to the web process on the same HTTPS origin. Set `SCALENGI_AUTH_COOKIE_SECURE=true`, persist the database directory, restrict filesystem permissions and back it up. Inject the OIDC client secret through the deployment platform’s secret mechanism.

The migration from the original custom session implementation to `tower-sessions` intentionally invalidates and removes legacy sessions. Existing users must sign in once after upgrading; accounts and password hashes are preserved.

For a separately hosted desktop service, define `window.__SCALENGI_CONFIG__.authApiUrl` before the application bundle runs. Production OIDC remains a browser-based redirect flow and its callback must be reachable at the configured HTTPS URL.

There is no password-reset-by-email flow: adding it safely requires an explicitly configured mail provider, single-use expiring tokens and operational recovery procedures. An administrator can create, deactivate, reactivate or reset another local account. The final active administrator cannot be demoted or disabled, and an administrator cannot perform those actions on their own account.
