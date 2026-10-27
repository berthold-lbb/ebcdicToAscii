# Analyse V2 — refus local du refresh au démarrage

Date : 27 octobre 2026. Sources : les trois logs fournis dans Downloads/telegram, les sources actuelles de `ad-digital-mobile-aio`, et la référence SCRATCH 1.413 conservée dans le backup du 27 octobre. Aucun code applicatif modifié par cette analyse.

## 1. Diagnostic retenu

Le chemin démontré par le code et les logs est : demande de jeton → refresh nécessaire → vérification réseau locale → refus avant l'envoi HTTP → résultat de refresh en échec → jeton vide exposé aux appelants legacy.

Le mécanisme de cache périmé est une cause crédible et directement corrigeable : la décision `hasNetworkAccess()` lit exclusivement le cache alors qu'une lecture courante existe dans le service Android. Les logs montrent des refus locaux suivis très rapidement d'une connectivité annoncée et d'un succès HTTP.

**Nuance indispensable :** les logs ne contiennent pas une lecture système effectuée exactement au moment de chaque refus. Un succès 20 ou 100 ms plus tard ne prouve pas que le réseau était déjà disponible à l'instant précédent. Le patch corrige la dépendance au cache ; la nouvelle trace `cached=... live=...` permettra de confirmer ce décalage à l'exécution. Une coupure réelle et un cache périmé peuvent coexister dans un même lancement.

## 2. Comptage vérifié sur les fichiers fournis

| Log | Lignes | Refus locaux `/oauth/token` | « Authenticated but access token or device id missing » | `invalid_grant` | Réponses HTTP 401/403 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `log-android.txt` | 2218 | 11 | 4 | 0 | 0 |
| `log-android-2.txt` | 1918 | 31 | 8 | 0 | 0 |
| `log-error.txt` | 2871 | 0 | 0 | 0 | 0 |

Aucune occurrence de `localLogout` dans les trois fichiers. L'absence de ces marqueurs ne garantit pas l'absence de tout autre problème de session hors de la fenêtre capturée.

Les 11 et 31 occurrences sont des **refus de tentatives locales**, pas 11 ou 31 requêtes Auth0 envoyées. Le chemin `noNetwork()` rend une erreur avant `prepareRequest`.

Le script [extraire-preuves.py](extraire-preuves.py) reproduit le comptage et produit [preuves-logs.json](preuves-logs.json). Il ne recopie que des événements autorisés, sans headers ni corps de requête. Les numéros de ligne permettent de retrouver les originaux ; les logs bruts ne sont pas dupliqués dans le dossier.

## 3. Chronologie utile

### A — 26 octobre, connexion mobile

- L.39, 01:16:53.602 : `AppModel.onStart`, repère de cycle de vie.
- L.851–863, 53.708–53.714 : dix refus locaux de `/oauth/token`.
- L.873, 53.716 : annonce `MOBILE`.
- L.878, 53.737 : requête `/oauth/token`.
- L.919, 54.719 : réponse 200 associée à cet endpoint.
- L.987, 54.783 : un autre log « No network » ; sa date d'affichage n'est pas nécessairement celle de la décision.
- L.991 et 1008 : deux traces « Skipped 130 frames » ; ne pas les additionner sans connaître leurs producteurs.

L'écart entre le repère `AppModel.onStart` et l'annonce réseau est de 114 ms. Ce n'est pas une mesure directe de la durée d'indisponibilité d'Internet ni un horodatage exact de la notification aux abonnés FOREGROUND.

### B — 27 octobre, deux phases

À 07:03:59, on voit une erreur DNS puis `NO_INTERNET`. Les premiers refus peuvent être parfaitement justifiés. L'état initial FOREGROUND de Kore déclenche néanmoins des services avant qu'une activité visible ne soit observée.

À 07:17:33.965 (l.509), on voit `AppModel.onStart`. Des refus locaux sont affichés à 34.070–34.075 ; `WIFI` arrive à 34.079 (l.743). La requête token part à 34.140 (l.1060) et reçoit 200 à 34.559 (l.1271). D'autres refus sont affichés après le WIFI : la journalisation différée interdit de les dater comme de nouvelles décisions hors ligne à cet instant.

Il n'y a aucune mesure de connectivité continue pendant les quelque quatorze minutes entre les deux phases. Ne pas affirmer que le téléphone est resté connecté ou déconnecté tout ce temps.

### C — 23 octobre, services publics

Aucun refus `/oauth/token` dans ce fichier. On voit des refus sur messages dynamiques, provinces et `service-parameters`.

Au deuxième démarrage, une erreur DNS à 09:35:43.854 puis `NO_INTERNET` à 43.954 précèdent les refus. Le WIFI apparaît à 44.472. Cela montre notamment un vrai cas de transition hors ligne → connecté. Le patch n'envoie pas rétroactivement une requête refusée quand le téléphone était réellement hors ligne.

## 4. Chaîne dans le code actuel

Chemins relatifs à `ad-digital-mobile-aio`.

| Source | Ce que le code établit |
| --- | --- |
| `androidApp/src/main/java/ca/dgag/ajusto/kore/info/legacy/NetworkStateImpl.kt` | Lit déjà `connectivityService.connectionType` à la construction, puis s'abonne à l'observable. Ne redéfinit pas `hasNetworkAccess`. |
| `shared/src/commonMain/kotlin/ca/dgag/ajusto/kore/info/BaseNetworkState.kt` | `hasNetworkAccess()` lit le StateFlow ; `noNetworkAccess()` appelle virtuellement cette méthode. Un override Android corrige donc aussi le test négatif utilisé par HTTP. |
| `shared/src/commonMain/kotlin/ca/dgag/ajusto/kore/info/ConnectionType.kt` | UNKNOWN et NO_INTERNET refusent l'accès ; WIFI/MOBILE/ETHERNET l'autorisent. |
| `androidApp/src/main/java/ca/dgag/ajusto/activity/BaseAppCompatActivity.kt` | Enregistre le receiver à `onResume`, le retire à `onPause`. |
| `androidApp/src/main/java/ca/dgag/ajusto/lifecycle/ApplicationState.java` | Produit l'événement FOREGROUND sur ON_START. |
| `androidApp/src/main/java/ca/dgag/ajusto/lifecycle/ApplicationStateDelagate.kt` | Exécute `onForeground()` avant de notifier les abonnés. |
| `shared/src/commonMain/kotlin/ca/dgag/ajusto/kore/info/BaseApplicationState.kt` | État initial FOREGROUND, avant tout événement réel. |
| `shared/src/commonMain/kotlin/ca/dgag/ajusto/kore_ex/KoreServices.kt` | Lance des chargements sur FOREGROUND et sur l'état d'authentification. Son abonnement réseau ne relance que les messages dynamiques. |
| `shared/src/commonMain/kotlin/com/desjardins/assurancedommages/mobile/feature/authenticate/data/http/TokenHttpClientProcessor.kt` | Appelle `noNetwork()` avant tout `prepareRequest`. Produit une erreur locale générique si ce test est vrai. |
| `shared/src/commonMain/kotlin/ca/dgag/ajusto/kore/data/http/BaseHttpClientProcessor.kt` | `noNetwork()` délègue à `NetworkState.noNetworkAccess()`. Les erreurs locales utilisent le code générique -1. |
| `shared/src/commonMain/kotlin/ca/dgag/ajusto/extension/CoroutineContextExt.kt` | Poste les logs de ce chemin sur `Dispatchers.Main`. Leur affichage peut être retardé. |
| `shared/src/commonMain/kotlin/com/desjardins/assurancedommages/mobile/transverse/domain/authenticate/KoreAuthService.kt` | `getAccessTokenV2()` appelle le repository dans `runBlocking`. `getAccessToken()` transforme les résultats non SUCCESS en chaîne vide. |
| `shared/src/commonMain/kotlin/com/desjardins/assurancedommages/mobile/feature/authenticate/data/repository/LowPrivilegeTokenRepository.kt` | Le code actuel possède `refreshTokenReadMutex`, `refreshTokenWriteMutex`, `getOrRefreshAccessTokenIfExpired()` et `forceRefreshAccessToken()`. Ce n'est plus le code sans verrou analysé le 15 octobre. |

Les piles de A (notamment l.454–480) relient le repository à `KoreAuthService`, `AuthServiceBridge`, `CoreAuthService`, `DeviceKeyStorage`, au suivi de version puis à `UiThreadDispatchQueue`. Le chemin synchrone depuis une file UI est donc visible. L'attribution exacte des 130 frames à une requête particulière reste à mesurer ; aucune mesure de durée d'attente de ce getter n'est fournie.

## 5. Référence SCRATCH vérifiée

Fichier lu : `backup/27-oct-2026/ad-digital-mobile-aio/analyse/references/scratch-android-1.413/src/com/mirego/scratch/core/connectivity/ConnectivityServiceImpl.java`.

Le catalogue `ad-digital-mobile-aio/gradle/libs.versions.toml` déclare `scratch = "1.413"`. Cette correspondance étaye l'usage de la référence ; le contenu du binaire effectivement embarqué n'a pas été décompilé dans cette passe.

Dans cette source :

- `getConnectionType()` consulte `ConnectivityManager.getActiveNetworkInfo()` à chaque appel ;
- il rend NO_INTERNET si aucun réseau actif connecté n'est trouvé ;
- il reconnaît mobile, Wi-Fi et Ethernet ;
- il rend `null` pour les autres types ;
- `refreshNetworkInfo()` ignore ce null ;
- sa documentation conseille précisément la lecture directe quand les appels de reprise précèdent la notification de l'observable.

Une connexion détectée n'est pas une preuve de joignabilité d'Auth0. Le patch corrige la fraîcheur de la décision locale, pas la disponibilité du serveur ou du DNS.

## 6. Corrections au document précédent

1. « Le cache n'est alimenté qu'à onResume » est trop absolu : il est aussi initialisé dans le constructeur. Il peut ensuite être périmé jusqu'au prochain événement.
2. « Réseau réel disponible pendant les refus » dépasse ce que les horodatages prouvent : il est disponible peu après ; il manque le relevé simultané cache/système au refus.
3. `log-error.txt` n'est pas une preuve de rejet de refresh : il n'en contient aucun.
4. La source actuelle de `GiaRepository.getServiceParameters()` **conserve déjà les paramètres en cache** sur erreur et exception. Ne pas proposer de nouveau ce correctif comme absent ; les logs ne prouvent pas quel état de ce fichier était embarqué dans chaque build.
5. Les verrous de refresh existent maintenant. La proposition de coordinateur du 15 octobre répondait à un autre périmètre et n'est pas le premier correctif adapté à ces logs.

## 7. Conclusion opérationnelle

Retenir la lecture réseau directe avec fallback sur cache comme premier correctif. Elle supprime le faux refus lorsque le système indique déjà une connexion et que le cache est en retard. Le patch existant allait dans cette direction ; la V2 ci-jointe la confirme, ajoute les tests et précise les garanties.

Ne pas ajouter un délai arbitraire de 150 ms, forcer le réseau à true, déplacer seulement le receiver, ni relancer tous les services en boucle : aucun de ces choix n'est nécessaire pour corriger la lecture périmée.
