# Installation profiles

Scalengi Views offers two explicit first-start profiles. The selected profile is persisted in SQLite and cannot be changed later, which prevents a demonstration seed from being enabled accidentally on a real installation.

## Standard

`standard` is the default and the production-safe profile:

- no account is pre-created;
- the first local account becomes administrator;
- no view or business dataset is created;
- users can still create a view and explicitly activate the bounded example embedded in its YAML configuration.

```bash
SCALENGI_INSTALLATION_PROFILE=standard cargo run --manifest-path server/Cargo.toml
```

## Demo

`demo` is intended for evaluation environments. On the first startup only, the Rust service creates one local administrator with the existing Argon2id password pipeline. After that administrator signs in, the browser atomically creates the built-in demonstration views and datasets in the administrator's local IndexedDB.

The password is never bundled, logged, returned by the API, or stored in clear text. Supply it explicitly through a secret file whenever possible:

```bash
umask 077
printf '%s' 'choose-a-strong-unique-password' > /run/secrets/scalengi-demo-password

export SCALENGI_INSTALLATION_PROFILE=demo
export SCALENGI_DEMO_ADMIN_EMAIL=admin@example.com
export SCALENGI_DEMO_ADMIN_DISPLAY_NAME='Administrateur démo'
export SCALENGI_DEMO_ADMIN_PASSWORD_FILE=/run/secrets/scalengi-demo-password
cargo run --manifest-path server/Cargo.toml
```

`SCALENGI_DEMO_ADMIN_PASSWORD` is also accepted for simple local or Compose installations, but a mounted secret file is preferable because environment variables can be exposed by process and deployment tooling.

The account password must follow the normal policy: 12–128 characters with uppercase, lowercase, number and symbol, and it must not contain the e-mail local part. Demo mode is rejected when local login is disabled.

## One-shot behavior

The server persists the installation profile before serving requests. The browser keeps a separate durable catalogue marker in the same IndexedDB database as the views. Consequently:

- restarting never resets the administrator password;
- deleting a demonstration view does not recreate it;
- clearing only the catalogue does not silently restore the demo;
- clearing the entire local IndexedDB database is treated as a new browser-local workspace;
- existing installations are adopted as `standard` and are never seeded;
- switching an initialized installation between `standard` and `demo` is rejected.

Business datasets remain browser-local in both profiles. The Rust service stores only identities, sessions, authentication settings, and the immutable installation profile.

## Platform module

The module host uses the same behavior without duplicating view logic:

```tsx
<ScalengiViewsApp
  host={{
    session: { user: platformUser },
    installationProfile: "demo", // "standard" by default
  }}
/>
```

The platform remains responsible for creating and protecting its administrator account. The module receives only the non-secret profile and the authenticated user.
