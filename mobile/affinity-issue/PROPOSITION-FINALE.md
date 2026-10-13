# Proposition finale — coordinateur de déconnexion à quatre champs

Version du 13 octobre 2026. Le code complet retenu est [LogoutNavigationCoordinator.proposal.kt](./LogoutNavigationCoordinator.proposal.kt). Il remplace la classe du même nom dans le vrai dépôt après validation ; il reste ici dans le dossier d’analyse.

## Comment représenter true, true ?

**Par `HANDLED`, pour conserver la décision du code actuel.**

L’ancienne garde est :

```kotlin
if (!pendingNavigation || navigationHandled) return
```

Quand les deux booléens valent `true`, `navigationHandled` suffit à empêcher le lancement. Les quatre couples donnent donc trois décisions :

| `pendingNavigation` | `navigationHandled` | État retenu | Décision |
| --- | --- | --- | --- |
| `false` | `false` | `IDLE` | Aucune navigation demandée. |
| `true` | `false` | `PENDING` | Navigation demandée ; attendre les conditions nécessaires. |
| `false` | `true` | `HANDLED` | Ne pas relancer cette déconnexion. |
| `true` | `true` | `HANDLED` | Le marqueur « déjà traité » prime : ne pas relancer. |

La correspondance peut se lire ainsi :

```kotlin
when {
    navigationHandled -> NavigationState.HANDLED
    pendingNavigation -> NavigationState.PENDING
    else -> NavigationState.IDLE
}
```

Ce bloc explique la correspondance ; il n’est pas ajouté à la classe finale, qui ne possède plus les deux anciens booléens. Ces champs ne sont pas persistés : aucune conversion de données sauvegardées n’est nécessaire pour cette proposition.

Je corrige donc la formulation antérieure « combinaison contradictoire/impossible » : elle est représentable et son comportement est défini par la priorité de la garde. Elle existe même brièvement dans l’ancien code lorsque `navigationHandled = true` précède `pendingNavigation = false`. Sur le thread principal, sans appel entre ces affectations, ce passage transitoire n’est pas en soi un bug.

Ajouter un quatrième enum conserverait un détail redondant de l’ancienne représentation sans introduire de décision utile. `HANDLED` ne signifie pas « toute la déconnexion métier et tous les écrans ont fini leur travail » : il signifie « cette demande de lancement est consommée ».

## Les quatre champs retenus

```kotlin
private var foregroundActivity = WeakReference<Activity>(null)
private var wasAuthenticated = false
private var navigationState = NavigationState.IDLE
private var manualSubscriptions: SCRATCHSubscriptionManager? = null
```

| Champ | Question à laquelle il répond |
| --- | --- |
| `foregroundActivity` | Depuis quelle activité reprise peut-on naviguer ? |
| `wasAuthenticated` | Vient-on de passer de connecté à déconnecté ? |
| `navigationState` | Faut-il encore lancer l’écran de déconnexion ? |
| `manualSubscriptions` | Une déconnexion manuelle et son nettoyage sont-ils encore en cours ? |

L’identité de `manualSubscriptions` sert aussi à ignorer un ancien callback. Le compteur `requestSequence` et le numéro `manualRequestId` disparaissent.

`IDLE` n’implique ni « utilisateur connecté » ni « aucune opération en cours ». C’est uniquement l’absence de demande de navigation. Une opération manuelle peut démarrer et conserver momentanément cet état ; son abonnement empêche alors une deuxième opération.

## Ordre d’exécution conservé

1. Un écran demande une déconnexion manuelle. Le coordinateur pose son verrou avant de créer/démarrer l’opération.
2. Si l’observateur annonce une perte d’authentification, la navigation devient `PENDING`. Le verrou bloque encore le lancement.
3. Le résultat manuel arrive. Le callback appelant effectue le nettoyage, même si l’écran d’origine a disparu.
4. Le coordinateur libère le verrou dans un `finally`, demande la navigation et annule l’abonnement. La tentative de navigation reste exécutée si cette annulation lève une exception.
5. Une activité reprise disponible permet de consommer la demande : `HANDLED`, puis lancement Android. Sinon, elle reste `PENDING` jusqu’au retour au premier plan.
6. Un déclencheur tardif de la même sortie ne relance rien. Une nouvelle transition vers connecté, sans opération manuelle active, réarme le coordinateur.

Si le résultat manuel arrive avant le signal de l’observateur, il demande lui-même la navigation. Le signal tardif retrouve `HANDLED`.

## Intégration dans les fichiers existants

### LogoutNavigationCoordinator

Utiliser le [fichier Kotlin complet](./LogoutNavigationCoordinator.proposal.kt). Les entrées utilisées par les écrans restent `runManualLogout()`, `requestLogout()` et `onAuthenticationChanged()`.

Les fonctions internes `beginManualLogout()` et `completeManualLogout()` disparaissent. Les tests qui les invoquent directement doivent être adaptés aux actions publiques et à leurs effets observables.

### Module Koin et AjustoApplication

Conserver le singleton avec le lancement dans la tâche courante :

```kotlin
single {
    LogoutNavigationCoordinator { activity ->
        activity.startActivity(LogoutActivity.newIntent(activity, clearTop = false))
        activity.finishAffinity()
    }
}
```

Conserver l’enregistrement `registerActivityLifecycleCallbacks(logoutNavigationCoordinator)` après l’initialisation de Koin, et la transmission des événements d’authentification à `onAuthenticationChanged()` depuis le thread principal.

### ProfilePreferencesFragment

Conserver son appel actuel à `runManualLogout()` : annulation des notifications et `authService.logout()` avant l’accès éventuel au fragment par référence faible. Conserver la garde UI `isAdded && isResumed`, la fermeture du dialogue dans `onPause()` et le traitement du retour `false` pour fermer un dialogue ouvert sans opération démarrée.

Aucun état supplémentaire n’est nécessaire dans le fragment pour cette refactorisation. Son champ de dialogue reste utile à la gestion de l’interface.

### AuthTransitionActivity

Conserver l’opération et les notifications, avec cette garde pour les effets UI. Ajouter `import androidx.lifecycle.Lifecycle`.

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

`cancelAll()` reste hors de la garde UI. La différence d’appel à `koreAuthService.logout()` entre le profil et le parcours de transition V1/V2 reste à vérifier dans le code métier complet ; cette proposition ne l’ajoute pas arbitrairement.

### Autres appelants et manifeste

`DialogHelperView` conserve son passage par `runManualLogout()`. Les nettoyages de signature publique de ce helper doivent être coordonnés avec les appelants du vrai dépôt. Cette proposition ne nécessite aucun changement de `taskAffinity` et ne modifie pas le manifeste reconstitué.

## Validation et limite de cette version finale

« Finale » signifie ici **version retenue de la proposition**, pas version compilée ou prête à livrer. La copie locale est incomplète, les bibliothèques SCRATCH nécessaires ne sont pas disponibles pour vérifier leurs signatures terminales, et aucun test Android n’a été exécuté ici.

Le risque d’opération sans résultat reste explicite : si `didFinishEvent()` n’émet rien, le verrou peut rester posé et l’interface rester en attente. Avant livraison, établir le contrat terminal de SCRATCH ou traiter les chemins réels de fin sans résultat, avec clôture de l’attente UI et maîtrise des effets tardifs. Aucun timeout ni callback terminal supposé n’est inventé dans le code proposé.

Les scénarios prioritaires à valider dans le vrai dépôt sont : double clic, résultat manuel avant/après le signal global, disparition de l’écran, expiration en arrière-plan, reconnexion puis nouvelle déconnexion, exceptions de démarrage/nettoyage/navigation et terminaison sans résultat. Vérifier aussi Retour et Récents sur appareil ; cette variante nettoie la tâche choisie, pas toutes les tâches déjà existantes.

Les détails des vérifications déjà effectuées par lecture sont dans [revue-appelants.md](./revue-appelants.md). Les éléments rapportés en captures et les précisions sur les règles Android sont dans [retour-captures.md](./retour-captures.md).
