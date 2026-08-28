# Desktop application

Scalengi Views uses Tauri 2 for macOS, Windows, and Linux. The native shell contains no business logic: it loads the same React component, view engines, and IndexedDB storage as the web application.

## Architecture

```text
app/ + library/
      │
      ├── vinext build         -> web application / Codespaces
      └── static Vite build    -> dist-desktop/ -> Tauri WebView
                                              ├── macOS DMG
                                              ├── Windows NSIS
                                              └── Linux AppImage / DEB
```

The desktop application starts no Node server and does not bundle Chromium. It uses WKWebView on macOS, WebView2 on Windows, and WebKitGTK on Linux.

## Local development

Additional requirements: stable Rust and the platform-specific Tauri system dependencies.

```bash
pnpm desktop:check
pnpm desktop:dev
pnpm desktop:build
```

`desktop:check` verifies that `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` contain exactly the same version, then builds the desktop frontend.

## Publishing a release

1. Choose the next version according to [`VERSIONING.md`](VERSIONING.md), then run `pnpm version:set <version>`.
2. Update `CHANGELOG.md` and validate `pnpm desktop:check`.
3. Merge and verify CI on `main`.
4. Create and push the corresponding tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The `Desktop release` workflow automatically builds and attaches installers to the GitHub Release.

## macOS signing and notarisation

An ad hoc build is produced when Apple secrets are absent. It supports testing, but macOS may still display an “unidentified developer” warning.

For a smooth public installation, configure the following under **GitHub → Settings → Secrets and variables → Actions**:

- `APPLE_CERTIFICATE`;
- `APPLE_CERTIFICATE_PASSWORD`;
- `APPLE_SIGNING_IDENTITY`;
- `APPLE_ID`;
- `APPLE_PASSWORD` with an app-specific password;
- `APPLE_TEAM_ID`.

These secrets enable Developer ID signing and notarisation without changing the code. Never add a certificate to the repository.

## Windows and Linux

The pipeline produces a Windows x64 NSIS installer and Linux x64 AppImage and DEB packages. Public documentation continues to mark them as “to be validated” until installation, local persistence, Excel import, and PNG/SVG export have been tested manually on each system.
