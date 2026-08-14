# Contribuer à Scalengi Views

Merci de contribuer à Scalengi Views. Les contributions doivent rester alignées avec les frontières décrites dans [`AGENTS.md`](AGENTS.md) et [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Préparer l’environnement

Prérequis : Node.js 22.13 ou supérieur et pnpm 10.

```bash
git clone https://github.com/CorentinPetitdemange/scalengi-view.git
cd scalengi-view
pnpm install --frozen-lockfile
pnpm dev
```

## Workflow Git

1. Créer une branche depuis `main` : `feat/...`, `fix/...`, `docs/...`, `refactor/...` ou `chore/...`.
2. Faire des commits courts et explicites selon [Conventional Commits](https://www.conventionalcommits.org/) : `feat:`, `fix:`, `docs:`, `refactor:`, `test:` ou `chore:`.
3. Ne jamais forcer un push sur `main` et ne pas y pousser directement.
4. Ouvrir une pull request ciblée, expliquer la valeur produite et joindre une capture pour toute évolution visuelle.
5. Attendre la réussite de la CI et résoudre les conversations avant fusion.
6. Fusionner par **squash** puis supprimer la branche.

## Vérifications requises

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

Pour une modification visuelle, vérifier également la vue concernée en mode normal et plein écran, sans erreur dans la console du navigateur.

## Ajouter une vue

Suivre [`docs/CREATE_A_VIEW.md`](docs/CREATE_A_VIEW.md). Une vue doit être enregistrée uniquement via un `ViewDefinition` complet et ne doit introduire aucun branchement par identifiant dans le shell.

## Licence des contributions

En soumettant une contribution, vous acceptez qu’elle soit distribuée sous la [licence PolyForm Shield 1.0.0](LICENSE) du projet.
