# Contribuer à Scalengi Views

Merci de contribuer à Scalengi Views. Les contributions doivent rester alignées avec les frontières décrites dans [`AGENTS.md`](AGENTS.md) et [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Validation d’une contribution

Toute contribution communautaire commence par une issue. Le mainteneur examine la proposition, peut demander des précisions et indique son accord avec le label **`status: accepted`**. N’engagez pas l’implémentation et n’ouvrez pas de pull request avant cette validation.

Les vulnérabilités suivent exclusivement la procédure privée décrite dans [`SECURITY.md`](SECURITY.md) et ne doivent jamais être publiées dans une issue.

## Préparer l’environnement

Prérequis : Node.js 22.13 ou supérieur et pnpm 10.

```bash
git clone https://github.com/VOTRE-COMPTE/scalengi-view.git
cd scalengi-view
git remote add upstream https://github.com/CorentinPetitdemange/scalengi-view.git
pnpm install --frozen-lockfile
pnpm dev
```

Créez d’abord un fork depuis GitHub, puis remplacez `VOTRE-COMPTE` par votre identifiant.

## Workflow Git

1. Créer une issue et attendre sa validation avec le label `status: accepted`.
2. Mettre à jour votre fork depuis `upstream/main`.
3. Créer une branche dans votre fork : `feat/...`, `fix/...`, `docs/...`, `refactor/...` ou `chore/...`.
4. Faire des commits courts et explicites selon [Conventional Commits](https://www.conventionalcommits.org/) : `feat:`, `fix:`, `docs:`, `refactor:`, `test:` ou `chore:`.
5. Pousser cette branche vers votre fork, jamais vers `main`.
6. Ouvrir une pull request ciblée, référencer l’issue validée, expliquer la valeur produite et joindre une capture pour toute évolution visuelle.
7. Attendre la réussite de la CI, la revue du mainteneur et la résolution des conversations.
8. Le mainteneur décide de la fusion, effectuée par **squash**, et supprime la branche si nécessaire.

Les contributeurs ne poussent jamais directement sur `main` et n’y effectuent aucun force-push. Seul le mainteneur du dépôt peut exceptionnellement pousser directement sur `main` ou fusionner une pull request.

## Vérifications requises

```bash
pnpm exec tsc --noEmit
pnpm version:check
pnpm lint
pnpm test
```

Pour une modification visuelle, vérifier également la vue concernée en mode normal et plein écran, sans erreur dans la console du navigateur.

## Ajouter une vue

Suivre [`docs/CREATE_A_VIEW.md`](docs/CREATE_A_VIEW.md). Une vue doit être enregistrée uniquement via un `ViewDefinition` complet et ne doit introduire aucun branchement par identifiant dans le shell.

## Licence des contributions

En soumettant une contribution, vous acceptez qu’elle soit distribuée sous la [licence MIT](LICENSE) du projet.
