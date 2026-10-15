# Refresh token — proposition V2

Date : 15 octobre 2026. Proposition d'architecture et noyau Kotlin de référence. Aucun changement dans `shared`, `androidApp` ou `iosApp`. Le noyau n'est pas un remplacement prêt à compiler du repository : les adaptateurs vers le projet et les contrats de stockage/DI doivent être intégrés sur la branche complète.

## 1. Décision technique

Je recommande un coordinateur unique bas privilège, partagé par tous les consommateurs d'une même session. Il possède l'état de session et la tentative de refresh en cours. Les écrans attendent le même résultat ; ils ne démarrent pas chacun un échange réseau. Chaque nouvelle connexion, déconnexion ou changement de tenant change la génération de session. Une réponse d'une génération précédente est ignorée.

Cette solution garde le refresh forcé des deux écrans, car il actualise l'email. Elle couvre aussi le cas où le serveur ne change pas la valeur du refresh token. Elle ne repose ni sur un délai arbitraire entre deux appels, ni sur une comparaison R1/R2.

## 2. Garanties et limites

1. Une seule tentative en cours par génération de session ; les appelants qui la rejoignent partagent succès ou échec.
2. Aucun échange de refresh avec une chaîne vide ou blanche.
3. Aucun résultat de S1 ne peut écrire dans S2, ni restaurer une session effacée.
4. Le couple access/refresh et l'email appartiennent au même snapshot logique.
5. Une fermeture d'écran n'annule pas l'opération déjà partie ; son résultat peut encore être enregistré pour les autres écrans.
6. Un refus OAuth définitif supprime la possibilité de renouveler la session ; pas de répétition avec le même jeton à chaque ouverture d'écran.
7. Une nouvelle connexion sans refresh token n'hérite jamais du refresh token précédent.
8. Les résultats transportent leur génération pour éviter qu'une ancienne erreur déclenche une reconnexion pendant une nouvelle session.

Deux appels successifs, dont le second commence après la fin de la tentative, peuvent chacun forcer un refresh. C'est voulu pour actualiser le profil. « Une tentative partagée » n'est pas un cache temporel de tous les refresh.

L'arrêt du processus ou une perte réseau après consommation du refresh peuvent toujours empêcher l'enregistrement de la réponse. Aucun Mutex local n'offre une transaction distribuée avec Auth0. La stratégie de récupération doit être explicite.

## 3. Code de référence fourni

Voir [LowPrivilegeRefreshCoordinator.kt](code-propose/LowPrivilegeRefreshCoordinator.kt). Le fichier contient les nouveaux types et l'algorithme complet du coordinateur : `beginLogin`, `completeLogin`, `clearSession`, `refresh(force)`, génération, partage d'un `Deferred`, écriture du snapshot et rejet des réponses anciennes.

Ce noyau utilise volontairement un état mémoire explicite. Ce choix ne prouve pas que le stockage actuel est mémoire. Il rend l'algorithme inspectable sans inventer les parties manquantes de `StorageReadWriteProperty`.

### Pourquoi ces mécanismes

| Choix | Pourquoi |
| --- | --- |
| Mutex de courte durée | Protège la création d'une tentative et la publication de son résultat ; le réseau se fait hors verrou. Une déconnexion n'attend pas le réseau. |
| `Deferred` partagé dans un scope applicatif | Tous les demandeurs de la tentative reçoivent le même résultat. L'annulation d'un ViewModel ne perd pas R2. |
| Génération de session | Invalide les anciens résultats, même si le transport termine après un logout ou après la connexion suivante. |
| Identifiant de tentative distinct de la génération | Le `finally` d'une ancienne tentative ne peut pas supprimer la référence de la nouvelle. |
| Endpoint figé dans la session | URL, client et tenant ne changent pas au milieu d'un refresh. |
| Résultat `SESSION_CHANGED` | Une opération devenue obsolète ne doit pas afficher un problème technique ou déclencher une navigation sur la nouvelle session. |
| Snapshot avec access, refresh, email et expiration | Les lecteurs ne voient pas un access de S2 avec le refresh de S1. |

L'instance du coordinateur doit être singleton dans le conteneur de session/app. Ne pas créer un coordinateur par ViewModel. Le scope doit être injecté, supervisé et fermé à l'arrêt de son propriétaire, pas à la destruction d'un écran.

## 4. Adaptation au repository existant

### 4.1 API publique

Conserver les noms utiles, mais faire déléguer les deux entrées au même coordinateur :

- `refreshAccessToken()` → `refresh(force = true)` ;
- `getOrRefreshAccessToken()` → `refresh(force = false)` ;
- `clearTokens()` → invalidation du coordinateur puis nettoyage du stockage historique via le propriétaire de session ;
- `fetchTokens(...)` → échange associé au ticket de connexion créé en amont, puis `completeLogin(ticket, validatedTokens)`. Le ticket est consommé une seule fois pour empêcher un redirect dupliqué de réinstaller les anciens jetons.

Ne pas réduire immédiatement `Outcome` à l'enum actuel : cela perdrait la génération et `SESSION_CHANGED`. Introduire un résultat métier équivalent dans le package de production, puis migrer les deux ViewModels et `AuthSessionManager`.

Supprimer ou rendre privées les écritures `setAccessToken` et `setRefreshToken`. La recherche locale ne trouve que leurs usages internes au repository ; refaire la recherche sur le checkout complet avant de modifier la visibilité.

### 4.2 Préparer la réponse avant publication

L'adaptateur HTTP transforme le `TokenResponse` en `SessionTokens` après avoir :

1. vérifié que l'access token n'est pas blanc ;
2. utilisé `parseAccessToken` et refusé un parsing nul ;
3. vérifié l'expiration et les claims de marque/email avec la logique existante, pour le tenant capturé dans le ticket/session ;
4. extrait l'email et l'expiration du même JWT ;
5. appliqué la politique de refresh appropriée à l'opération.

Pour un renouvellement de S1 : `response.refreshToken?.takeIf { it.isNotBlank() } ?: previousRefresh`. Cette conservation n'est autorisée que selon le contrat de rotation du client ; si un nouveau jeton est obligatoire et absent, considérer la réponse comme inexploitable et demander une reconnexion.

Pour une nouvelle connexion S2 : `response.refreshToken?.takeIf { it.isNotBlank() }`. Ne jamais faire de fallback vers S1. Une session sans refresh peut éventuellement utiliser son access token jusqu'à l'expiration si le produit l'accepte ; un refresh forcé demandera alors la reconnexion. Pour ce produit, qui force le refresh avant OCS, valider le contrat d'obtention du refresh à la connexion est indispensable.

Si une réponse 200 est inexploitable après une rotation possible, retourner `Indeterminate`, pas un succès ni un retry automatique du jeton précédent.

### 4.3 Configurer une requête stable

La façade actuelle relit `giaRepository.getAccessTokenUrl` et `getClientId` à chaque appel. Ajouter une surcharge prenant un contexte immuable de session, puis appeler `TokenHttpService.refreshTokens(url, clientId, refreshToken)` avec ces valeurs.

Le changement de réseau/marque doit invalider la session avant d'autoriser des échanges avec la nouvelle configuration. Le code actuel maintient plusieurs observateurs de marque indépendants ; ne pas supposer qu'ils ont tous reçu la même valeur au même instant.

Ajouter également une garde défensive au niveau de la requête de refresh, avant de construire/envoyer le POST. L'erreur locale doit être typée pour ne pas devenir un timeout ou une rotation incertaine. Ne pas modifier sans analyse le chemin de transfert haut privilège qui utilise lui aussi un `grant_type=refresh_token` dans `fetchTokens`.

## 5. Connexion, déconnexion et stockage

### Connexion bas privilège

Créer le ticket au démarrage de la connexion, pas seulement après le retour du code OAuth. Associer ticket, `state` OAuth, code verifier et tenant à une tentative immutable. Aujourd'hui `AuthSessionManager` conserve un `codeVerifier` global mutable : une seconde ouverture d'authorize peut remplacer celui de la première. La génération seule ne répare pas ce problème ; le ticket doit voyager avec les paramètres PKCE correspondants.

Après le retour OAuth, échanger le code avec les paramètres de cette tentative puis appeler `completeLogin`. En cas de `SESSION_CHANGED`, ne pas appeler `koreAuthService.authenticate(NOT_AUTH)` : cela pourrait déconnecter une session plus récente. Adapter le résultat de `AuthSessionManager.authenticate` pour distinguer un échec courant d'un résultat obsolète.

Un abandon de connexion doit invalider uniquement le ticket encore courant. Ne pas laisser une réponse tardive rouvrir une session annulée. Utiliser `cancelLogin(ticket)`, fourni dans le noyau, qui compare le ticket encore actif et sa génération sous le même verrou avant d'invalider ; ne pas appeler aveuglément `clearSession()` depuis une ancienne webview.

### Déconnexion

Raccorder le nettoyage global au coordinateur. À l'entrée du flux de logout : invalider la génération et le snapshot, puis effectuer le nettoyage existant et les appels de déconnexion serveur. Le flux appelant doit attendre l'invalidation avant de considérer la déconnexion locale terminée.

`AuthService.logout()` est actuellement synchrone : l'intégration ne doit pas cacher un `launch` non attendu. Soit le coordinateur global de logout devient suspending et attend l'invalidation, soit il expose un état « déconnexion en cours » bloquant les nouveaux consommateurs jusqu'à la fin du nettoyage. Ce raccordement est obligatoire ; `KoreAuthService.kt` étant vide ici, aucun corps existant n'est inventé dans cette proposition.

### Stockage

Une seule source doit faire autorité. Ne pas laisser le coordinateur et `TokensDataSource` évoluer indépendamment.

Choix proposé : snapshot mémoire du coordinateur comme état de session actif, avec projection de compatibilité des anciens getters/flows vers cet état. L'email doit être dérivé du même snapshot. Migrer les lecteurs avant de retirer les setters du stockage historique.

Si la branche réelle exige une restauration persistante, intégrer un store explicite de snapshot complet, avec résultat d'écriture contrôlé. La publication de `SUCCESS` doit attendre l'enregistrement réussi, et la reprise doit valider le contexte et les jetons. Un échec de persistance après rotation impose une récupération ; conserver discrètement R1 sur disque est dangereux. Le noyau fourni n'implémente pas cette persistance, et ne doit pas être livré avec deux états concurrents.

## 6. Classification des erreurs

Le DTO local expose `error` et `errorDescription`. Corriger ou confirmer le mapping réel avant de conserver les noms `auth0Code` et `auth0Description` employés par le repository.

| Réponse / situation | Traitement proposé |
| --- | --- |
| `error = invalid_grant`, quel que soit le statut HTTP de l'endpoint token | `Rejected`, session non renouvelable, reconnexion bas privilège. |
| Code métier « email non vérifié », selon le contrat réel | `EmailNotVerified`, état métier dédié. Vérifier s'il se trouve dans `error` ou `error_description` ; le login actuel examine la description. |
| `invalid_client`, configuration manquante | `Failed`, erreur technique/configuration ; ne pas prétendre qu'un nouveau mot de passe va réparer le client. |
| Jeton vide avant envoi | Aucun POST ; `UNAUTHORIZED`. |
| Absence réseau démontrée avant envoi | `Failed`, retour utilisateur réessayable sans boucle automatique. |
| 429 / 5xx | Erreur temporaire ; pas de retry aveugle du POST. Respecter la politique serveur et `Retry-After` pour une future tentative autorisée. |
| Timeout, réponse perdue ou parsing du succès impossible après envoi | `Indeterminate`, récupération par reconnexion dans cette V2 conservatrice. |
| 401/403 sans code OAuth exploitable | Ne pas assimiler arbitrairement tout refus à une expiration ; journaliser le statut/code parsé et confirmer le contrat serveur. |

Le processor actuel perd une partie des informations de transport en renvoyant une erreur générique. Ajouter une distinction « pas envoyé / réponse HTTP reçue / issue inconnue » est donc nécessaire pour appliquer finement cette table. En attendant, traiter conservativement une issue inconnue ; pas de boucle de retry automatique.

Un appelant arrivé après la fin d'un `Failed` peut lancer une nouvelle tentative explicite. Le partage concerne les appelants de la tentative en cours. Un `Rejected` vide le snapshot et empêche les refresh suivants jusqu'à reconnexion.

## 7. Reconnexion : décision fonctionnelle proposée

Faire ouvrir UNE connexion **bas privilège** pour la génération concernée, puis reprendre au plus une fois l'intention encore active (profil ou OCS). Ne pas réutiliser simplement le modal manuel du haut privilège : dans ce ViewModel, l'action `ManualLogin` utilise par défaut `retrieveAuthorizeUrl()` avec `isLow = false`. Ce chemin ne garantit pas le remplacement des jetons bas privilège invalides.

Créer un coordinateur de reconnexion partagé, avec `requestReauthentication(expectedGeneration, pendingIntent)` : il vérifie la génération courante et qu'aucune connexion n'est déjà ouverte avant de naviguer. Si la session a changé, ignorer la demande. La reprise est conditionnée à la présence de l'écran/intention, et limitée à une tentative pour éviter une boucle login → refresh → login.

Dans chaque ViewModel :

```kotlin
when (outcome.status) {
    SUCCESS -> { /* suite existante et chargement terminé */ }
    UNAUTHORIZED -> {
        // Terminer le chargement, sans erreur technique générique.
        // Demander au coordinateur central la reconnexion bas privilège,
        // avec outcome.generation et l'intention à reprendre.
    }
    EMAIL_NOT_VERIFIED -> { /* état métier, sans répétition du refresh */ }
    FAILED -> { /* erreur technique/réseau réessayable explicitement */ }
    SESSION_CHANGED -> { /* ignorer ce résultat devenu obsolète */ }
}
```

Ce bloc décrit le contrat d'intégration, pas du code prêt à copier. Les méthodes UI existantes utilisables dans le login sont `updateIsLoading`, `updateError` et `handleReaction`. Pour le profil, `_uiStateDataFlow.update` permet d'éteindre le chargement. Ajouter une réaction de reconnexion ou passer par le coordinateur global ; l'activité Android actuelle ignore les réactions inconnues via `else -> Unit`, donc modifier uniquement le shared laisserait la navigation sans effet. Raccorder et tester Android ET iOS.

Le noyau expose `SESSION_CHANGED`, mais une déconnexion peut aussi arriver juste après le retour du repository. Le coordinateur de navigation doit donc revalider la génération à l'exécution, pas seulement faire confiance au résultat reçu.

## 8. Scénarios rejoués

### Deux écrans, avec ou sans rotation

A crée la tentative T pour S1. B récupère le même Deferred. Une seule requête part. Le résultat contient R2, ou R1 si le contrat autorise l'absence de rotation. A et B reçoivent le même succès. Aucune comparaison de valeurs n'est nécessaire.

### Refresh pendant reconnexion

A travaille avec la génération 4. Une nouvelle connexion commence : génération 5, snapshot vide. Les jetons de la connexion 5 sont installés. A revient : 4 ≠ 5, résultat ignoré. Le finally de A ne supprime pas une éventuelle tentative de la génération 5.

### Refresh pendant déconnexion

Le logout incrémente la génération et vide le snapshot sans attendre le réseau. A peut terminer côté serveur ; sa réponse ne réinstalle aucun jeton. La navigation obsolète est également filtrée par génération.

### `invalid_grant`

Tous les participants à T reçoivent `UNAUTHORIZED`. Le snapshot de la session est invalidé. Les refresh suivants ne partent pas. Le coordinateur UI ouvre une seule connexion bas privilège.

### Réponse perdue après rotation

Le serveur peut avoir créé R2 sans que l'application le connaisse. Le coordinateur ne rejoue pas automatiquement R1. Il déclenche la récupération choisie. Cela peut demander plus souvent une connexion sur réseau instable ; c'est un compromis explicite à ajuster avec le contrat Auth0, pas une promesse de récupération silencieuse universelle.

## 9. Ordre d'intégration

1. Sur le checkout complet, résoudre les incohérences DTO, identifier stockage, binding singleton, nettoyage global et retry du client HTTP.
2. Introduire et tester le coordinateur avec un faux transport déterministe ; aucun appel Auth0 nécessaire.
3. Adapter façade et validation de réponse ; fixer le contexte tenant/client par session.
4. Migrer les lecteurs/écrivains de jetons, le login et le logout. Associer génération au state OAuth/PKCE.
5. Migrer les deux ViewModels et la navigation de reconnexion bas privilège sur les deux plateformes.
6. Ajouter les traces sans secrets, compiler Android/iOS et exécuter les tests d'intégration.
7. Valider UAT2 puis Prod-BETA avec les mêmes scénarios et comparer au build antérieur.

Un hotfix limité à la garde + sérialisation reste possible si l'urgence l'impose, mais il doit être nommé ainsi et ne pas être présenté comme couvrant les transitions de session, les pertes de réponse et la reconnexion.

## 10. Ce qui est livré / ce qui reste à vérifier

Livré : analyse du code visible, choix d'architecture, noyau Kotlin de référence, contrats d'adaptation et scénarios de validation. Vérifications réalisées : lecture des chaînes disponibles, recherche des appelants et writers, inspection du stockage, du HTTP, des DTO et du parcours de navigation.

Non revendiqué : compilation du noyau ou de l'app, tests exécutés, configuration Auth0 vérifiée, preuve de la cause du 403, intégration des composants absents. Les adaptations de production listées ici font partie du correctif complet ; le noyau seul n'est pas un patch livrable.
