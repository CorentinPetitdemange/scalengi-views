# Authentication and account administration

Scalengi Views uses a dedicated Rust service for authentication. The React application only consumes its HTTP contract; no authentication rule is implemented in a JavaScript server.

## Design

```text
browser / desktop shell
        │  same-origin /api (recommended)
        ▼
Rust service (Axum)
        ├── Argon2id password hashes
        ├── opaque server-side sessions
        ├── CSRF validation and Origin checks
        ├── account lockout
        └── admin authorization
        ▼
SQLite (users, sessions, settings only)
```

View structures and imported business data are not sent to this service. They remain in IndexedDB and are partitioned by the authenticated user id. The first account used on an existing browser retains the legacy local database; later accounts receive separate databases.

The design was informed by a functional review of Turbo EA: first-user bootstrap, closed registration by default, explicit roles, account deactivation, and last-administrator safeguards were useful product patterns. No Turbo EA frontend component or backend implementation was copied. Turbo EA's FSL-1.1-MIT license was treated as an additional reason to keep an independent implementation.

## Local development

Requirements are Node.js 22.13 or later, pnpm 10, and stable Rust.

Run the two processes in separate terminals:

```bash
pnpm auth:dev
pnpm dev
```

The web development server proxies `/api` to `127.0.0.1:8787`. The first account created becomes the administrator. Public registration is disabled immediately after this bootstrap account unless an administrator enables it again.

The Rust checks are:

```bash
pnpm auth:check
pnpm auth:test
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SCALENGI_AUTH_BIND` | `127.0.0.1:8787` | Rust listener address |
| `SCALENGI_AUTH_DATABASE_PATH` | `data/scalengi-auth.sqlite3` | SQLite file |
| `SCALENGI_AUTH_ALLOWED_ORIGINS` | local web and Tauri origins | Comma-separated CORS/origin allowlist |
| `SCALENGI_AUTH_COOKIE_SECURE` | `false` | Must be `true` behind production HTTPS |
| `SCALENGI_AUTH_SESSION_HOURS` | `8` | Session lifetime, bounded from 1 to 168 hours |
| `RUST_LOG` | service info logs | Rust log filter |

For a separately hosted desktop service, define `window.__SCALENGI_CONFIG__.authApiUrl` before the application bundle runs. The value may be an origin (`https://views.example.com`) or a complete API base (`https://views.example.com/api`). Local desktop development uses `http://127.0.0.1:8787/api` automatically.

## HTTP contract

Public endpoints:

- `GET /api/auth/bootstrap`
- `POST /api/auth/register`
- `POST /api/auth/login`

Authenticated endpoints:

- `GET/PATCH /api/auth/me`
- `POST /api/auth/password`
- `POST /api/auth/logout`

Administrator endpoints:

- `GET/POST /api/admin/users`
- `PATCH/DELETE /api/admin/users/{id}`
- `GET/PATCH /api/admin/settings/registration`

Mutations require both the session cookie and the `X-CSRF-Token` returned with the current session. The session token itself is random, stored only in an `HttpOnly` cookie, and represented by a SHA-256 hash in the database.

## Deployment

Route `/api/` to the Rust service and all other paths to the web process on the same HTTPS origin. Set `SCALENGI_AUTH_COOKIE_SECURE=true`, persist the database directory, restrict filesystem permissions, and back it up.

The repository container image follows this layout internally: nginx listens on port 3000, proxies `/api` to the Rust process, and proxies the application to the Node process. The Compose volume `scalengi-views-auth` persists accounts and sessions.

There is deliberately no password-reset-by-email flow in this first version: adding it safely requires an explicitly configured mail provider, single-use expiring tokens, and operational recovery procedures. An administrator can create, deactivate, reactivate, or reset another account's password. The final active administrator cannot be demoted or disabled, and an administrator cannot perform those actions on their own account.
