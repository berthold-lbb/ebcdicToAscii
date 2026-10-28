# WRU-26487 — 2e invite biométrique après un login courriel / mot de passe

**Statut : proposition en attente de validation. Aucun fichier original modifié.**
**Révisée le 2026-10-27 après relecture du code à jour** (voir §0 : la 1re version était fausse sur un point).

Ce dossier contient une copie du fichier à corriger, avec le correctif appliqué et commenté
(repère `WRU-26487` à chaque endroit touché). L'arborescence sous `src/` reproduit celle du dépôt.
Le détail des chemins d'appel est dans `analyse-biometrie-reproposee.md`.

---

## 0. Ce qui a changé par rapport à la 1re version

| Constat (code actuel du dépôt) | Conséquence |
|---|---|
| L'annulation de l'invite est maintenant `USER_CANCELED` (Android : `ERROR_USER_CANCELED`, `ERROR_NEGATIVE_BUTTON`, `ERROR_CANCELED`, storage l. 341-344 ; iOS : `LAErrorUserCancel`, `.ios.kt` l. 276). `VERIFICATION_FAILED` ne couvre plus que les autres erreurs et `onAuthenticationFailed`. | La 1re version testait seulement `VERIFICATION_FAILED` : elle **n'aurait pas corrigé le cas du ticket** (annulation). Corrigé : le correctif couvre `USER_CANCELED` **et** `VERIFICATION_FAILED`. |
| `handleWithBiometrics` utilise maintenant `MANUAL_LOGIN_RECOVERABLE_ERRORS = {USER_CANCELED, VERIFICATION_FAILED, INVALID_STORAGE, KEY_INVALIDATED}` (VM l. 214 et 369-370). | Le correctif s'appuie sur ce même point d'entrée et ajoute un sous-ensemble. |
| WRU-25865 est maintenant dans le dépôt (`KEY_INVALIDATED`, `retryPutStringAfterPrompt`). | Le conflit de fusion annoncé n'existe plus. |
| Le ViewModel a changé (`resolvedOcsUrl`, `EMAIL_NOT_VERIFIED`, `isRedirectError`, nouvelles exceptions). | La copie `src/` est **régénérée à partir du fichier actuel** ; les numéros de ligne ci-dessous sont les nouveaux. |
| `LoginHighPrivilegeActivity` utilise bien `GetRefreshTokenWithBiometrics` ; l'incohérence relevée en 1re version a disparu. | Point retiré. |

## 1. Comportement attendu (décision de Ken)

Quand l'utilisateur **annule la 1re invite biométrique** puis se connecte avec son courriel et son
mot de passe, l'app **ne doit plus** lui reproposer la biométrie : il vient déjà de s'authentifier.

## 2. Cause racine (confirmée sur le code actuel)

Après le login manuel, `handleRedirectLoadedAuthWithRefreshToken()` (VM l. 340) ne regarde qu'une
chose : `biometricsRepository.isBiometricsEnabledOnApp()` (le drapeau persistant « activé »). Il
émet `RefreshTokenFetchedWithoutOcs` → l'Activity appelle `setRefreshTokenToBio()` (Activity
l. 74-79, 120-129) → `putString()`. La clé Keystore n'accepte une écriture sans invite que pendant
60 s après la dernière authentification (`BIOMETRY_SESSION_VALIDITY_TIME_SPAN_SECONDS = 60`, storage
l. 406) ; la saisie du mot de passe dépasse presque toujours ce délai, donc `promptBiometry()` est
appelé (storage l. 145).

Rien ne mémorise que l'utilisateur a **annulé** l'invite de lecture quelques secondes plus tôt. Le
commentaire de la l. 367-368 (« qui resauvegardera le jeton en biométrie ») décrit l'intention pour
`INVALID_STORAGE` et `KEY_INVALIDATED` ; pour une simple annulation, la réécriture est inutile
puisque le jeton stocké est intact.

### Séquence confirmée par les captures du ticket

1. Bascule → `HighPrivilegeWithOcs`, TTL expiré, biométrie activée → invite de lecture
2. Annulation → `USER_CANCELED` → modal « Se connecter manuellement ? »
3. Login courriel + mot de passe → `RedirectLoaded`
4. **2e invite**, affichée par-dessus la page de login (l'OCS n'est pas encore ouvert)
5. Accepter ou refuser mène au même résultat : `OpenOcs` (VM l. 302 et 313)

## 3. Fichier modifié

Fichier : `shared/src/commonMain/kotlin/com/desjardins/assurancedommages/mobile/feature/authenticate/presentation/login/LoginHighPrivilegeViewModel.kt`

| # | Lignes (copie corrigée) | Lignes (original) | Nature |
|---|---|---|---|
| 1 | 65-72 | avant l. 65 (`init {`) | Nouveau champ `biometricsDeclinedDuringThisLogin` |
| 2 | 224-225 | avant l. 215 | Dans `handleWithBiometrics.onFailure` : `biometricsDeclinedDuringThisLogin = exc.error in BIOMETRIC_PROMPT_DECLINED_ERRORS` |
| 3 | 351-353 | 340 | Condition : `isBiometricsEnabledOnApp() && !biometricsDeclinedDuringThisLogin` |
| 4 | 385-388 | après l. 370 | Nouvelle constante `BIOMETRIC_PROMPT_DECLINED_ERRORS = setOf(USER_CANCELED, VERIFICATION_FAILED)` |

### Pourquoi chaque modification

- **Champ** : retient l'événement « refus explicite » le temps de cet écran de login (il disparaît
  avec le ViewModel).
- **`onFailure`** : seules l'annulation et l'échec d'invite marquent le refus. Pour
  `INVALID_STORAGE`, `KEY_INVALIDATED` et `Unauthorized`, le jeton stocké est inutilisable : la
  réécriture, donc l'invite, reste nécessaire, sinon le prochain lancement retomberait dans le même
  échec.
- **Condition** : si l'utilisateur a refusé, on passe à `OpenOcs` (comme quand la biométrie est
  désactivée) au lieu de `RefreshTokenFetchedWithoutOcs`.
- **Constante** : nomme le sous-ensemble « jeton intact » à côté de `MANUAL_LOGIN_RECOVERABLE_ERRORS`.

### Pas de changement nécessaire dans

- `LoginHighPrivilegeActivity.kt` (Android) et `HighPrivilegeAuthManager.swift` (iOS) : ils réagissent
  aux réactions du ViewModel. Le correctif est dans le code partagé.
- `PlatformBiometryProtectedStorage.android.kt` : la fenêtre de 60 s est un choix de sécurité.

---

## 4. Non inclus dans ce correctif

- **Les cas où la 2e invite reste voulue** : `INVALID_STORAGE`, `KEY_INVALIDATED`, jeton refusé
  (401/403). L'invite sert alors à stocker un nouveau jeton. La supprimer exigerait un autre
  comportement de fond (décision produit).
- **Toggle du Profil** (`HighPrivilegeWithoutOcs`) : l'invite finale y est nécessaire. Inchangé.
- **Message de log** `onRefreshTokenSavedFailure` (VM l. 308) : il teste `VERIFICATION_FAILED` pour
  écrire « prompt cancelled », alors qu'une annulation est maintenant `USER_CANCELED`. Cosmétique
  (log seulement), hors périmètre, à signaler.

---

## 5. Points à confirmer

1. **Le jeton stocké reste valable après un nouveau login** : le correctif le suppose. Cela dépend de
   la rotation des jetons Auth0, non vérifiable depuis le code. À confirmer côté backend.
2. **iOS** : l'annulation y est aussi `USER_CANCELED` (`.ios.kt` l. 276), donc la logique partagée
   s'applique. Je n'ai **pas vérifié** si l'écriture iOS (`putString`) affiche une invite après le
   login manuel ; le correctif est neutre si elle n'en affiche pas.
3. **Compilation et tests** : rien n'a été compilé ni exécuté (pas de Gradle ici). Les tests de §6 sont
   écrits d'après les tests existants, à ajuster au besoin.

---

## 6. Tests à ajouter (non compilés, d'après `LoginHighPrivilegeViewModelTest.kt`)

À placer après le test de la l. 507 (même style que les l. 464-507 et 1047-1093).
**Illustratif** : l'URL attendue dépend du mock de `giaRepository.resolveOcsUrl`.

```kotlin
// WRU-26487 : annulation de l'invite puis login manuel -> pas de 2e invite
@Test
fun `emit OpenOcs when RedirectLoaded after biometrics prompt was canceled`() = runTest(testDispatcher) {
    coEvery {
        highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
    } returns Result.failure(BiometricsException(BiometryProtectedStorage.BiometryError.USER_CANCELED))
    coEvery {
        highPrivilegeTokenRepository.fetchTokens(authorizationCode = any(), codeVerifier = any())
    } returns Result.success(
        TokenResponse(
            accessToken = ACCESS_TOKEN,
            refreshToken = REFRESH_TOKEN,
            expiresIn = 10,
            issuedTokenType = "issued-token-type"
        )
    )
    every { biometricsRepository.isBiometricsEnabledOnApp() } returns true

    val viewModel = LoginHighPrivilegeViewModel(
        giaRepository = giaRepository,
        lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
        highPrivilegeTokenRepository = highPrivilegeTokenRepository,
        biometricsRepository = biometricsRepository,
        uiStatesProvider = uiStatesProvider,
        sessionManager = securityManager,
        accessManager = accessManager,
        serviceUrlsDataSource = serviceUrlsDataSource,
        state = LoginInitState.HighPrivilegeWithOcs(OCS_URL),
        ttlManager = ttlManager,
        dispatcher = testDispatcher
    )

    viewModel.handleAction(
        LoginAction.GetRefreshTokenWithBiometrics(OCS_URL, BiometryPromptContextType.IOS, REF)
    )
    advanceUntilIdle()

    viewModel.reactionStateFlow.test {
        assertEquals(LoginReaction.Nothing, awaitItem())
        viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))
        advanceUntilIdle()
        assertEquals(LoginReaction.OpenOcs(OCS_URL), awaitItem())   // à ajuster selon resolveOcsUrl
    }
}
```

Test de non-régression : même corps avec `BiometryError.INVALID_STORAGE` (et un second avec
`KEY_INVALIDATED`), l'assertion devient
`LoginReaction.RefreshTokenFetchedWithoutOcs(refreshToken = REFRESH_TOKEN, ocsUrlToOpen = OCS_URL)`.

Tests existants : `show manual when biometry fails…` (l. 465) et `emit RefreshTokenFetchedWithoutOcs
when RedirectLoaded and biometrics enabled` (l. 1048) ne sont pas affectés par le correctif
(le drapeau reste faux sans refus préalable), **sans exécution pour le confirmer**.

## 7. Plan de test sur appareil

1. **Ticket** : biométrie activée → tuer l'app → bascule → **annuler** l'invite → « Se connecter
   manuellement » → courriel + mot de passe. Attendu : **aucune 2e invite**, l'OCS s'ouvre.
2. Empreinte refusée (au lieu d'annuler) : même résultat.
3. Empreinte acceptée : inchangé (transfert de session).
4. Jeton refusé (401/403) puis login manuel : la 2e invite reste (réécriture nécessaire).
5. Changement d'empreinte (`KEY_INVALIDATED`) puis login manuel : la 2e invite reste.
6. Toggle du Profil : l'invite finale s'affiche toujours.
7. Biométrie désactivée : inchangé.

## 8. Application

Le fichier sous `src/` est une copie complète du fichier **actuel** du dépôt, prête à le remplacer
à chemin identique. Les commentaires `WRU-26487` peuvent être conservés ou allégés avant le commit.
