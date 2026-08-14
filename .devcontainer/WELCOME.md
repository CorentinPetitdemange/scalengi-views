# Scalengi Views — environnement de démonstration

Le Codespace installe les dépendances, construit la version de démonstration puis démarre automatiquement l’application. L’environnement attend que la page soit réellement disponible avant d’être déclaré prêt. Le port **3000** doit alors s’ouvrir dans un nouvel onglet.

## Tester l’application

- Aucun compte ni mot de passe n’est nécessaire.
- Les vues et jeux de données d’exemple sont créés localement dans le navigateur.
- Les fichiers Excel importés restent dans le stockage local de ce navigateur.
- La première installation et le build prennent généralement quelques minutes ; les redémarrages suivants sont plus rapides.

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
