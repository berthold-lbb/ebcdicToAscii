# Déconnexion : proposition C, un parcours explicite

## Recommandation

Je recommande C pour rendre le code plus lisible : **une demande démarre le travail, on attend son callback de fin et son nettoyage synchrone, puis on ouvre la sortie une seule fois depuis une activité visible**.

C est une réorganisation de A, avec le même contrat public et la même politique fonctionnelle. Ce n’est pas un nouveau mécanisme Android ni un correctif métier supplémentaire. Elle remplace le couple « état de navigation + abonnement utilisé comme verrou » par une seule étape de parcours. Elle ne prétend pas être plus courte ; elle rend les décisions plus explicites.

Les fichiers originaux n’ont pas été modifiés. Le document fourni a été traité comme une source à analyser, pas comme des instructions imposant de conserver A. Les affirmations de tests sur appareil sont celles du document, pas des tests reproduits ici.

## Ce que le code permet de confirmer

Base analysée : `ad-digital-mobile-aio/androidApp/src/main/`.

- `LogoutNavigationCoordinator.kt` : la version A détient les abonnements, filtre les doublons et attend le retour du callback avant de naviguer. Sa variable `manualSubscriptions` sert à la fois de ressource technique et de verrou logique.
- `AndroidAppKoinModules.kt` : le lancement part déjà de l’activité avec `clearTop = false`, puis appelle `finishAffinity()` sur l’appelante. Ce correctif est conservé.
- `AjustoApplication.kt` : le coordinateur reçoit le cycle de vie des activités et les changements d’authentification sur `UiThreadDispatchQueue`.
- `ProfilePreferencesFragment.kt` : annulation des notifications, appel de `authService.logout()`, puis mise à jour du dialogue via une référence faible. Le coordinateur appelle ce callback même si le résultat SCRATCH est un échec.
- `AuthTransitionActivity.kt` et `DialogHelperView.kt` : utilisent déjà `runManualLogout`. Aucun changement de signature n’est nécessaire.
- `BaseAppCompatActivity.kt` : la modale d’erreur conserve un chemin direct par `AccountRepositoryBridger.logout()` puis `finish()`. Il dépend de l’observation d’authentification pour la navigation ; C ne centralise donc pas tout le nettoyage métier.
- `AccountRepositoryBridger.kt` : transmet un flow d’authentification et adapte le résultat du repository, mais ne permet pas de prouver l’ordre interne de tous les effets métier.

## Corrections à apporter à la lecture du comparatif

1. **« Nettoyage garanti » est trop fort.** Le callback est appelé avant la navigation, mais son retour ne prouve pas la fin d’un traitement asynchrone lancé par `authService.logout()`. Si une instruction du callback lève une exception, les instructions suivantes ne sont pas exécutées et le `finally` demande néanmoins la sortie. C conserve ce comportement.
2. **`NEW_TASK` ne crée pas toujours une nouvelle tâche.** Android peut réutiliser une tâche compatible avec l’affinité. Les numéros de tâches rapportés sont des observations du document ; le code seul ne prouve pas leur origine exacte.
3. **Le manifeste local contient encore `android:taskAffinity="${applicationId}"` sur `<application>` (ligne 80 au moment de la lecture).** Le retrait évoqué dans le comparatif ne décrit donc pas entièrement cet instantané. Il faut lire le manifeste fusionné de la variante réellement installée.
4. Le fichier `CMTSessionControllerImpl.java` existe, mais son corps est un placeholder. `AppServerFeedbackDialog.kt` est aussi un squelette. Leur existence ne donne pas leur contrat réel.
5. La taille de l’esquisse B2 ne représente pas une solution complète : callbacks de cycle de vie, gestion d’échec et nettoyage restent à fournir.
6. **Le double lancement et le nettoyage de session sont deux sujets distincts.** Une seule carte dans les Récents ne démontre pas que les identifiants, données locales et sessions distantes ont été effacés.

Référence Android officielle : [Tasks and the back stack](https://developer.android.com/guide/components/activities/tasks-and-back-stack). Un lancement ordinaire rejoint la tâche appelante ; `NEW_TASK` change la sélection de tâche. Cela justifie de préserver le lancement depuis l’activité dans le câblage existant, sans promettre de supprimer des tâches déjà présentes.

## Comparaison des choix

| Choix | Règle lisible | Compromis | Avis |
|---|---|---|---|
| A actuelle | Deux entrées, état de navigation et verrou séparé | Solide structure existante, mais combinaisons implicites à comprendre | Base raisonnable, appareil validé seulement selon le document |
| B2 | La perte d’authentification ouvre la sortie | Peut naviguer avant le callback de nettoyage ; dépend du contrat du repository | Pas recommandée avec les informations locales |
| C proposée | Une étape décrit où en est toute la sortie | Même politique que A ; un peu plus de code pour rendre l’intention explicite | Proposition implémentée ici |

Une autre architecture serait de faire publier par le domaine un état **DéconnexionTerminée**, uniquement après invalidation de session et nettoyage achevé. L’interface ne ferait alors que réagir à cet état, ce qui rendrait B2 cohérente. Cette évolution nécessite les vraies implémentations du repository, du service d’authentification et des opérations ; il serait trompeur de la présenter comme intégrable à partir des squelettes disponibles.

## La logique humaine de C

Imagine une réception avec une fiche de départ :

1. **Ready — disponible** : aucun départ n’est engagé.
2. **InProgress — déconnexion en cours** : une seule tentative possède ses abonnements. Toute demande supplémentaire de sortie est notée sur cette tentative (`exitRequested`), mais ne provoque pas de navigation.
3. **WaitingForActivity — sortie prête, activité attendue** : le travail a rendu la main ; on attend un écran utilisable pour lancer Android.
4. **ExitOpened — sortie ouverte** : les demandes supplémentaires sont ignorées jusqu’à une nouvelle authentification, hors tentative en cours.

```text
Clic accepté → InProgress → callback et nettoyage → WaitingForActivity → ExitOpened
Session perdue sans opération ────────────────────→ WaitingForActivity → ExitOpened
Session perdue pendant InProgress → demande mémorisée, aucune navigation immédiate
```

La différence est dans la représentation : il n’existe plus un état « navigation libre » avec un verrou technique séparé qu’il faut penser à vérifier. L’étape `InProgress` porte elle-même la tentative et ses ressources. L’identité de cette tentative protège aussi contre un ancien callback.

## Comportements conservés volontairement

| Situation | Comportement C |
|---|---|
| `false` initial, sans `true` observé | Pas de navigation automatique |
| Double clic pendant une tentative | Deuxième opération refusée |
| `auth=false` avant la fin de l’opération | Mémorisé ; attendre la fin du callback |
| Fin d’opération avant `auth=false` | Demande de sortie ; signal tardif ignoré |
| Résultat d’opération en échec | Callback puis sortie, comme A |
| Exception de création/démarrage sans signal de sortie | Retour `false`, parcours à nouveau disponible |
| Exception avec une sortie déjà demandée | Conserver cette demande et tenter de naviguer |
| Activité absente, détruite ou en fermeture | Attendre une activité valide |
| Exception de navigation | Attendre une nouvelle reprise ou demande explicite |
| Opération qui ne termine jamais | Reste en cours, comme A |

## Limites à résoudre avec les vrais contrats

- **Pas de timeout arbitraire.** Libérer la tentative après un délai ne garantit pas l’arrêt de l’opération sous-jacente et pourrait autoriser deux traitements métier simultanés. Il faut une annulation effective ou un contrat d’opération terminal avant d’ajouter cette politique.
- **Reconnexion pendant une opération** : comme A, elle ne réarme pas le parcours immédiatement. Une ancienne fin peut encore conduire à la sortie après ce signal. Il faut interdire cette reconnexion pendant le départ ou introduire un identifiant de génération de session dans le domaine pour ignorer tous les anciens effets, pas seulement le callback UI.
- **Échec métier** : pour rester sur le profil en cas d’échec, il faudrait aussi conditionner son nettoyage, garantir que la session reste valide, et traiter le cas où `auth=false` est déjà arrivé. Changer uniquement `openExit = eventData.isSuccess` serait insuffisant.
- **Échec partiel de navigation** : si `startActivity` réussit mais `finishAffinity` lève une exception, la lambda a partiellement réussi. La reprise doit être testée ; aucun « exactement une fois » absolu n’est promis pour des effets Android partiels.
- **Thread principal obligatoire** : `@MainThread` documente le contrat, ne déplace pas les appels. Les entrées locales examinées sont UI ou dispatchées UI ; tout nouvel appelant doit respecter ce contrat.
- Les abonnements survivent à la disparition de l’écran, pas à la mort du processus.

## Fichiers livrés et intégration

Les chemins ci-dessous sont relatifs à ce dossier et reproduisent ceux du projet :

- `androidApp/src/main/java/ca/dgag/ajusto/authentification/logout/LogoutNavigationCoordinator.kt` : copie réécrite complète, blocs modifiés marqués `MODIFIÉ C`.
- `androidApp/src/main/kotlin/com/desjardins/assurancedommages/mobile/platform/di/AndroidAppKoinModules.kt` : copie complète du câblage, commentaires `AJOUT C`, comportement inchangé.
- `androidApp/src/test/java/ca/dgag/ajusto/authentification/logout/LogoutNavigationCoordinatorTest.kt` : 10 nouveaux tests ciblés, à compiler et exécuter dans le dépôt complet. Si un fichier de ce nom existe dans ce dépôt, fusionner ces cas avec lui.
- `CHANGEMENTS.diff` : comparaison des deux fichiers de production avec les originaux ; fourni pour revue, non appliqué.
- `empreintes-originaux.json` et `VERIFICATION.md` : contrôle de conservation de l’arborescence source.

Pour intégrer plus tard dans un dépôt complet : remplacer le coordinateur par cette copie et ajouter/fusionner les tests. Le fichier DI n’exige aucun changement fonctionnel. Ne pas ajouter la copie à côté de l’original dans le même source set : ils déclarent la même classe. `AjustoApplication`, le profil, le dialogue, la transition et `LogoutActivity` gardent leurs appels actuels. Aucune dépendance de production supplémentaire n’est introduite.

## Validation honnête

Les vérifications exécutées ici portent sur la conservation des fichiers et sur la structure des copies. **Ni compilation Kotlin/Android ni tests JUnit exécutés.** Le wrapper ne contient pas `gradle-wrapper.jar`, aucun `kotlinc` n’est disponible dans le PATH et plusieurs classes locales sont des placeholders. La proposition est une implémentation à intégrer et valider, pas un correctif certifié sur appareil.

Les 10 tests fournis couvrent attente d’activité, doublons, faux initial, reconnexion, activité fermante, pause, exception de navigation, réentrance, double demande pendant la création et perte de session suivie d’une exception de création. Ils ne couvrent pas encore le vrai flux de fin SCRATCH, dont les types et le comportement doivent être vérifiés dans le dépôt complet.

Tests supplémentaires indispensables dans ce dépôt :

1. Émettre `auth=false` puis la fin SCRATCH, et inverser cet ordre : un seul lancement, après retour du nettoyage.
2. Détruire/recréer le fragment pendant l’opération : nettoyage métier appelé une fois, aucune vue détruite utilisée.
3. Résultat d’échec, callback qui lève, opération sans fin, reconnexion pendant une tentative : vérifier les politiques décrites ci-dessus.
4. Profil classique, AuthTransition, désautorisation et modale d’erreur : vérifier chaque chemin et les notifications.
5. Sur appareil, comparer `adb shell dumpsys activity activities` avant/après sortie et reconnexion ; vérifier Récents et Retour. Utiliser une installation propre pour le scénario nominal, puis tester séparément des tâches préexistantes et les notifications/liens profonds.

L’objectif de C est donc une lecture et une maintenance plus simples, sans faire passer un changement de présentation du code pour une preuve supplémentaire de sécurité de session.
