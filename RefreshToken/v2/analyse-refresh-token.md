# Refresh token — analyse V2 fondée sur le code local

Date : 15 octobre 2026. Périmètre : sources locales Android, iOS et shared. Aucun code applicatif modifié. Les observations BrowserStack sont celles rapportées par la V1 : les captures originales et les logs du tenant n'ont pas été réexaminés ici.

## 1. Conclusion

Le défaut certain est un refresh bas privilège public sans exclusion mutuelle ni garde contre une valeur vide, effectivement appelé par deux ViewModels. La concurrence peut expliquer une réutilisation de refresh token, mais n'est pas une preuve de la cause du 403 du build 26.09.0.

Le correctif recommandé doit traiter trois problèmes différents : empêcher les échanges concurrents d'une même session, empêcher une réponse ancienne de modifier une nouvelle session, et organiser une reconnexion lorsque le refresh est définitivement refusé. Ajouter seulement un Mutex au refresh ne couvre pas ces trois exigences.

Le symptôme « fonctionne pendant 20 minutes » reste à reproduire. Il peut correspondre au premier besoin de renouvellement d'un access token, sans que le refresh token ait lui-même une durée de vie de 20 minutes. Les deux écrans étudiés forcent toutefois le refresh avant même l'expiration : le lien temporel exact n'est donc pas établi.

## 2. Sources et limites concrètes du dépôt

Les chemins ci-dessous sont relatifs à `ad-digital-mobile-aio`. Les numéros de ligne correspondent à la lecture du 15 octobre et peuvent évoluer.

| Source | Observation vérifiée |
| --- | --- |
| `shared/src/commonMain/kotlin/com/desjardins/assurancedommages/mobile/feature/authenticate/data/repository/LowPrivilegeTokenRepository.kt:73` | `getOrRefreshAccessToken` verrouille, teste l'expiration et refuse un refresh vide. |
| Même fichier, ligne 113 | `refreshAccessToken` lit puis envoie le refresh token sans verrou ni garde. |
| Même fichier, lignes 123–126 et 181–184 | Refresh et connexion écrivent séparément access et refresh. |
| Même fichier, ligne 205 | `clearTokens` efface les deux data sources sans coordination avec les requêtes en cours. Aucun appelant trouvé dans les sources applicatives locales. |
| `shared/src/commonMain/kotlin/ca/dgag/ajusto/profile/domain/authentication/ProfileAuthenticationViewModel.kt:90` | Refresh forcé à l'ouverture et au retour de modification ; tout échec devient `hasError`. Fichier explicitement marqué comme reconstitué. |
| `shared/src/commonMain/kotlin/com/desjardins/assurancedommages/mobile/feature/authenticate/presentation/login/LoginHighPrivilegeViewModel.kt:63` | Refresh forcé pour l'email avant le flux haut privilège. Tout échec devient une erreur technique. |
| `.../feature/authenticate/domain/manager/AuthSessionManager.kt:65` | La connexion appelle `fetchTokens`, puis valide les claims. `createSessionByBrand` lit directement l'access token ; il ne le renouvelle pas. |
| `.../feature/authenticate/data/datasource/TokensDataSource.kt:10` | Fichier présent : délégation à `authDataSource`, clé `LowPrivilegeTokens`, `Storage` injecté. |
| `shared/src/commonMain/kotlin/ca/dgag/ajusto/kore/data/repository/datasource/DataSourceUtils.kt:24` | Construction de `StorageReadWriteStatFlowProperty` pour les données authentifiées. |
| `.../kore/data/repository/StorageReadWriteStatFlowProperty.kt` | Mise à jour du stockage puis du StateFlow ; appel également au setter parent. Pas de transaction lisible couvrant tout le cycle read/copy/write. |
| `.../kore/data/repository/StorageReadWriteProperty.kt` | Contient seulement la déclaration du package. |
| `.../kore/data/repository/datasource/AbstractAuthDataSource.kt`, `AuthDataSourceV2.kt` | Fichiers vides. Impossible de reconstituer les garanties du stockage ou son effacement collectif. |
| `.../feature/authenticate/data/http/TokenHttpService.kt:37` | Transmet directement le refresh token à `TokenHttpRequest`. |
| `.../feature/authenticate/data/http/TokenHttpRequest.kt:60` | Ajoute la valeur au formulaire sans garde. |
| `.../feature/authenticate/data/http/TokenHttpClientProcessor.kt` | Le traitement visible transforme certaines exceptions en erreur générique. Le contexte du client HTTP est utilisé ; le comportement d'annulation doit être testé sur la branche complète. |
| `.../feature/authenticate/data/dto/TokenError.kt` | Les champs locaux s'appellent `error` et `errorDescription`. |
| `.../feature/authenticate/data/repository/LowPrivilegeTokenRepository.kt:147` | Le repository utilise `auth0Code` et `auth0Description`, sans définition retrouvée dans les sources shared. Incohérence du snapshot local. |
| `.../feature/authenticate/data/dto/TokenResponse.kt` | `refreshToken` est bien `String? = null`. Ce type n'est plus à deviner. |

Le binding DI de `LowPrivilegeTokenRepository`/`TokensDataSource` n'a pas été retrouvé dans les sources parcourues. On ne peut donc pas certifier qu'il existe une seule instance du repository par session. Un Mutex par instance n'aide pas si plusieurs instances gèrent le même stockage.

Le commentaire « in-memory » du repository ne suffit pas à prouver un stockage exclusivement mémoire. L'interface `Storage` peut être implémentée de plusieurs façons. Le stockage effectif, la persistance et la réaction à une erreur d'écriture restent à confirmer sur le vrai checkout.

Il existe un source set `commonTest` dans `shared/build.gradle.kts`, avec un bundle de dépendances de test. Aucun test du repository n'a été repéré dans le périmètre inspecté. Le projet local est incomplet ; aucune compilation Android/iOS n'est revendiquée.

## 3. Les chaînes d'appel réellement suivies

### Profil Authentification

`onCreate` / `onActive` après modification → `refreshData` → `refreshAccessToken` → `TokenHttpFacade.refreshLowPrivilegeTokens` → service → requête POST `/oauth/token`.

Le commentaire du ViewModel justifie le refresh forcé pour actualiser le profil. Remplacer aveuglément cet appel par « uniquement si expiré » peut laisser un ancien email affiché.

### Login haut privilège / OCS

`LoginHighPrivilegeViewModel.onCreate` → refresh bas privilège → seulement en cas de succès, `resolveAuthenticationFlow` → sélection du flux haut privilège, avec ou sans biométrie.

Le refresh échoue donc AVANT cette sélection. L'observation « sans biométrie » ne prouve pas que la biométrie est la cause du défaut ; elle peut seulement modifier les parcours et les délais.

### Nous joindre → Nous écrire

Le presenter iOS legacy (`iosApp/App/Legacy/Features/Contact/ContactPresenter.swift:98`) transforme `ContactReactionNavigateToEmailUs` en `shouldShowWriteUs = true`. La vue moderne `ContactUsView.swift` présente `ContactEmailView`. Aucun appel direct au refresh bas privilège n'a été établi dans ces fragments. Des fichiers ViewModel du module contactus sont incomplets. Le lien jusqu'à `/oauth/token` reste non démontré : ne pas attribuer ce parcours au même appelant sans une trace de navigation et réseau.

### Déconnexion

Android `ProfilePreferencesFragment.logoutOperation` passe par `logoutNavigationCoordinator.runManualLogout`, puis `authService.logout()`. L'interface `AuthService` expose une déconnexion synchrone, mais `KoreAuthService.kt` est vide dans ce snapshot. Il manque donc le raccordement entre déconnexion globale, data sources et jetons bas privilège.

## 4. Défauts et scénarios

### A. Jeton vide envoyé : défaut démontré

Le chemin public peut transmettre `refresh_token=`. Une garde locale empêche cet appel ; elle ne répare pas la session et n'explique pas la disparition du jeton. L'application doit demander une reconnexion bas privilège.

### B. Deux échanges du même refresh token : risque démontré

A lit R1 et suspend sur le réseau. B lit R1 avant l'enregistrement de R2. Si la rotation et la détection de réutilisation s'appliquent, le serveur peut refuser B et invalider la famille. La configuration du tenant et les logs sont nécessaires pour associer ce scénario au 403 réel.

### C. Une réponse ancienne écrase une connexion récente : risque de structure

A renouvelle les jetons de la session S1. Une connexion installe S2. A revient et écrit les jetons S1. `applyTokens` en une seule affectation ne protège pas contre ce cas : il faut une génération de session et une validation au moment de l'écriture.

Même problème avec une déconnexion pendant le réseau : sans garde de génération, une réponse réussie peut recréer les jetons effacés. La reachabilité exacte dépend des intégrations manquantes, mais le repository n'offre aujourd'hui aucune protection.

### D. Une nouvelle connexion hérite du refresh token précédent

`fetchTokens` conserve implicitement l'ancien refresh token lorsque la réponse n'en contient pas. C'est acceptable pour un renouvellement d'une même session si le contrat serveur l'autorise ; ce n'est pas une bonne règle pour une nouvelle connexion. On peut produire access(S2) + refresh(S1). La V1 reproduit ce comportement en utilisant le même helper pour les deux opérations. La V2 sépare les deux politiques.

### E. Erreurs métier et erreurs HTTP

Le mapping actuel regroupe tout 401/403 sous `UNAUTHORIZED`, sans traiter explicitement `invalid_grant` indépendamment du statut HTTP. La cause doit être identifiée via le code OAuth réellement parsé. Un refus de configuration et une session expirée ne demandent pas le même traitement.

Les champs divergents `auth0Code`/`error` imposent d'abord de vérifier le contrat DTO réel. Une capture HTTP correcte ne garantit pas que l'application a correctement parsé le corps.

### F. Annulation / réponse perdue après rotation

Même avec une seule requête, le serveur peut avoir consommé R1 tandis que l'application n'enregistre jamais R2 : fermeture d'écran, timeout, perte réseau ou échec de stockage. Une nouvelle tentative avec R1 peut alors échouer. Le Mutex seul ne fournit pas une garantie « exactement une fois » avec un serveur distant.

## 5. Corrections apportées à la V1

- `TokensDataSource` et `TokenHttpService` existent et ont été lus ; leurs dépendances restent partiellement absentes.
- Un refresh token n'est à usage unique que sous une politique de rotation appropriée ; ne pas généraliser cette propriété.
- Comparer R1 et R2 déduplique seulement si la valeur change. Un succès sans rotation reste un cas valide à traiter.
- Un seul appel visible lors du 403 n'exclut pas une réutilisation plus ancienne ou une réponse perdue.
- Une affectation de `Tokens` ne prouve ni une transaction persistante ni l'absence d'autres écrivains.
- Le résumé V1 « pas de traitement du 403 » est trop large : le repository le classe déjà ; c'est la restitution dans les écrans qui perd la distinction, sous réserve de l'incohérence DTO locale.
- Une nouvelle connexion ne doit pas réutiliser par défaut le refresh token de l'ancienne.

## 6. Comment confirmer l'incident de production

Instrumenter des identifiants aléatoires de session et de tentative, la génération locale, le point d'entrée, l'heure, le statut HTTP et le code OAuth. Ne pas journaliser les access/refresh tokens, les codes PKCE ou les corps complets.

Comparer les événements depuis la dernière connexion : nombre de démarrages et de partages d'une tentative, changements de session, réussite réseau, réussite d'enregistrement, invalidations et reconnexions. Corréler les identifiants de requête serveur disponibles avec les logs Auth0 et les événements de réutilisation. Vérifier rotation, période de tolérance, durée absolue/inactivité du refresh, et différences de client/tenant entre UAT2 et Prod-BETA.

Reproduire successivement : accès immédiat après connexion, accès après expiration, deux écrans concurrents, retour de webview, mise en arrière-plan pendant le refresh, déconnexion/reconnexion pendant le réseau. Comparer au build antérieur avec les mêmes paramètres. La durée de 20 minutes et l'effet du killswipe restent des observations à expliquer, pas des preuves d'une configuration Auth0 fautive.

## 7. Décision proposée

Adopter un coordinateur unique bas privilège : résultat partagé pendant un refresh, état de jetons cohérent, génération de session, invalidation sur refus définitif, reconnexion bas privilège centralisée. Voir [la proposition](proposition-solution.md), [le noyau Kotlin proposé](code-propose/LowPrivilegeRefreshCoordinator.kt) et [le plan de validation](tests-et-validation.md).

Référence externe : [Auth0 — Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation). Elle décrit le mécanisme possible ; elle ne fournit pas la configuration de ce tenant.
