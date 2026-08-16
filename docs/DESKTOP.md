# Application desktop

Scalengi Views utilise Tauri 2 pour macOS, Windows et Linux. Le shell natif ne contient aucune logique métier : il charge le même composant React, les mêmes moteurs de vues et le même stockage IndexedDB que la version web.

## Architecture

```text
app/ + library/
      │
      ├── vinext build         -> application web / Codespaces
      └── Vite statique        -> dist-desktop/ -> WebView Tauri
                                              ├── DMG macOS
                                              ├── NSIS Windows
                                              └── AppImage / DEB Linux
```

La version desktop ne lance aucun serveur Node et n’embarque pas Chromium. Elle utilise WKWebView sur macOS, WebView2 sur Windows et WebKitGTK sur Linux.

## Développement local

Prérequis supplémentaires : Rust stable et les dépendances système Tauri de la plateforme.

```bash
pnpm desktop:check
pnpm desktop:dev
pnpm desktop:build
```

`desktop:check` vérifie que `package.json`, `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json` portent exactement la même version, puis construit le frontend desktop.

## Publier une version

1. Choisir la prochaine version selon [`VERSIONING.md`](VERSIONING.md), puis exécuter `pnpm version:set <version>`.
2. Compléter `CHANGELOG.md` et valider `pnpm desktop:check`.
3. Fusionner et vérifier la CI sur `main`.
4. Créer puis pousser le tag correspondant :

```bash
git tag v0.1.0-alpha.1
git push origin v0.1.0-alpha.1
```

Le workflow `Desktop release` construit et joint automatiquement les installateurs à la GitHub Release.

## Signature et notarisation macOS

Une compilation ad hoc est produite lorsque les secrets Apple sont absents. Elle permet les tests, mais macOS peut encore afficher l’avertissement « développeur non identifié ».

Pour une installation publique fluide, configurer dans **GitHub → Settings → Secrets and variables → Actions** :

- `APPLE_CERTIFICATE` ;
- `APPLE_CERTIFICATE_PASSWORD` ;
- `APPLE_SIGNING_IDENTITY` ;
- `APPLE_ID` ;
- `APPLE_PASSWORD` avec un mot de passe d’application Apple ;
- `APPLE_TEAM_ID`.

Ces secrets activent la signature Developer ID et la notarisation sans modifier le code. Aucun certificat ne doit être ajouté au dépôt.

## Windows et Linux

Le pipeline produit déjà un installateur NSIS Windows x64 ainsi que des paquets AppImage et DEB Linux x64. Ils restent indiqués « à valider » dans la documentation publique tant qu’un test manuel d’installation, de persistance locale, d’import Excel et d’export PNG/SVG n’a pas été effectué sur chaque système.
