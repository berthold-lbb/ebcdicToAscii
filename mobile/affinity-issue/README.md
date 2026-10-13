# Déconnexion Ajusto : proposition avec moins d’état

Analyse du 13 octobre 2026, à partir de la copie locale reconstituée.

**La solution actuelle a le bon principe. Je recommande un allègement ciblé du coordinateur : quatre champs au lieu de six, avec la même navigation et le même ordre de nettoyage.** Il n’existe pas de remplacement par un simple flag qui couvre à lui seul les déclencheurs concurrents, la disparition du fragment et l’expiration en arrière-plan.

Le fichier [LogoutNavigationCoordinator.proposal.kt](./LogoutNavigationCoordinator.proposal.kt) illustre ce changement. C’est une proposition à examiner dans le vrai dépôt, pas un correctif compilé. Les sources applicatives n’ont pas été modifiées. Le contrat de terminaison SCRATCH reste à vérifier avant toute intégration.

Le complément [États expliqués et revue des deux écrans](./revue-appelants.md) détaille `IDLE`, `PENDING`, `HANDLED`, vérifie `ProfilePreferencesFragment` et `AuthTransitionActivity`, et propose une garde de visibilité pour le second.

## Le correctif Android à conserver

Depuis l’activité reprise, après le nettoyage de la déconnexion manuelle :

```kotlin
activity.startActivity(LogoutActivity.newIntent(activity, clearTop = false))
activity.finishAffinity()
```

Dans le manifeste local, `LogoutActivity` est `singleTop`. Le lancement sans flag de nouvelle tâche place donc cet écran au-dessus de l’appelante dans sa tâche. `finishAffinity()` est ensuite appelé sur **l’appelante**, et ferme cette activité ainsi que les activités immédiatement dessous partageant son affinité. Il ne ferme pas la destination nouvellement placée au-dessus.

Cette logique est déjà dans `AndroidAppKoinModules.kt`. Son singleton et l’enregistrement après l’initialisation de Koin sont à conserver.

Précision sur la cause : un lancement depuis `Application` exige `NEW_TASK`, mais ce flag peut réutiliser une tâche existante. `CLEAR_TASK` vide la tâche associée à la destination. Les deux cartes observées sont compatibles avec une sélection de tâche inadéquate, mais « Application crée forcément une tâche vide » n’est pas une règle Android. Pour prouver le scénario exact, il faut les journaux et le manifeste fusionné du build concerné.

## Pourquoi je garderais un coordinateur

Les besoins suivants existent encore dans le code local :

| Besoin | Conséquence |
| --- | --- |
| L’observateur d’authentification et le callback manuel arrivent dans un ordre variable | La navigation doit être consommée une seule fois. |
| Le fragment peut disparaître avant la réponse | L’abonnement de déconnexion doit vivre hors du fragment. |
| L’authentification peut devenir invalide en arrière-plan | La demande doit attendre une activité reprise. |
| Le callback du profil appelle encore `authService.logout()` | Il faut attendre ce nettoyage avant d’ouvrir le parcours de reconnexion. |

Retirer seulement le verrou permettrait à l’observateur d’ouvrir l’accueil avant la fin du nettoyage manuel. Un callback tardif pourrait alors agir sur une reconnexion déjà commencée. La garde d’opération protège cet ordre ; la garde de navigation consommée empêche les doublons. Ce sont deux responsabilités différentes.

## La simplification proposée

| Aujourd’hui : six champs | Proposition : quatre champs | Raison |
| --- | --- | --- |
| `foregroundActivity` | `foregroundActivity` | Conserver une référence faible à l’activité reprise. |
| `previousAuthenticated: Boolean?` | `wasAuthenticated: Boolean = false` | Le troisième état `null` n’apporte rien aux décisions actuelles : le premier `false` ne déclenche rien et le premier `true` arme une future déconnexion. |
| `pendingNavigation` + `navigationHandled` | `navigationState: IDLE / PENDING / HANDLED` | Rendre les états de navigation mutuellement exclusifs. |
| `manualRequestId` + `requestSequence` | `manualSubscriptions: SCRATCHSubscriptionManager?` | L’abonnement existe déjà : sa présence sert de verrou et son identité distingue l’opération courante d’un ancien callback. |

**On supprime le compteur et les identifiants artificiels. On conserve les informations nécessaires au comportement.** Le gain est surtout la lisibilité et la suppression de combinaisons incohérentes de booléens ; ce n’est pas une réduction spectaculaire du nombre de lignes.

Le contrôle `manualSubscriptions !== subscriptions` rejette un ancien callback avant d’exécuter son nettoyage ou de libérer le verrou d’une opération plus récente. L’identité d’objet joue ici le rôle de l’ancien numéro de requête.

Les transitions de navigation deviennent :

```text
IDLE -- perte d’authentification ou fin manuelle --> PENDING
PENDING -- opération terminée + activité reprise --> HANDLED
HANDLED -- nouvelle transition vers connecté ----> IDLE
```

Une opération manuelle en cours empêche de consommer `PENDING`. Une activité absente laisse aussi la demande en attente. Une activité déjà de type `LogoutActivity` consomme la demande sans nouveau lancement.

La proposition conserve les entrées utilisées localement : `onAuthenticationChanged`, `requestLogout`, `runManualLogout` et les callbacks Android. Les fonctions internes `beginManualLogout` et `completeManualLogout` disparaissent. Si les tests du vrai dépôt les appellent directement, ils devront être adaptés ; aucun appel applicatif local externe à ces fonctions n’a été trouvé.

## Ce qu’il faut résoudre avant d’intégrer, quelle que soit la variante

**La terminaison de SCRATCH est le point restant le plus important.** L’abonnement actuel ne traite que `onEvent`. Si aucun résultat n’arrive, la variante proposée conserve le même risque de verrou bloqué. Elle ne prétend pas le corriger.

Les sources de `SCRATCHObservableCallback` et `SCRATCHOperation` ne sont pas disponibles dans cette copie. `SessionControllerImpl.java` est un squelette. Je ne peux donc pas affirmer que cette API expose `onError` ou `onCompleted`, ni inventer des surcharges Kotlin pour ces callbacks.

Dans le vrai dépôt, vérifier que `didFinishEvent()` émet exactement un résultat terminal pour tous les chemins. Si ce n’est pas garanti, faire converger les chemins terminaux réellement disponibles vers la libération de l’abonnement. Distinguer deux situations :

- Un résultat est reçu, même avec erreur serveur : conserver le nettoyage et la navigation actuels.
- L’opération ne démarre pas ou s’arrête sans résultat : libérer le verrou ; conserver une navigation déjà demandée par l’observateur, mais ne pas prétendre que le nettoyage métier est terminé.

Un délai maximal peut être utile si une opération peut rester suspendue, mais **libérer le verrou ne suffit pas** : il faut aussi définir l’annulation de l’ancienne opération et empêcher ses effets métier tardifs. Le contrôle d’identité empêche un ancien callback de ce coordinateur d’agir ; il n’annule pas les effets internes d’une opération SCRATCH toujours active. Le callback de résultat existant ne peut pas servir seul à signaler ce type d’échec : l’UI a également besoin d’une voie de fin sans résultat pour fermer son indicateur d’attente.

La proposition libère le verrou dans un `finally` après le callback appelant. Elle tente aussi la navigation dans un `finally` après l’annulation de l’abonnement. Cela protège ces étapes lorsqu’un nettoyage lève une exception, sans remplacer le contrat de terminaison manquant.

## Une solution encore plus courte, avec un changement plus large

Un seul observateur pourrait décider de naviguer, et les écrans appelleraient simplement un service `logout()`. Cela permettrait au navigateur de ne plus attendre un callback manuel **si le service garantit que l’état déclenchant la navigation est publié après tout le nettoyage local nécessaire**. L’exclusion des déconnexions simultanées resterait une responsabilité de ce service.

Ce contrat n’est pas établi ici. Le profil effectue encore du nettoyage dans son callback, le pont `AccountRepositoryBridger` relaie `getIsAuthenticatedFlow()`, et l’implémentation du repository concerné manque. Retirer dès maintenant le verrou en laissant ces responsabilités inchangées créerait un risque de course.

Je réserverais donc cette solution au travail sur le service de session. Pour le correctif actuel, le coordinateur à quatre champs est une modification plus limitée et vérifiable.

## Affinité et autres cartes des Récents

Le coordinateur agit sur la tâche de l’activité visible. Il ne garantit pas la suppression d’une deuxième tâche déjà existante, et ne ferme pas une tâche de navigateur externe. La carte « Services en ligne » doit être identifiée par ses activités, son package et son `taskId` avant de choisir une action.

Retirer `android:taskAffinity="${applicationId}"` rétablit l’affinité par défaut ; cela ne signifie pas « aucune affinité ». `taskAffinity=""` a une autre signification. La suppression seule ne démontre donc pas que le risque de détournement de tâche est traité. Le choix sécurité est distinct de cette simplification et doit tenir compte du manifeste fusionné et des versions Android supportées.

Les lancements dans `LauncherActivity` et `CommunicationPreferencesActivity`, ainsi que la reconnexion vers `MainActivity` en `singleTask`, restent à vérifier. Passer partout à `CLEAR_TOP`, ajouter `singleTask` à `LogoutActivity` ou masquer une carte dans les Récents ne garantit pas le nettoyage de la session.

## Validation à effectuer dans le vrai dépôt

Toutes les entrées du coordinateur doivent être exécutées sur le thread principal. `@MainThread` documente ce contrat, mais ne déplace pas automatiquement un appel sur ce thread.

| Scénario | Résultat attendu |
| --- | --- |
| Premier état observé `false` au lancement | Aucune déconnexion artificielle. |
| `true` puis `false`, activité visible | Une navigation. |
| `false` reçu pendant la déconnexion manuelle | Aucune navigation avant la fin du nettoyage appelant. |
| Résultat manuel avant le `false` global | Une navigation ; le `false` tardif n’en ajoute pas. |
| Double clic | Une opération et une navigation. |
| Rotation ou fermeture du fragment | Opération conservée ; navigation depuis l’activité reprise disponible. |
| Expiration en arrière-plan | Navigation au retour au premier plan. |
| Résultat serveur en erreur | Nettoyage local et navigation selon le comportement actuel. |
| Exception de création/démarrage | Verrou libéré ; une demande globale déjà reçue reste traitable. |
| Callback appelant qui lève une exception | Libération du verrou et tentative de navigation exécutées. |
| `LogoutActivity` déjà visible | Aucun empilement supplémentaire. |
| Reconnexion puis nouvelle déconnexion | Le coordinateur est réarmé. |
| Fin sans résultat ou opération suspendue | Vérifier le contrat SCRATCH ou traiter explicitement ce chemin avant livraison. |
| Plusieurs tâches déjà présentes | Identifier et vérifier chacune ; le coordinateur n’en nettoie qu’une. |

Pour les essais sur appareil, capturer `adb shell dumpsys activity activities` avant et après, relever les `taskId`, puis essayer Retour, Récents et une nouvelle ouverture par l’icône. Vérifier aussi qu’aucun écran authentifié restauré ne donne accès à une ancienne session. Le nombre de cartes seul ne valide pas le nettoyage métier.

## Sources et limites

Lecture locale :

- [Coordinateur actuel](../../ad-digital-mobile-aio/androidApp/src/main/java/ca/dgag/ajusto/authentification/logout/LogoutNavigationCoordinator.kt).
- [Lancement injecté par Koin](../../ad-digital-mobile-aio/androidApp/src/main/kotlin/com/desjardins/assurancedommages/mobile/platform/di/AndroidAppKoinModules.kt).
- [Nettoyage du profil](../../ad-digital-mobile-aio/androidApp/src/main/java/ca/dgag/ajusto/profile/preferences/ProfilePreferencesFragment.kt).
- [Relais d’authentification et logout du repository](../../ad-digital-mobile-aio/androidApp/src/main/java/ca/dgag/ajusto/bridger/account/AccountRepositoryBridger.kt). Le relais du flow est confirmé ; l’émission effective lors de `repository.logout()` reste à vérifier dans son implémentation.
- [Manifeste local](../../ad-digital-mobile-aio/androidApp/src/main/AndroidManifest.xml).

Documentation Android consultée :

- [Lancement hors contexte Activity](https://developer.android.com/reference/android/content/Context#startActivity(android.content.Intent)).
- [Sémantique de NEW_TASK](https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_NEW_TASK) et [CLEAR_TASK](https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_CLEAR_TASK).
- [Portée de finishAffinity](https://developer.android.com/reference/android/app/Activity#finishAffinity()).
- [Affinité des activités](https://developer.android.com/guide/topics/manifest/activity-element#aff).
- [Restrictions de lancement d’activité en arrière-plan](https://developer.android.com/guide/components/activities/secure-bal).

Aucune compilation Android ni exécution des « 21 tests » rapportés dans les captures. La proposition Kotlin a été relue, mais pas compilée : le compilateur Kotlin n’est pas disponible dans cet environnement et la copie applicative est incomplète. Ce dossier constitue une analyse et une variante de code à valider dans le dépôt complet.
