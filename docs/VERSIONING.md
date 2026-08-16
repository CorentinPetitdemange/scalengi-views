# Gestion des versions

Scalengi Views suit [Semantic Versioning](https://semver.org/) avec un canal de préversion explicite.

## Canaux

- `0.1.0-alpha.1` : développement actif, contrat et données encore susceptibles d’évoluer ;
- `0.1.0-beta.1` : périmètre fonctionnel stabilisé, validation élargie ;
- `0.1.0-rc.1` : candidat à la publication stable, uniquement des corrections bloquantes ;
- `0.1.0` : version stable.

Un incrément après le suffixe publie une nouvelle itération du même canal. Une évolution incompatible incrémente la version majeure après la première version stable.

## Source unique et contrôle

La version est exposée dans l’application et doit rester identique dans `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` et le paquet local de `src-tauri/Cargo.lock`.

```bash
pnpm version:check
pnpm version:set 0.1.0-alpha.2
```

`version:set` refuse les formats non pris en charge et les retours en arrière. `version:check` bloque la CI et les releases en cas de divergence.

## Publication

1. Préparer la version avec `pnpm version:set <version>`.
2. Décrire les changements dans `CHANGELOG.md`.
3. Valider `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` et `pnpm desktop:check`.
4. Fusionner sur `main`.
5. Créer et pousser le tag exact `v<version>`.

Le workflow GitHub construit alors les installateurs et publie la GitHub Release. Les tags comportant un suffixe sont automatiquement marqués comme préversions ; les tags stables sont publiés comme releases normales. Le lien `/releases/latest` du README reste volontairement orienté vers la dernière version stable. Pendant l’alpha, le bouton macOS cible donc la page générale des releases afin de rendre les préversions visibles.

Une release et son tag publiés ne sont jamais remplacés. Une correction produit toujours une nouvelle version.
