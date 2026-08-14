# Scalengi Views — environnement de démonstration

Le Codespace télécharge l’image officielle de démonstration puis la démarre dans un conteneur Docker persistant. Une construction locale sert de secours si l’image est momentanément indisponible. Le script attend que le healthcheck confirme une vraie page HTML avant d’annoncer l’application prête. Le port **3000** doit alors s’ouvrir dans un nouvel onglet.

## Tester l’application

- Aucun compte ni mot de passe n’est nécessaire.
- Les vues et jeux de données d’exemple sont créés localement dans le navigateur.
- Les fichiers Excel importés restent dans le stockage local de ce navigateur.
- La première installation et le build prennent généralement quelques minutes ; les redémarrages suivants sont plus rapides.

Si l’onglet ne s’ouvre pas automatiquement, ouvrez le panneau **Ports** de VS Code puis cliquez sur l’icône globe du port `3000`.

## Commandes utiles

```bash
# Suivre le journal du conteneur
docker compose -f .devcontainer/compose.yaml logs -f

# Redémarrer l’application
docker compose -f .devcontainer/compose.yaml restart

# Voir son état et son healthcheck
docker compose -f .devcontainer/compose.yaml ps

# Vérifier le projet
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

Pensez à arrêter ou supprimer le Codespace après votre test afin de ne pas consommer inutilement votre quota GitHub Codespaces.
