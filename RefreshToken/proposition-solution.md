# Bug de refresh token — proposition de solution et explications

- **Date** : 2026-10-15
- **Analyse associée** : [`analyse-refresh-token.md`](analyse-refresh-token.md) (contexte, preuves, lecture du code)
- **Statut** : proposition. **Aucun fichier de code n'a été modifié.** Les extraits ci-dessous ne sont ni compilés ni testés.
- **Limite de lecture** : les signatures de `Token`, `Tokens`, `TokenResponse` et `TokensDataSource` sont déduites des usages lus. `TokensDataSource` est introuvable dans le dépôt local.

---

## 1. En une phrase

Tous les écrans doivent passer par **une seule porte** pour rafraîchir le jeton. Cette porte les fait passer un par un, vérifie à chaque fois si quelqu'un vient déjà de le faire, et refuse d'appeler Auth0 quand le jeton est vide.

## 2. Pourquoi cette solution : le problème en bref

| Problème (voir l'analyse, section 6) | Cause dans le code | Ce qui le corrige |
| --- | --- | --- |
| 400 `invalid_request` | `refreshAccessToken` envoie un jeton vide (`Tokens.kt` l.7, `LowPrivilegeTokenRepository.kt` l.114 et l.121) | Garde « jeton vide » dans `refreshAccessToken` |
| 403 `invalid_grant` après deux refresh simultanés | Aucun verrou : le second appelant lit l'ancien jeton R1 déjà consommé | Verrou + comparaison « déjà rafraîchi » dans `refreshAccessToken` |
| État intermédiaire des jetons | `setAccessToken` puis `setRefreshToken` : deux écritures séparées | Une seule écriture (`applyTokens`) |
| « Problème technique » sur une session expirée | Les appelants ne distinguent que `SUCCESS` | Traitement distinct de `UNAUTHORIZED` |

La fonction protégée `getOrRefreshAccessToken` existe déjà avec verrou et garde, mais **aucun appelant ne l'utilise**. La solution ne réinvente rien : elle met ces protections dans la fonction que les écrans appellent réellement.

## 3. Trois options

| Option | Contenu | Ce qu'elle règle | Ce qu'elle ne règle pas |
| --- | --- | --- | --- |
| A — minimale | Changements 1 et 2, dans un seul fichier | Le 400, et les 403 dus à la course entre deux refresh | Un vrai 403 (session ou jeton réellement invalide) reste affiché « Problème technique » |
| B — A + reconnexion | A + changement 3 | Un vrai 403 devient un retour propre à la connexion | Nécessite une décision UX (section 8) |
| C — B + Auth0 | B + validation de la configuration Auth0 | La cause « 20 minutes », si elle vient du tenant | Dépend de l'équipe Auth0 |

**Recommandation** : commencer par A (changement local, un seul fichier, risque faible), lancer en parallèle les vérifications Auth0, puis faire B après la décision UX.

Cette recommandation est conditionnelle : si les tests BrowserStack montrent **un seul** appel `/oauth/token` au moment du 403, la course n'est pas la cause et A ne suffira pas. La piste Auth0 devient alors prioritaire.

---

## 4. Changement 1 — `LowPrivilegeTokenRepository.kt` : `refreshAccessToken` devient la porte unique

### Le code proposé

```kotlin
// Porte d'entrée unique pour les appelants (ProfileAuthenticationViewModel, LoginHighPrivilegeViewModel)
suspend fun refreshAccessToken(): RefreshTokenResult {
    // Jeton vu AVANT l'attente du verrou : sert à détecter qu'un autre appelant a déjà rafraîchi
    val tokenSeenBeforeWaiting = getToken(REFRESH).value

    return refreshMutex.withLock {
        val currentToken = getToken(REFRESH).value   // relu APRÈS l'attente

        when {
            // 1. Garde : rien à envoyer à Auth0, on évite le 400 invalid_request
            currentToken.isEmpty() -> RefreshTokenResult.UNAUTHORIZED

            // 2. Déjà rafraîchi par un appelant passé avant nous : on réutilise son résultat
            currentToken != tokenSeenBeforeWaiting && !isAccessTokenExpired() -> RefreshTokenResult.SUCCESS

            // 3. Sinon on est le premier : appel réseau
            else -> performRefresh(currentToken)
        }
    }
}

// Ancien corps de refreshAccessToken (l.113-144), sans verrou, appelé uniquement sous verrou
private suspend fun performRefresh(refreshToken: String): RefreshTokenResult = try {
    if (!tokenHttpFacade.isLowPrivilegeConfigured()) {
        val ex = LowPrivilegeTokenFetchException.MissingAuth0Configuration()
        Napier.ex(ex)
        RefreshTokenResult.FAILED
    } else {
        when (val result = tokenHttpFacade.refreshLowPrivilegeTokens(refreshToken)) {
            is Success -> {
                applyTokens(result.response.accessToken, result.response.refreshToken)  // changement 2
                RefreshTokenResult.SUCCESS
            }

            is Error -> {
                handleTokenError(result)
            }
        }
    }
} catch (e: Throwable) {
    if (e is CancellationException) throw e
    val ex = (e as? LowPrivilegeTokenFetchException)
        ?: LowPrivilegeTokenFetchException.UnexpectedFailure(
            message = e.message ?: "Low-privilege token refresh failed",
            cause = e
        )
    Napier.ex(ex)
    RefreshTokenResult.FAILED
}
```

Dans `getOrRefreshAccessToken`, remplacer l'appel de la l.85 :

```kotlin
// avant (l.85)
else -> { when (refreshAccessToken()) { ...
// après : on appelle la version sans verrou, car le verrou est déjà tenu
else -> { when (performRefresh(refreshToken)) { ...
```

Aucun nouvel import n'est nécessaire : `Mutex`, `withLock`, `CancellationException`, `Success` et `Error` sont déjà importés dans le fichier.

### Pourquoi, ligne par ligne

- **Le verrou (`withLock`)** : avec lui, l'écran B n'entre qu'une fois que A a fini d'écrire le nouveau jeton. Le trou entre la lecture (l.114) et l'écriture (l.125), où B pouvait lire l'ancien jeton, disparaît.
- **Relire le jeton après l'attente** : B lit alors R2, pas R1.
- **Comparer avec le jeton vu avant l'attente (cas 2)** : si le jeton a changé pendant qu'on attendait, A vient de rafraîchir. B repart avec `SUCCESS` sans appel réseau. Sans cette comparaison, B referait un refresh inutile avec R2. C'est valide pour Auth0 (utilisation en séquence), mais c'est un appel de trop.
- **Tester `!isAccessTokenExpired()` en plus** : on ne réutilise le résultat de l'autre que si l'access token est réellement frais.
- **La garde (cas 1)** : elle supprime le 400. Aujourd'hui `refresh_token=` vide part vers Auth0 (`TokenHttpRequest.kt` l.79).
- **Le refresh forcé est conservé** : il est voulu pour obtenir l'email à jour (commentaires de `LoginHighPrivilegeViewModel` l.63 et de `ProfileAuthenticationViewModel` l.90). On le garde, mais sérialisé.

### Le piège qui oblige à scinder la fonction

`getOrRefreshAccessToken` tient déjà le verrou (l.73) et appelle `refreshAccessToken()` (l.85). Le `Mutex` de Kotlin n'est **pas réentrant** : un même code qui reprend un verrou qu'il tient déjà attend indéfiniment.

Si `refreshAccessToken` prenait le verrou sans cette scission, l'app se bloquerait (deadlock). D'où la séparation :

- `refreshAccessToken` (publique) prend le verrou ;
- `performRefresh` (privée) ne le prend pas ;
- `getOrRefreshAccessToken`, qui tient déjà le verrou, appelle `performRefresh`.

### Le scénario du 403, rejoué avec le correctif

1. L'écran A (Authentification) prend le verrou, lit R1 et appelle Auth0.
2. L'écran B (OCS) arrive, voit le verrou pris et attend.
3. Auth0 répond à A : R2 est enregistré, le verrou est libéré.
4. B entre et relit le jeton : R2. Il diffère de R1 (le jeton vu avant l'attente) et l'access token est frais, donc B retourne `SUCCESS` sans appeler Auth0.
5. Auth0 ne voit jamais R1 deux fois : plus de réutilisation, donc plus de révocation de la chaîne.

### Limite connue

Si le premier appelant **échoue** (jeton réellement invalide), le jeton reste inchangé. Le second appelant ne tombe alors pas dans le cas 2 et refera lui aussi un appel réseau qui échouera. C'est acceptable pour une première version. Une amélioration possible est de mémoriser le dernier échec pendant quelques secondes (décision 3, section 8).

---

## 5. Changement 2 — `LowPrivilegeTokenRepository.kt` : écrire les jetons en une seule fois

### Le code proposé

```kotlin
// Une seule lecture, une seule écriture de tokensDataSource.data
private fun applyTokens(accessToken: String, refreshToken: String?) {
    val current = getTokens()
    val parsed = tokenHttpFacade.parseAccessToken(accessToken)

    tokensDataSource.data = current.copy(
        access = Token(accessToken),
        accessParsed = parsed,
        // On garde l'ancien refresh token si Auth0 n'en renvoie pas de nouveau (même logique que l.124-126)
        refresh = refreshToken?.takeIf { it.isNotEmpty() }?.let { Token(it) } ?: current.refresh
    )
    emailDataSource.data = parsed?.payload?.claims?.email.orEmpty()   // même effet que setAccessToken l.216-221
}
```

À utiliser aussi dans `fetchTokens` (l.181-184), qui écrit les mêmes deux champs :

```kotlin
// avant (l.181-185)
setAccessToken(result.response.accessToken)
if (result.response.refreshToken.isNotNullOrEmpty()) {
    setRefreshToken(result.response.refreshToken)
}
Result.success(result.response)

// après
applyTokens(result.response.accessToken, result.response.refreshToken)
Result.success(result.response)
```

### Pourquoi

Aujourd'hui `setAccessToken` (l.210) puis `setRefreshToken` (l.225) font chacun lire, copier, écrire. Ce sont deux écritures séparées. Entre les deux, la mémoire contient un nouvel access token avec l'ancien refresh token (problème 4 de l'analyse, resté une hypothèse). Une seule écriture supprime cet état intermédiaire.

### Réserves

- **Typage** : si `TokenResponse.refreshToken` est un `String` non nul, `refreshToken?.` produit seulement un avertissement du compilateur. À ajuster à la compilation.
- **Sécurité sous concurrence** : on ne peut pas confirmer que `TokensDataSource` est sûr si plusieurs coroutines l'écrivent, car il est introuvable en local.
- **`fetchTokens` n'est pas sous le verrou** : une connexion simultanée à un refresh pourrait encore s'entrelacer (décision 4, section 8).
- **`setAccessToken` et `setRefreshToken`** restent publics tant qu'on n'a pas vérifié qu'aucun autre code ne les appelle. Cette vérification n'a pas été faite.

---

## 6. Changement 3 — les deux appelants : distinguer `UNAUTHORIZED`

### Le code proposé

```kotlin
// LoginHighPrivilegeViewModel.kt, remplace l.64-70
when (lowPrivilegeTokenRepository.refreshAccessToken()) {
    RefreshTokenResult.SUCCESS -> resolveAuthenticationFlow()

    // Session expirée : pas une panne. Comportement exact à confirmer (section 8, décision 1)
    RefreshTokenResult.UNAUTHORIZED -> { /* proposer la reconnexion */ }

    // EMAIL_NOT_VERIFIED reste traité comme aujourd'hui : il relève de l'analyse
    // « courriel non confirmé », pas de celle-ci
    RefreshTokenResult.EMAIL_NOT_VERIFIED,
    RefreshTokenResult.FAILED -> updateError(LoginUiStateError.TechnicalError())
}
```

Le même découpage s'applique à `ProfileAuthenticationViewModel.refreshData` (l.94-99).

### Pourquoi

Aujourd'hui tout ce qui n'est pas `SUCCESS` devient « Problème technique » (problème 2 de l'analyse). Une session expirée n'est pas une panne : l'utilisateur doit être ramené à la connexion. `handleTokenError` reconnaît déjà le 403 comme `UNAUTHORIZED` (l.163-165) ; ce sont les appelants qui jettent cette information.

Ce que fait le bloc `UNAUTHORIZED` dépend d'une décision UX qui n'est pas prise.

---

## 7. Ce que la solution règle et ne règle pas

| | Réglé ? | Par quoi |
| --- | --- | --- |
| Le 400 (jeton vide) | Oui | Changement 1 |
| Le 403 causé par deux refresh simultanés | Oui | Changement 1 |
| L'état intermédiaire des jetons | Oui | Changement 2 |
| Un vrai 403 (jeton réellement invalide) | Plus propre, mais toujours présent | Changement 3 |
| Les « 20 minutes » du contournement | Non | Le code ne les explique pas : à valider avec Auth0 |
| Les appels sans lien avec le verrou (`fetchTokens`) | Non | Décision 4 |

## 8. Décisions à prendre

1. **Sur un `UNAUTHORIZED`, que doit voir l'utilisateur ?** Un retour direct à l'écran de connexion, ou le modal de connexion manuelle déjà présent dans `LoginHighPrivilegeViewModel` (`updateManualConnectionModal`, l.100 et l.116) ? Je n'ai pas trouvé, dans les fichiers lus, de réaction « retour à la connexion » déjà prévue pour l'écran Authentification (`ProfileAuthenticationReaction` : seuls `ModifyProfile` et `Close` ont été vus).
2. **Garder le refresh forcé à chaque ouverture d'écran ?** Il sert à rafraîchir l'email. Si on préfère rafraîchir seulement à l'expiration, il faut un autre moyen d'obtenir l'email à jour.
3. **Mémoriser un échec récent** pour éviter qu'un second appelant refasse un appel voué à l'échec (limite de la section 4) ?
4. **Prendre aussi le verrou dans `fetchTokens`** (la connexion) ?

## 9. Ordre d'application proposé

1. Ajouter `performRefresh` et `applyTokens` dans `LowPrivilegeTokenRepository.kt`.
2. Remplacer le corps de `refreshAccessToken` par la porte unique (section 4).
3. Remplacer l'appel de la l.85 de `getOrRefreshAccessToken` par `performRefresh(refreshToken)`.
4. Utiliser `applyTokens` dans `fetchTokens`.
5. Écrire les tests (section 10) et compiler le module `shared` pour Android et iOS.
6. Valider sur BrowserStack (section 11).
7. Après la décision 1, appliquer le changement 3 dans les deux appelants.

## 10. Tests unitaires proposés

L'infrastructure de test existante n'a pas été vérifiée. À écrire avec une fausse `TokenHttpFacade` qui retarde sa réponse.

| Test | Résultat attendu |
| --- | --- |
| Deux `refreshAccessToken()` lancés en même temps | Un seul appel HTTP ; les deux retournent `SUCCESS` |
| `refreshAccessToken()` avec un jeton vide | Aucun appel HTTP ; `UNAUTHORIZED` |
| Réponse 403 `invalid_grant` | `UNAUTHORIZED` |
| Succès avec un nouveau refresh token | `getToken(REFRESH)` rend le nouveau jeton |
| Succès sans nouveau refresh token | L'ancien jeton est conservé |
| `getOrRefreshAccessToken()` et `refreshAccessToken()` en parallèle | Aucun blocage (pas de deadlock), un seul appel HTTP |

## 11. Validation sur BrowserStack après correctif

- À l'expiration de l'access token, un seul appel `/oauth/token` doit partir, même si plusieurs écrans s'ouvrent en même temps.
- Aucun appel `/oauth/token` ne doit partir avec `refresh_token` vide.
- Le `refresh_token` envoyé doit être celui reçu dans la dernière réponse de token.
- Si un 403 apparaît encore avec un seul appel, la cause n'est pas la course : passer aux questions Auth0 (analyse, section 9).

## 12. Fichiers touchés par la proposition

| Fichier | Modification | Pourquoi |
| --- | --- | --- |
| `LowPrivilegeTokenRepository.kt` | Verrou, garde, « déjà rafraîchi », `performRefresh`, `applyTokens`, appel de la l.85, `fetchTokens` | Problèmes 1, 3 et 4 |
| `LoginHighPrivilegeViewModel.kt` | Traitement distinct de `UNAUTHORIZED` (l.64-70) | Problème 2 |
| `ProfileAuthenticationViewModel.kt` | Traitement distinct de `UNAUTHORIZED` (l.94-99) | Problème 2 |
| Fichier de test du repository (à créer) | Tests de la section 10 | Empêcher une régression |

## 13. Risques

- **Deadlock** si `refreshAccessToken` et `getOrRefreshAccessToken` prennent le même verrou en s'appelant (section 4).
- **Pas de garantie sur le 403** : si la cause est la configuration Auth0 (durée de vie, lien à la session), l'option A ne la supprime pas.
- **Dépôt incomplet** : plusieurs fichiers du projet sont reconstitués depuis des captures. La conclusion « aucun appelant » est à reconfirmer sur la branche réelle.
- **Fichiers non lus** : `TokensDataSource` (introuvable), `TokenHttpService.refreshTokens`, et le chemin Nous joindre → Nous écrire.
