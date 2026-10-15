# Refresh token — V2

Analyse et proposition du 15 octobre 2026, après lecture complémentaire des sources locales. La V1 est conservée.

- [Analyse du code et diagnostic](analyse-refresh-token.md) : faits vérifiés, nouveaux défauts, limites du dépôt et hypothèses restantes.
- [Proposition de solution](proposition-solution.md) : coordinateur partagé, génération de session, stockage, mapping des erreurs, reconnexion et ordre d'intégration.
- [Noyau Kotlin proposé](code-propose/LowPrivilegeRefreshCoordinator.kt) : implémentation de référence autonome, à adapter au projet.
- [Tests et validation](tests-et-validation.md) : scénarios déterministes, intégration, UI et BrowserStack.

**Décision recommandée :** une tentative de refresh partagée par session, avec rejet des réponses obsolètes et reconnexion bas privilège centralisée. Ne pas conserver le refresh token d'une ancienne session lors d'une nouvelle connexion.

**Statut :** documents et code de référence uniquement. Aucun fichier applicatif modifié. Code Kotlin non compilé, tests non exécutés. La cause exacte du 403 et la configuration Auth0 restent à confirmer ; les défauts locaux recensés justifient néanmoins un correctif.
