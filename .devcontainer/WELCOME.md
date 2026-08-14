# Scalengi Views — environnement de démonstration

Le Codespace installe les dépendances puis démarre automatiquement l’application. Le port **3000** doit s’ouvrir dans un nouvel onglet dès que le serveur est prêt.

## Tester l’application

- Aucun compte ni mot de passe n’est nécessaire.
- Les vues et jeux de données d’exemple sont créés localement dans le navigateur.
- Les fichiers Excel importés restent dans le stockage local de ce navigateur.
- La première installation prend généralement quelques minutes ; les redémarrages suivants sont plus rapides.

Si l’onglet ne s’ouvre pas automatiquement, ouvrez le panneau **Ports** de VS Code puis cliquez sur l’icône globe du port `3000`.

## Commandes utiles

```bash
# Suivre le journal du serveur
tail -f .devcontainer/dev-server.log

# Relancer le serveur si nécessaire
bash .devcontainer/start-demo.sh

# Vérifier le projet
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

Pensez à arrêter ou supprimer le Codespace après votre test afin de ne pas consommer inutilement votre quota GitHub Codespaces.
