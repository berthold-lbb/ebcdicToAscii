# WRU-25865 — Incapable d'activer la biométrie après un changement de biométrie système

**Statut : proposition en attente de validation. Aucun fichier original modifié.**

Ce dossier contient une copie des fichiers à corriger, avec le correctif appliqué et commenté
(repère `WRU-25865` à chaque endroit touché). L'arborescence sous `src/` reproduit celle du dépôt,
donc chaque fichier indique de lui-même où il doit être reporté.

---

## 1. Cause racine

La clé AES du Keystore est liée au **SID biométrique** existant au moment de sa création.
Supprimer puis réenrôler ses empreintes génère un **nouveau SID** : la clé reste présente
(`keyStore.containsAlias()` retourne toujours `true`, donc `generatedKeyIfNeeded()` ne la régénère
pas) mais **plus aucune authentification ne peut l'autoriser**.

Android remonte `UserNotAuthenticatedException` — et non `KeyPermanentlyInvalidatedException` —
parce que la clé est configurée avec une **fenêtre de validité de 60 s**
(`setUserAuthenticationParameters(60, AUTH_BIOMETRIC_STRONG)`) et non en authentification par usage.
Ce message trompeur laisse croire à un simple problème d'authentification : `putString()` réaffiche
donc le prompt biométrique et réessaie **avec la même clé morte**.

Ce 2e essai était hors de tout `try/catch` → l'exception remontait non rattrapée jusqu'à la
coroutine et **tuait le processus complet de l'app** (`FATAL EXCEPTION` en QA).

### Séquence confirmée

1. Écran Profil → `handleToggleBiometrics()` → `biometricsRepository.activate()`
2. `activate()` fait un auto-test interne avec `ACTIVATION_TEST_KEY` (`getString` puis `putString`)
3. `putString()` : 1er essai échoue → prompt biométrique → 2e essai → **crash**
4. L'écran de connexion (`LoginHighPrivilegeActivity`) n'est **jamais ouvert**, donc
   `setBiometricsEnabledOnApp(true)` n'est jamais appelé et le toggle reste désactivé

### Indice de confirmation

Le développeur d'origine avait identifié ce cas et l'avait traité **côté lecture** (`getString()`,
avec un commentaire explicite). Le traitement manquait uniquement **côté écriture** (`putString()`).
Le correctif applique d'un côté ce qui existait déjà de l'autre — il n'introduit pas de mécanique
nouvelle.

---

## 2. Fichiers modifiés

| # | Fichier | Lignes (dans la copie corrigée) | Nature |
|---|---------|----------------------------------|--------|
| 1 | `BiometryProtectedStorage.kt` | 37 | Nouveau cas `KEY_INVALIDATED(code = 6)` |
| 2 | `PlatformBiometryProtectedStorage.android.kt` | 7, 112, 150, 164, 321 | Cœur du correctif |
| 3 | `BiometricsRepository.kt` | 63 | Resynchronisation du toggle |
| 4 | `LoginHighPrivilegeViewModel.kt` | 27, 178 | Fallback login manuel |

### Détail par fichier

**1. `BiometryProtectedStorage.kt` — ligne 37**
Ajout de `KEY_INVALIDATED` à l'enum `BiometryError`. Distinct de `INVALID_STORAGE` (stockage vide
ou illisible) car ce cas exige une action spécifique côté appelant.
*Vérifié : aucun `when` exhaustif sur `BiometryError` dans le dépôt — ni Android ni iOS ne cassent.*

**2. `PlatformBiometryProtectedStorage.android.kt`**
- ligne 7 — import de `KeyPermanentlyInvalidatedException`
- ligne 112 — `getString()` remonte `KEY_INVALIDATED` quand il déclenche `resetStorage()`
- ligne 150 — **le point de crash** : l'appel nu à `encryptData()` devient `retryPutStringAfterPrompt()`
- ligne 164 — nouvelle méthode `retryPutStringAfterPrompt()` : 2e essai protégé, puis
  `resetStorage()` + régénération de clé + 3e essai
- ligne 321 — `isUserNotAuthenticated()` renommé `isKeyInvalidated()` et élargi à
  `KeyPermanentlyInvalidatedException`

**3. `BiometricsRepository.kt` — ligne 63**
Sur `KEY_INVALIDATED`, appel à `setBiometricsEnabledOnApp(false)`.
`resetStorage()` vide le stockage chiffré mais ne touche pas au drapeau « biométrie activée », qui
vit dans `BiometricsDataSource`. Sans cette ligne, le toggle afficherait « activé » alors que la
biométrie ne fonctionne plus.
*`biometricsEnabledFlow` étant un `Flow` collecté par `ProfileAuthenticationViewModel`, le toggle se
met à jour automatiquement — aucune plomberie UI supplémentaire.*

**4. `LoginHighPrivilegeViewModel.kt` — lignes 27 et 178**
`KEY_INVALIDATED` ajouté à la condition de `handleWithBiometrics()`. Sans lui, ce cas tomberait dans
le `else` et afficherait une erreur technique générique au lieu du modal de connexion manuelle, qui
est la bonne sortie (le refresh token est irrécupérable).

---

## 3. Non inclus dans ce correctif

**Message d'erreur visible sur échec persistant.** `ProfileAuthenticationReaction.BiometryFailed`
tombe aujourd'hui dans le `else -> Unit` de `ProfileAuthenticationActivity.handleReaction()` : aucun
message n'est affiché, même dans le cas d'un échec propre (annulation du prompt par l'utilisateur).

Écarté de ce ticket pour trois raisons :
- c'est un manque **préexistant**, indépendant du crash — il se déclenche déjà aujourd'hui lorsqu'un
  utilisateur annule simplement le prompt biométrique
- après le correctif, ce cas devient rare : la branche « échec persistant » ne se déclenche que si la
  régénération de clé échoue elle aussi
- le texte reste bloqué : `ProfileLocalizedString` n'est pas un fichier source, il est généré depuis
  `translations-kore.json`, lui-même reconstitué à ~67 lignes sur 9631 et non valide en l'état

Périmètre réel si on décidait de le traiter (4 fichiers supplémentaires) :
`ProfileAuthenticationUiStateData.kt` (nouveau champ `hasBiometricsError` — le fichier est désormais
disponible, ce blocage est levé), `ProfileAuthenticationAction.kt` (action de fermeture),
`ProfileAuthenticationViewModel.kt` (lever le drapeau et gérer la fermeture),
`ProfileAuthenticationUiStateProvider.kt` (rendu du modal).

Point d'attention relevé en analysant ce chemin : le modal existant utilise l'action `OkError`, qui
déclenche `Close` dans le ViewModel — donc **ferme tout l'écran Profil**. Correct pour une erreur
serveur empêchant le chargement, mais inadapté à un échec de biométrie, où l'utilisateur doit rester
sur Profil. D'où la nécessité d'une action de fermeture distincte.

**Aligner Android sur le comportement d'iOS.** iOS ne subit pas ce bug parce qu'il utilise
`kSecAccessControlBiometryAny`, qui tolère un changement d'enrôlement.

Attention au faux ami : `setInvalidatedByBiometricEnrollment(false)` **ne serait pas** l'équivalent
Android. Ce réglage ne s'applique qu'aux clés en authentification **par usage** (validity duration
= -1) ; la nôtre est à fenêtre de validité (60 s), il serait donc ignoré. Et surtout il agit sur la
*destruction* de la clé, alors que notre problème est une *liaison à un SID périmé* — deux
mécanismes distincts. Le type d'exception le confirme : `UserNotAuthenticatedException` et non
`KeyPermanentlyInvalidatedException`.

Ce qui fonctionnerait : inclure `AUTH_DEVICE_CREDENTIAL` dans
`setUserAuthenticationParameters(60, AUTH_BIOMETRIC_STRONG or AUTH_DEVICE_CREDENTIAL)`. Le SID du
code d'appareil ne change pas lors d'un réenrôlement biométrique, donc la clé survivrait. Mais elle
deviendrait alors déverrouillable au code PIN, ce qu'un utilisateur ayant activé « connexion par
biométrie » n'attend pas nécessairement. **Décision produit et sécurité d'équipe, hors périmètre de
ce correctif** — et à valider sur appareil avant toute décision.

Dans tous les cas, cela ne remplace pas le correctif : il faut de toute façon gérer le moment où la
clé devient inutilisable (un changement de code PIN produirait le même effet).

**`setAllowedAuthenticators()` et alignement de l'éligibilité sur Classe 3.** Envisagés puis écartés :
ne corrigent pas ce bug (l'utilisateur s'authentifie à l'empreinte, déjà Classe 3), et le changement
d'éligibilité ferait disparaître la section biométrie sur certains appareils.

---

## 4. Plan de test

1. **Scénario du ticket** : activer la biométrie → tuer l'app → supprimer et réenrôler l'empreinte
   dans les réglages → rouvrir l'app → réactiver le toggle. Attendu : plus de crash, l'écran de
   connexion s'ouvre, le toggle passe à « activé ».
2. **Point à confirmer sur appareil** : que le 3e essai (clé fraîche) réussisse sans redemander un
   prompt biométrique. La fenêtre de 60 s doit couvrir l'authentification qui vient de réussir.
3. **Chemin silencieux** : biométrie déjà activée → changer l'empreinte → rouvrir l'app. Attendu :
   modal de connexion manuelle et toggle repassé à « désactivé » tout seul.
4. **Annulation du prompt** par l'utilisateur → `VERIFICATION_FAILED`, pas de crash.
5. **Non-régression** : activation et reconnexion biométrique normales, sans changement d'empreinte.

---

## 5. Application

Les fichiers sous `src/` sont des copies complètes, prêtes à remplacer les originaux à chemin
identique. Les commentaires `WRU-25865` peuvent être conservés (ils documentent le pourquoi) ou
allégés avant le commit, au choix.
