# WRU-26487 — Ne plus reproposer la biométrie après une annulation puis un login manuel

## Problème
- Compte V2, biométrie activée, app tuée, accès via le bouton de bascule.
- L'utilisateur **annule** l'invite biométrique, puis se connecte avec courriel + mot de passe.
- L'app lui **repropose la biométrie** juste après le login (2e invite), alors qu'il vient de s'authentifier.

## Cause
- Après le login manuel, `LoginHighPrivilegeViewModel` ne testait que `isBiometricsEnabledOnApp()` (le drapeau « activé »).
- Il relançait donc la réécriture du jeton avec la biométrie ; la clé n'accepte une écriture sans invite que pendant 60 s, donc l'invite s'affichait.
- Rien ne retenait que l'utilisateur venait d'annuler l'invite de lecture.

## Changements
- `LoginHighPrivilegeViewModel.kt` (3 changements) :
  - nouvelle variable `biometricsDeclinedDuringThisLogin` (faux au départ, vit le temps de l'écran de login) ;
  - dans `handleWithBiometrics.onFailure`, elle passe à vrai si l'erreur est `USER_CANCELED` ou `VERIFICATION_FAILED` ;
  - la condition après le login devient `isBiometricsEnabledOnApp() && !biometricsDeclinedDuringThisLogin` : si l'utilisateur a refusé, on ouvre l'OCS sans réécrire le jeton.
- `LoginHighPrivilegeViewModelTest.kt` : 4 tests + une fonction utilitaire.
  - `USER_CANCELED` et `VERIFICATION_FAILED` → `OpenOcs` (pas de 2e invite) ;
  - `INVALID_STORAGE` et `KEY_INVALIDATED` → `RefreshTokenFetchedWithoutOcs` (non-régression).

## Ce qui ne change pas
- La 2e invite reste quand le jeton stocké est inutilisable (`INVALID_STORAGE`, `KEY_INVALIDATED`, jeton refusé 401/403) : la réécriture est alors nécessaire.
- Activation par le toggle du Profil, reconnexion biométrique réussie, biométrie désactivée : inchangés.
- Aucun changement dans l'Activity Android, le code iOS ni le stockage biométrique (le code partagé couvre les deux plateformes).

## À vérifier avant de fusionner
- Lancer les tests : `./gradlew :shared:testDebugUnitTest --tests "*LoginHighPrivilegeViewModelTest"` (non exécutés par moi, pas de Gradle disponible).
- Sur appareil : annuler l'invite → courriel + mot de passe → aucune 2e invite, l'OCS s'ouvre.
- Auth0 : le jeton déjà stocké doit rester valable après un nouveau login (non vérifiable depuis le code).
- iOS : non testé ; l'annulation y est aussi `USER_CANCELED`.

## Hors périmètre (noté)
- Le log « prompt cancelled » de `onRefreshTokenSavedFailure` teste `VERIFICATION_FAILED` au lieu de `USER_CANCELED` (cosmétique).
