# États expliqués et revue des deux écrans

Complément du 13 octobre 2026. Vérification par lecture des sources locales ; aucune compilation ni exécution Android.

## Ce que signifient les trois états

Ils décrivent **la demande d’ouverture de l’écran de déconnexion**. L’authentification est suivie par `wasAuthenticated`, et l’opération manuelle par `manualSubscriptions`.

| État | En français | Effet |
| --- | --- | --- |
| `IDLE` | Aucune navigation demandée | Une nouvelle déconnexion peut être engagée si aucune opération manuelle n’est déjà active. |
| `PENDING` | Navigation demandée, à effectuer | Attendre la fin du nettoyage manuel et une activité reprise, puis lancer la navigation. |
| `HANDLED` | Demande déjà consommée | Ignorer les déclencheurs tardifs de la même déconnexion. Une nouvelle connexion réarme le coordinateur. |

Exemple depuis le profil, si l’observateur reçoit `false` avant le résultat manuel :

1. L’utilisateur est connecté : état `IDLE`.
2. Il confirme la déconnexion : création de l’abonnement qui sert de verrou. L’état de navigation peut encore être `IDLE` à ce moment-là.
3. L’observateur reçoit `false` : passage à `PENDING`. Le verrou empêche de naviguer trop tôt.
4. Le résultat manuel arrive : annulation des notifications et appel à `authService.logout()` dans le callback du profil.
5. Le coordinateur libère le verrou. Si une activité est reprise, il consomme la demande et lance `LogoutActivity` : état `HANDLED`.
6. Un autre signal de la même déconnexion arrive : aucune deuxième navigation.
7. Lors d’une nouvelle transition vers connecté, sans opération manuelle active : retour à `IDLE`.

Si le résultat manuel arrive avant le `false` global, la fin manuelle demande elle-même la navigation. Le `false` tardif retrouve `HANDLED` et ne la relance pas. Si l’app est en arrière-plan à la fin manuelle, l’état reste `PENDING` jusqu’à la reprise d’une activité.

`HANDLED` est posé **juste avant** l’appel Android, pour empêcher un deuxième lancement réentrant. Une exception de navigation remet l’état à `PENDING`. Une activité déjà de type `LogoutActivity` suffit aussi à consommer la demande. Ce nom ne signifie donc pas que toute la procédure métier ou l’affichage de l’accueil est terminé.

## ProfilePreferencesFragment

Source : [ProfilePreferencesFragment.kt](../../ad-digital-mobile-aio/androidApp/src/main/java/ca/dgag/ajusto/profile/preferences/ProfilePreferencesFragment.kt), notamment lignes 135–140 et 191–230.

**Le chemin de déconnexion est compatible avec le coordinateur proposé, sans changer sa signature.**

- `runManualLogout(operation = { controller.logout() })` confie l’opération et son abonnement au coordinateur.
- Le callback annule les notifications et appelle `authService.logout()` avant de tenter d’accéder au fragment. Ces actions restent donc exécutables lorsque le fragment a disparu.
- Le callback accède au fragment par `WeakReference`. Les dépendances métier utilisées sont prélevées dans des variables locales.
- `onLogoutCompleted()` vérifie `isAdded && isResumed` avant d’agir sur l’interface.
- `onPause()` ferme le dialogue et ne touche pas à l’abonnement détenu par le coordinateur. Le code appelle aussi `profilePreferencesController.cancel()` ; son implémentation absente ne permet pas d’en certifier tous les effets internes.
- Si `runManualLogout()` refuse de démarrer, le dialogue d’attente est fermé.

Le champ `logoutFeedbackDialog` sert à gérer une ressource UI et à fermer le dialogue au départ de l’écran. Le contrôle `logoutFeedbackDialog != null` évite aussi de réouvrir ce dialogue localement. Le verrou partagé du coordinateur reste nécessaire pour les demandes provenant d’autres écrans.

Le fragment délègue parfois à `AuthTransitionActivity` dès `logoutPressed()` : c’est la branche `AUTH_V1` avec le flag de connexion V2 activé. Dans cette branche, il ouvre l’écran de transition et ne lance pas immédiatement sa propre opération de déconnexion.

La durée et la fermeture effective du dialogue après `end()` ne sont pas vérifiables : `AppServerFeedbackDialog.kt` est un fichier de reconstitution sans implémentation. La compatibilité examinée ici concerne les appels et leur ordre.

## AuthTransitionActivity

Source : [AuthTransitionActivity.kt](../../ad-digital-mobile-aio/androidApp/src/main/kotlin/com/desjardins/assurancedommages/mobile/feature/authtransition/AuthTransitionActivity.kt), notamment lignes 65–85.

**Le passage par `runManualLogout()` est compatible. Un ajustement de visibilité est recommandé pour son callback.**

La réaction `Logout` appelle `logoutOperation()`. Celle-ci délègue au coordinateur, annule les notifications avec le contexte Application et utilise une référence faible pour retrouver l’activité. Elle ne lance plus elle-même `LogoutActivity`.

Le contrôle actuel `!isFinishing && !isDestroyed` ne prouve pas que l’activité est au premier plan. Une activité arrêtée en arrière-plan peut satisfaire ces deux conditions. Dans ce cas, le callback appelle pourtant `setApplicationInForeground(true)` et `fetchInAppMessageIfPossible(activity)`.

Le coordinateur continue bien à différer sa navigation, mais ces effets du callback peuvent se produire trop tôt. Pour appliquer la même intention que le `isResumed` du fragment, ajouter la vérification du cycle de vie autour de ces seuls effets UI. L’annulation des notifications reste en dehors de cette garde.

Extrait proposé pour remplacer `logoutOperation()` dans le vrai dépôt, avec l’import `androidx.lifecycle.Lifecycle` :

```kotlin
private fun logoutOperation() {
    val appContext = applicationContext
    val controller = sessionController
    val activityReference = WeakReference(this)

    logoutNavigationCoordinator.runManualLogout(
        operation = { controller.logout() }
    ) {
        (appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)
            ?.cancelAll()

        val activity = activityReference.get()
        if (activity != null &&
            !activity.isFinishing &&
            activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
        ) {
            inAppMessageProcessTrigger.setApplicationInForeground(true)
            inAppMessageProcessTrigger.fetchInAppMessageIfPossible(activity)
        }
    }
}
```

Dans ce fichier, `inAppMessageProcessTrigger` est importé depuis `AjustoTutorialHelper` ; ce n’est pas un accès implicite à une propriété de l’activité. La lambda `operation` actuelle utilise `sessionController` via l’activité, mais le coordinateur l’évalue immédiatement et ne la conserve pas comme callback. Extraire `controller` rend cette intention explicite.

Précision après lecture du retour en captures : `isDestroyed` peut être retiré de cette garde puisque le cycle de vie AndroidX est déjà contrôlé. En revanche, conserver `!isFinishing` : une demande `finish()` peut avoir été acceptée avant la réception de `ON_PAUSE`. L’activité peut alors encore être `RESUMED` tout en étant en cours de fermeture. Voir [la vérification dans les sources Android](./retour-captures.md).

Deux points restent à confirmer dans le vrai parcours :

- Le fragment appelle `koreAuthService.logout()`, contrairement à cette activité. La branche de transition V1/V2 peut expliquer cette différence. L’implémentation de son ViewModel et celle du contrôleur de session ne sont pas disponibles ; ajouter cet appel sans vérifier le contrat serait prématuré.
- L’activité ignore le booléen renvoyé par `runManualLogout()`. Le coordinateur bloque quand même les doublons. En cas d’exception de création ou de démarrage, il faut toutefois vérifier comment l’écran sort de son éventuel état d’attente. `AuthTransitionView` est un squelette local et ne permet pas de conclure sur son comportement visuel.

Références Android : [sens de isFinishing/isDestroyed](https://developer.android.com/reference/android/app/Activity) et [état Lifecycle.RESUMED](https://developer.android.com/reference/kotlin/androidx/lifecycle/Lifecycle.State).

La proposition de garde est documentée dans ce dossier. Les fichiers applicatifs n’ont pas été modifiés.
