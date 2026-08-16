# Maintenance du dépôt

## Rôle de `main`

`main` contient toujours une version complète, testée et publiable de Scalengi Views. Il n’existe pas de branche `develop` permanente : les changements vivent dans des branches courtes puis sont intégrés par pull request.

Une fusion dans `main` ne crée pas automatiquement une release. Une publication est un acte explicite matérialisé par un tag SemVer créé par le mainteneur, par exemple `v0.1.0-alpha.2`. Le workflow de release refuse un tag dont le commit n’appartient pas à `main`.

## Cycle d’un changement

1. Créer une issue pour les contributions communautaires et obtenir le label `status: accepted`.
2. Créer une branche courte : `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `test/…` ou `chore/…`.
3. Ouvrir une pull request vers `main`.
4. Attendre la CI `Quality`, résoudre les conversations et effectuer la vérification visuelle si nécessaire.
5. Le mainteneur fusionne par **squash**.
6. GitHub supprime automatiquement la branche fusionnée.

Les push directs et forcés sur `main` sont interdits. La branche impose un historique linéaire, une CI à jour et la résolution des conversations, y compris pour le mainteneur.

## Versions et releases

Le cycle détaillé se trouve dans [`VERSIONING.md`](VERSIONING.md). En résumé :

```bash
pnpm version:set 0.1.0-alpha.2
pnpm version:check
```

Après fusion de la préparation de version dans `main`, le mainteneur crée le tag exact `v<version>`. GitHub Actions construit alors les installateurs et crée la GitHub Release correspondante. Un tag ou une release déjà publié n’est jamais déplacé ni remplacé.

## Dépendances

Dependabot vérifie les dépendances npm une fois par mois et les regroupe dans une seule pull request. Les GitHub Actions sont regroupées dans une autre PR mensuelle. Chaque lot suit les mêmes contrôles que le code produit ; aucune mise à jour n’est fusionnée uniquement parce qu’elle est automatisée.

Les mises à jour majeures ou les lots trop larges peuvent être fermés puis repris manuellement en groupes cohérents. Les alertes de sécurité sont traitées séparément et en priorité.

## Nettoyage

- une branche fusionnée est supprimée automatiquement ;
- une branche associée à une PR fermée est supprimée lors de la fermeture ;
- une branche sans PR ni activité utile est supprimée après vérification de son contenu ;
- les branches `main` et celles d’une PR active ne sont jamais supprimées ;
- les artefacts générés, secrets et données métier ne sont jamais commités.
