# Politique de sécurité

## Versions prises en charge

Tant qu’aucune version stable n’est publiée, seule la dernière version de la branche `main` reçoit les correctifs de sécurité.

## Signaler une vulnérabilité

Ne publiez pas de vulnérabilité dans une issue publique. Utilisez la fonctionnalité **Report a vulnerability** de l’onglet Security du dépôt GitHub afin d’ouvrir un avis de sécurité privé.

Le signalement doit idéalement contenir :

- la version ou le commit concerné ;
- les étapes minimales de reproduction ;
- l’impact estimé ;
- une proposition de correction, si elle existe.

Un accusé de réception sera donné dès que possible. La vulnérabilité et son correctif resteront privés jusqu’à ce qu’une publication coordonnée soit possible.

## Périmètre actuel

Scalengi Views fonctionne localement dans le navigateur. Les imports Excel, YAML et IndexedDB sont considérés comme non fiables. Aucun fichier métier ne doit être envoyé vers un serveur sans décision produit explicite.
