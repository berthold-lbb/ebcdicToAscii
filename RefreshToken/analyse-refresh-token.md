# Bug de refresh token — analyse complète et proposition de solution

- **Date** : 2026-10-15
- **Build concerné** : 26.09.0 (Android et iOS), environnements UAT2 et Prod-BETA, sans biométrie active
- **Ticket** : non précisé (à renseigner)
- **Statut** : analyse terminée, **aucun fichier de code modifié**. Les extraits de la section 10 sont des propositions, non compilées et non testées.
- **Version éditable** : doc Claude « Bug de refresh token — analyse complète » (https://claude.ai/code/artifact/147fc785-3f5b-416f-add1-9d691e039618)

---

## 1. Contexte et symptômes

Depuis le build 26.09.0, le refresh du jeton échoue quand la biométrie n'est pas active. L'app affiche alors « Problème technique ».

- **Écrans touchés** : page Authentification, liens OCS, Nous joindre → Nous écrire, et probablement d'autres fonctionnalités qui utilisent la même composante.
- **Erreurs vues** : d'abord un 403, puis quelques minutes plus tard un 400 (« Logout 400 »).
- **Comportement attendu** : ne voir ni 403 ni 400.
- **Contournement** : killswipe puis relance de l'app. Le correctif tient 20 minutes, soit la durée du jeton.
- **Outil d'observation** : BrowserStack App Live avec l'onglet Network des DevTools. Les appareils sont propres à chaque session, ce qui écarte un jeton périmé resté d'une installation précédente.

## 2. Preuves observées dans les captures

Deux échecs distincts sur le même endpoint Auth0 : un appel avec un jeton refusé (403), puis un appel avec un jeton vide (400).

| Observation | Détail relevé | Ce que ça prouve |
| --- | --- | --- |
| 403 | POST sur `id.certif.desjardins.com/oauth/token`. Réponse : `invalid_grant`, « Unknown or invalid refresh token. ». Content-Length de la requête : 172. | La requête portait une vraie valeur de jeton, qu'Auth0 a refusée. |
| 400 | Même endpoint. Réponse : `invalid_request`, « Missing required parameter: refresh_token ». Payload : `refresh_token` vide, `grant_type` refresh_token, `client_id` présent. Content-Length : 82. | L'app a envoyé un jeton vide. L'écart de 90 caractères avec le 403 correspond à la valeur du jeton. |
| Liste réseau (écran de connexion) | Trois appels `token` en échec, plusieurs `registerdevicepushtoken` en échec, trois `getdynamicmessages`. | Plusieurs refresh rapprochés. Rien ne montre encore qu'ils portent la même valeur. |
| En-têtes Auth0 | `X-Ratelimit-Limit` : 20. `X-Ratelimit-Remaining` : 19 sur un appel, 18 sur un autre. | L'endpoint est limité à 20 appels. Une boucle de nouvelles tentatives pourrait l'épuiser (hypothèse). |
| Écran d'erreur | Page Authentification, « Détails du compte », dialogue « Problème technique » avec un bouton OK. | L'erreur est affichée sur l'écran qui déclenche le refresh. |

Deux messages de Jimmy Bergeron (2026-10-14), relayés par Guillaume Chenard, donnent la lecture côté Auth0 :

- 15:02 : « c'est le bas privilège qui est appelé ici avec un refresh token. ce refresh token n'est plus valide. pourquoi o_0! faudrait valider avec auth0 ».
- 15:14 : « le bas privilège est appelé ici sans aucun refresh token. enjeu coté app mobile ».

Autrement dit, le 403 vient d'un appel bas privilège avec un jeton invalide, et le 400 d'un appel bas privilège sans jeton.

## 3. Les concepts en langage simple

Un refresh token est un coupon à usage unique : on l'échange contre un nouvel access token et un nouveau coupon, et l'ancien ne vaut plus rien.

- **Access token** : la carte de chambre. Il dure environ 20 minutes (`expires_in` 1200, d'après les notes de projet) et sert à appeler les API.
- **Refresh token** : le reçu de la réception. Il permet d'obtenir un nouvel access token sans redemander le mot de passe. L'app envoie un POST sur `/oauth/token` avec `grant_type=refresh_token`.
- **Rotation (Auth0)** : à chaque utilisation, Auth0 renvoie un nouveau refresh token et invalide l'ancien. Si un ancien jeton est réutilisé, Auth0 y voit un vol possible et peut révoquer toute la chaîne. La réponse est un 403 `invalid_grant`. Il faut vérifier que la rotation est activée sur le tenant, et s'il existe un délai de tolérance (overlap).
- **Bas privilège** : consulter l'app. Les jetons sont gardés en mémoire (doc de la classe, l.41) et rafraîchis en silence.
- **Haut privilège** : les opérations sensibles comme l'accès OCS. Il exige un mot de passe ou la biométrie. Seul le jeton haut privilège est rangé dans le stockage protégé par la biométrie (`BiometricsRepository`, `putHighPrivRefreshToken`). Sans biométrie, le chemin silencieux bas privilège est donc le seul disponible.
- **Mutex** : un tourniquet à une seule personne à la fois. Avec `withLock`, une seule coroutine exécute le bloc ; les autres attendent à l'entrée.
- **Concurrence** : deux écrans qui lisent le même jeton au même moment, avant que le premier n'ait écrit le nouveau.

## 4. Analyse de LowPrivilegeTokenRepository

Le fichier contient une fonction bien protégée, `getOrRefreshAccessToken`, et une fonction sans aucune protection, `refreshAccessToken`.

Fichier : `ad-digital-mobile-aio/shared/src/commonMain/kotlin/com/desjardins/assurancedommages/mobile/feature/authenticate/data/repository/LowPrivilegeTokenRepository.kt` (300 lignes).

### getOrRefreshAccessToken (l.73-111)

- Le Mutex est pris dès l.73 : `refreshMutex.withLock`.
- Le jeton est relu l.74, donc après l'attente éventuelle du verrou.
- Si l'access token n'est pas expiré, la fonction rend `Success` sans appel réseau (l.76-78).
- Si le refresh token est vide, elle rend `Unauthorized` sans appel réseau (l.80-82).
- Sinon elle appelle `refreshAccessToken()` (l.85) et traduit le résultat.

```kotlin
// LowPrivilegeTokenRepository.kt l. 73-82
suspend fun getOrRefreshAccessToken(): AccessTokenResult = refreshMutex.withLock {  // Mutex
    val refreshToken = getToken(REFRESH).value      // relu après l'attente
    return when {
        !isAccessTokenExpired() -> {                // déjà rafraîchi par un autre ?
            AccessTokenResult.Success(getToken(ACCESS).value)
        }
        refreshToken.isEmpty() -> {                 // garde jeton vide
            AccessTokenResult.Unauthorized
        }
```

### refreshAccessToken (l.113-144)

- Il lit le jeton l.114, vérifie la configuration l.116, puis appelle Auth0 l.121.
- Sur succès, il écrit l'access token (l.123), puis le nouveau refresh token s'il n'est pas vide (l.124-126).
- Sur erreur, il passe par `handleTokenError` (l.131).
- Il n'a ni verrou, ni garde « jeton vide », ni test d'expiration.

```kotlin
// LowPrivilegeTokenRepository.kt l. 113-126
suspend fun refreshAccessToken(): RefreshTokenResult = try {
    val refreshToken = getToken(REFRESH).value        // lu sans verrou, sans test
    if (!tokenHttpFacade.isLowPrivilegeConfigured()) { ... }
    else {
        when (val result = tokenHttpFacade.refreshLowPrivilegeTokens(refreshToken)) {  // attente réseau
            is Success -> {
                setAccessToken(result.response.accessToken)          // l.123
                if (result.response.refreshToken.isNotNullOrEmpty()) {
                    setRefreshToken(result.response.refreshToken)    // l.125 : nouveau jeton écrit ici
                }
```

### handleTokenError (l.146-172)

- Si le code Auth0 est `USER_EMAIL_NOT_VERIFIED`, le résultat est `EMAIL_NOT_VERIFIED` (l.159).
- Un statut 401 ou 403 donne `UNAUTHORIZED` (l.163-165). Le 403 `invalid_grant` est donc bien reconnu dans le dépôt.
- Tout le reste donne `FAILED`.

### Écritures des jetons (l.210-229)

`setAccessToken` et `setRefreshToken` font chacun lire, copier, écrire dans `tokensDataSource.data`. Ce sont deux écritures séparées, donc non atomiques.

### Fichiers voisins

- `Tokens.kt` l.7 : `refresh: Token = emptyToken()` par défaut.
- `TokenHttpRequest.kt` l.79 : `append("refresh_token", payload.refreshToken)` sans garde, même si la valeur est vide.
- `TokenHttpFacade.kt` l.70-78 : `refreshLowPrivilegeTokens` transmet le jeton tel quel.

## 5. Les appelants réels

La fonction protégée n'a aucun appelant : les deux écrans qui rafraîchissent réellement appellent `refreshAccessToken()` directement, donc sans verrou ni garde. Recherche faite dans le dépôt local (fichiers .kt et .swift, hors dossiers build).

| Action de l'utilisateur | Appel (fichier, ligne) | Mutex | Garde jeton vide | Si échec |
| --- | --- | --- | --- | --- |
| Ouvrir la page Authentification | `ProfileAuthenticationViewModel`, `onCreate` puis `refreshData`, l.62 et l.94 | Non | Non | `hasError = true`, dialogue « Problème technique » |
| Revenir de la webview « Modifier » | Le même `refreshData`, via `onActive` si `shouldReloadOnNextActive` (l.82-87) | Non | Non | Le même dialogue |
| Ouvrir un lien OCS (login haut privilège) | `LoginHighPrivilegeViewModel`, `onCreate`, l.64 | Non | Non | `updateError(TechnicalError)`, l.69 |
| Nous joindre → Nous écrire | Non tracé | ? | ? | ? |
| Tout code qui appellerait `getOrRefreshAccessToken` | Aucun appelant | Oui | Oui | Sans objet |

`AuthSessionManager` n'effectue jamais de refresh : il appelle seulement `fetchTokens` (l.65), `isAccessTokenValid` (l.74) et `getToken` (l.87). Une copie de `LoginHighPrivilegeViewModel` existe aussi sous `analyse/WRU-25865/`. Elle appelle de la même façon `refreshAccessToken()` (l.66).

Sur les trois points d'entrée réellement tracés, aucun n'est protégé.

### Comment les deux écrans traitent le résultat

Le refresh est forcé à chaque ouverture d'écran, sans test d'expiration. C'est voulu : le commentaire de `LoginHighPrivilegeViewModel` (l.63) dit « refresh low-priv access token to obtain latest user email », et celui de `ProfileAuthenticationViewModel` (l.90) parle de rafraîchir les données du profil après la webview. Il faut donc le garder, mais le sérialiser.

```kotlin
// ProfileAuthenticationViewModel.kt l. 94-99
val refreshResult = tokenRepository.refreshAccessToken()
_uiStateDataFlow.update {
    if (refreshResult == RefreshTokenResult.SUCCESS) {
        it.copy(isLoading = false, email = emailDataSource.data, hasError = false)
    } else {
        it.copy(isLoading = false, hasError = true)   // UNAUTHORIZED, FAILED, EMAIL_NOT_VERIFIED : même sort
    }
}

// LoginHighPrivilegeViewModel.kt l. 64-70
val result = lowPrivilegeTokenRepository.refreshAccessToken()
if (result == RefreshTokenResult.SUCCESS) {
    resolveAuthenticationFlow()
} else {
    updateError(LoginUiStateError.TechnicalError())   // même sort ici aussi
}
```

## 6. Les problèmes identifiés

Trois symptômes remontent d'une seule cause : la fonction protégée a été écrite, mais les appelants utilisent celle qui ne l'est pas. Un quatrième point reste une hypothèse.

### Problème 1 : un jeton vide part vers Auth0 et provoque le 400 (vérifié)

- `Tokens.kt` l.7 : le refresh token vaut `emptyToken()` par défaut.
- `refreshAccessToken` l.114 lit ce jeton et l.121 l'envoie sans test.
- `TokenHttpRequest.kt` l.79 l'ajoute au formulaire tel quel : `refresh_token=` vide.
- Auth0 répond 400 `invalid_request`, comme dans la capture.
- La garde « jeton vide » existe (l.80), mais seulement dans la fonction que personne n'appelle.

Ce qui vide les jetons reste à confirmer. Les jetons ne vivent qu'en mémoire, donc un nouveau processus repart avec des jetons vides. `clearTokens()` n'a aucun appelant dans le dépôt.

### Problème 2 : un 403 est présenté comme une panne technique (vérifié par le code)

- `handleTokenError` reconnaît bien le 403 : `UNAUTHORIZED` (l.163-165).
- Les deux appelants ne distinguent qu'un cas, `SUCCESS`. Tout le reste devient une erreur technique.
- Une session expirée, un courriel non confirmé et une vraie panne réseau donnent donc le même dialogue.
- Aucun chemin ne renvoie l'utilisateur vers l'écran de connexion.

### Problème 3 : deux refresh peuvent lire le même jeton en même temps (code prouvé, chevauchement réel non prouvé)

- Entre la lecture du jeton (l.114) et l'écriture du nouveau (l.125), la mémoire contient encore l'ancien.
- Rien n'empêche un second appelant de le lire pendant ce temps : le Mutex n'est jamais pris par `refreshAccessToken`.
- Avec la rotation, le second appel arrive avec un jeton déjà consommé : 403 `invalid_grant`, et possiblement révocation du nouveau jeton.
- Ensuite, chaque refresh échoue jusqu'à la relance de l'app, ce qui correspond au contournement par killswipe.

### Problème 4 : écriture non atomique des jetons (hypothèse)

- `setAccessToken` (l.210) puis `setRefreshToken` (l.225) lisent et écrasent chacun l'état complet.
- Deux appels concurrents pourraient réécrire l'ancien refresh token par-dessus le nouveau, ou laisser un instant un nouvel access token avec un ancien refresh token.
- Impossible à confirmer : `TokensDataSource` est introuvable dans le dépôt local.

## 7. Réponses aux questions de Ken

Oui, dans l'app, rien n'empêche de réutiliser l'ancien jeton pendant qu'un autre appel rafraîchit. C'est le trou central de `refreshAccessToken`.

### Peut-on utiliser l'ancien token pendant qu'un autre est en train de rafraîchir ?

- Dans l'app : oui. La mémoire contient encore l'ancien jeton (R1) entre la lecture (l.114) et l'écriture du nouveau (l.125). Cet intervalle couvre tout l'aller-retour réseau, de quelques centaines de millisecondes à plusieurs secondes.
- Chez Auth0, le résultat dépend de la configuration. Avec la rotation, R1 est à usage unique : le second appel reçoit un 403 `invalid_grant`, et la chaîne peut être révoquée, y compris le nouveau jeton R2. Avec un délai de tolérance (overlap), R1 reste accepté quelques secondes. Cette configuration n'a pas été vue : à vérifier avec l'équipe Auth0.

### À quoi sert le mutex ?

Un mutex est un tourniquet à une personne. Le bloc de `getOrRefreshAccessToken` contient tout le cycle : lire le jeton, vérifier l'expiration, rafraîchir, enregistrer. Un deuxième appelant n'entre qu'une fois le premier sorti, quand R2 est écrit.

### Vérifie-t-on si le token a déjà été rafraîchi ?

- Dans `getOrRefreshAccessToken` : oui, et au bon endroit. Le jeton est relu l.74 et l'expiration testée l.76 à l'intérieur du verrou, donc après l'attente. Le second appelant voit un access token frais et repart sans appel réseau.
- Dans `refreshAccessToken` : non. L'appel réseau part toujours.

### Le scénario de bout en bout, sans verrou

1. L'app détient le jeton R1.
2. L'écran A (par exemple Authentification, l.94) appelle `refreshAccessToken()`, lit R1 et envoie sa requête.
3. L'écran B (par exemple le login OCS, l.64) appelle aussi `refreshAccessToken()`, lit R1, toujours en mémoire, et envoie la sienne.
4. Auth0 reçoit A en premier, accepte R1, renvoie R2 et marque R1 comme consommé.
5. Auth0 reçoit B avec R1 déjà consommé : 403 `invalid_grant`, et possiblement révocation de R2.
6. A enregistre R2 (peut-être déjà révoqué). B reçoit `UNAUTHORIZED`, affiché comme « Problème technique ».
7. Chaque refresh suivant échoue jusqu'à la relance de l'app.

### Ce que le simple verrou ne règle pas

Le verrou doit être dans `refreshAccessToken` elle-même. Sinon les appelants directs le contournent, et la fonction protégée reste sans appelant. Si on ajoute seulement un verrou, B attend puis refait un refresh avec R2. C'est valide pour Auth0 (utilisation en séquence), mais l'appel est inutile. Il faut aussi, après l'attente, comparer le jeton avec celui lu avant l'attente. S'il a changé, quelqu'un vient de rafraîchir et on réutilise son résultat.

## 8. Ce qui est prouvé et ce qui ne l'est pas

Le défaut de code est prouvé ; la cause exacte du 403 en situation réelle ne l'est pas encore.

| Affirmation | Statut | Base ou test qui trancherait |
| --- | --- | --- |
| Le 400 vient d'un appel avec un jeton vide | Vérifié | Capture (payload vide, Content-Length 82) et code (l.114, l.121, `TokenHttpRequest` l.79) |
| Les deux appelants réels n'ont ni verrou ni garde | Vérifié | Lecture du code et recherche des appelants |
| `getOrRefreshAccessToken` n'a aucun appelant | Vérifié sur le dépôt local | Le dépôt est en partie reconstitué depuis des captures : à confirmer sur la branche réelle |
| Le 403 vient de deux refresh simultanés | Hypothèse | Dans BrowserStack, chercher deux appels `/oauth/token` avec la même valeur de `refresh_token` |
| Le nouveau refresh token n'est pas enregistré après rotation | Réfuté sur ce chemin | `setRefreshToken` est appelé l.125. L'hypothèse précédente est abandonnée |
| Les écritures non atomiques écrasent le jeton rotaté | Hypothèse | Lire `TokensDataSource`, introuvable en local |
| Le contournement dure 20 minutes | Non expliqué par le code | Le refresh est forcé à chaque ouverture d'écran, sans test d'expiration. Piste : jeton lié à la session Auth0, ou durée de vie côté Auth0. Les notes de projet indiquent que le `/v2/logout` du site SEL détruit la session Auth0 |
| Ce qui vide les jetons en mémoire | Non vérifié | `clearTokens()` n'a aucun appelant et `TokensDataSource` est introuvable |
| Le chemin Nous joindre → Nous écrire | Non tracé | Chercher son appelant du refresh |
| La rotation est activée, avec ou sans délai de tolérance | Inconnu | Question à poser à l'équipe Auth0 |
| Le défaut est apparu avec le build 26.09.0 | Inconnu | Tester un build antérieur |

## 9. Plan d'action

Le plan commence par les correctifs de code, qui règlent le 400 et le risque de course, puis valide avec Auth0 ce que le code n'explique pas.

### Correctifs, dans l'ordre

1. Mettre la garde « jeton vide » dans `refreshAccessToken` elle-même : retourner `UNAUTHORIZED` sans appel réseau. Cela supprime le 400.
2. Mettre le verrou dans `refreshAccessToken`. Après l'attente, comparer le jeton avec celui lu avant : s'il a changé, réutiliser le refresh qui vient d'avoir lieu. Garder le refresh forcé voulu pour l'email.
3. Dans les deux appelants, traiter `UNAUTHORIZED` à part : retour à la connexion plutôt que « Problème technique ».
4. Écrire access et refresh token en une seule opération atomique.
5. Faire valider la configuration par l'équipe Auth0.

### Tests de validation sur BrowserStack

- Observer l'expiration : combien d'appels `/oauth/token` partent, et avec quelle valeur de `refresh_token` ? Plusieurs appels avec la même valeur confirment la course ; un seul appel oriente vers la configuration Auth0.
- Comparer le `refresh_token` envoyé avec celui reçu dans la dernière réponse de token. S'ils sont identiques après une rotation, le nouveau jeton n'a pas été appliqué.
- Demander à l'équipe Auth0 de réduire la durée de l'access token à 1 ou 2 minutes sur UAT2, pour reproduire vite.
- Rejouer le scénario sur un build antérieur à 26.09.0 pour savoir s'il s'agit d'une régression.

### Questions pour l'équipe Auth0

- La rotation des refresh tokens est-elle activée pour le client bas privilège, sur UAT2 et sur Prod-BETA ? Y a-t-il un délai de tolérance (overlap) ?
- Quelles sont les durées d'inactivité et absolue du refresh token ?
- Le refresh token est-il lié à la session Auth0 ? Que devient-il quand cette session est détruite ?
- Que disent les journaux du tenant à l'heure d'un 403 : échec d'échange de refresh token, et mention d'une réutilisation détectée ?

---

## 10. Proposition de solution

> Version autonome, avec explications détaillées et scénario rejoué : [`proposition-solution.md`](proposition-solution.md).

> Tout ce qui suit est une **proposition**. Rien n'est appliqué, compilé ni testé. Les signatures de `Token`, `Tokens`, `TokenResponse` et `TokensDataSource` sont déduites des usages lus, pas de leur définition (`TokensDataSource` est introuvable en local).

### 10.1 Trois options

| Option | Contenu | Ce qu'elle règle | Ce qu'elle ne règle pas |
| --- | --- | --- | --- |
| A — minimale | Changements 1 et 2 (verrou, garde, « déjà rafraîchi », écriture atomique), dans un seul fichier | Le 400, et les 403 dus à la course entre deux refresh | Un vrai 403 (session ou jeton réellement invalide) reste affiché « Problème technique » |
| B — A + reconnexion | A + changement 3 (traiter `UNAUTHORIZED` dans les appelants) | Un vrai 403 devient un retour propre à la connexion | Nécessite une décision UX (voir 10.5) |
| C — B + Auth0 | B + validation de la configuration Auth0 | La cause « 20 minutes », si elle vient du tenant | Dépend de l'équipe Auth0 |

**Recommandation** : commencer par A (changement local, un seul fichier, risque faible), lancer en parallèle les vérifications Auth0, puis faire B après la décision UX. Cette recommandation reste à valider : si les tests BrowserStack montrent un seul appel `/oauth/token` au moment du 403, A ne suffira pas et la piste Auth0 devient prioritaire.

### 10.2 Changement 1 — `LowPrivilegeTokenRepository.kt` : une seule porte d'entrée verrouillée

**Pourquoi** : aujourd'hui `refreshAccessToken` lit le jeton sans verrou, sans garde et sans test d'expiration (problèmes 1 et 3). On met le verrou, la garde et la vérification « déjà rafraîchi » dans cette fonction, car c'est celle que les appelants utilisent.

**Piège à éviter** : le `Mutex` de Kotlin n'est **pas réentrant**. `getOrRefreshAccessToken` tient déjà le verrou (l.73) et appelle `refreshAccessToken()` (l.85). Si `refreshAccessToken` prenait aussi le verrou, l'app se bloquerait (deadlock). Il faut donc scinder : une fonction publique qui prend le verrou, et une fonction privée `performRefresh` qui ne le prend pas. `getOrRefreshAccessToken` appelle la privée.

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
            is Error -> handleTokenError(result)
        }
    }
} catch (e: Throwable) {
    // ... bloc catch inchangé (l.135-143)
}
```

Et dans `getOrRefreshAccessToken`, remplacer l'appel de la l.85 :

```kotlin
// avant (l.85)
else -> { when (refreshAccessToken()) { ...
// après : appeler la version sans verrou, car le verrou est déjà tenu
else -> { when (performRefresh(refreshToken)) { ...
```

**Limite connue** : si le premier appelant échoue (jeton invalide), le jeton reste inchangé et le second appelant refera lui aussi un appel réseau qui échouera. Acceptable pour une première version ; une amélioration possible est de mémoriser le dernier échec pendant quelques secondes. À décider.

### 10.3 Changement 2 — `LowPrivilegeTokenRepository.kt` : écriture atomique des jetons

**Pourquoi** : `setAccessToken` (l.210) puis `setRefreshToken` (l.225) font deux lectures-copies-écritures séparées (problème 4). Une seule écriture élimine l'état intermédiaire « nouvel access token, ancien refresh token ».

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

À faire aussi dans `fetchTokens` (l.181-184), qui écrit les mêmes deux champs. **Attention** : `fetchTokens` (connexion) ne passe pas par le verrou. Une connexion simultanée à un refresh pourrait encore s'entrelacer. À évaluer : prendre `refreshMutex` aussi dans `fetchTokens`.

`setAccessToken` et `setRefreshToken` restent publics tant qu'on n'a pas vérifié qu'aucun autre code ne les appelle. Cette vérification n'a pas été faite.

### 10.4 Changement 3 — les deux appelants : distinguer `UNAUTHORIZED`

**Pourquoi** : aujourd'hui tout ce qui n'est pas `SUCCESS` devient « Problème technique » (problème 2). Une session expirée n'est pas une panne : l'utilisateur doit être ramené à la connexion.

```kotlin
// LoginHighPrivilegeViewModel.kt, remplace l.64-70
when (lowPrivilegeTokenRepository.refreshAccessToken()) {
    RefreshTokenResult.SUCCESS -> resolveAuthenticationFlow()

    // Session expirée : pas une panne. Comportement exact à confirmer (voir 10.5)
    RefreshTokenResult.UNAUTHORIZED -> { /* proposer la reconnexion */ }

    // EMAIL_NOT_VERIFIED reste traité comme aujourd'hui : il relève de l'analyse
    // « courriel non confirmé », pas de celle-ci
    RefreshTokenResult.EMAIL_NOT_VERIFIED,
    RefreshTokenResult.FAILED -> updateError(LoginUiStateError.TechnicalError())
}
```

Le même découpage s'applique à `ProfileAuthenticationViewModel.refreshData` (l.94-99).

### 10.5 Décisions à prendre

1. **Que doit voir l'utilisateur sur un `UNAUTHORIZED` ?** Un retour direct à l'écran de connexion, ou le modal de connexion manuelle déjà présent dans `LoginHighPrivilegeViewModel` (`updateManualConnectionModal`, l.100 et l.116) ? Je n'ai pas trouvé, dans les fichiers lus, de réaction « retour à la connexion » déjà prévue pour l'écran Authentification (`ProfileAuthenticationReaction` : seuls `ModifyProfile` et `Close` ont été vus).
2. **Garder le refresh forcé à chaque ouverture d'écran ?** Il sert à rafraîchir l'email (commentaires l.63 et l.90). Si on préfère rafraîchir seulement à l'expiration, il faut un autre moyen d'obtenir l'email à jour.
3. **Mémoriser un échec récent** pour éviter qu'un second appelant refasse un appel voué à l'échec (voir limite en 10.2) ?
4. **Prendre le verrou dans `fetchTokens`** (voir 10.3) ?

### 10.6 Tests unitaires proposés

Je n'ai pas vérifié l'infrastructure de test existante. À écrire avec une fausse `TokenHttpFacade` qui retarde sa réponse.

| Test | Résultat attendu |
| --- | --- |
| Deux `refreshAccessToken()` lancés en même temps | Un seul appel HTTP ; les deux retournent `SUCCESS` |
| `refreshAccessToken()` avec un jeton vide | Aucun appel HTTP ; `UNAUTHORIZED` |
| Réponse 403 `invalid_grant` | `UNAUTHORIZED` |
| Succès avec un nouveau refresh token | `getToken(REFRESH)` rend le nouveau jeton |
| Succès sans nouveau refresh token | L'ancien jeton est conservé |
| `getOrRefreshAccessToken()` et `refreshAccessToken()` en parallèle | Aucun blocage (pas de deadlock), un seul appel HTTP |

### 10.7 Fichiers touchés par la proposition

| Fichier | Modification | Pourquoi |
| --- | --- | --- |
| `LowPrivilegeTokenRepository.kt` | Verrou, garde, « déjà rafraîchi », `performRefresh`, `applyTokens` | Problèmes 1, 3 et 4 |
| `LoginHighPrivilegeViewModel.kt` | Traitement distinct de `UNAUTHORIZED` (l.64-70) | Problème 2 |
| `ProfileAuthenticationViewModel.kt` | Traitement distinct de `UNAUTHORIZED` (l.94-99) | Problème 2 |
| Fichier de test du repository (à créer) | Tests du 10.6 | Empêcher une régression |

### 10.8 Risques

- **Deadlock** si `refreshAccessToken` et `getOrRefreshAccessToken` prennent le même verrou en s'appelant (voir 10.2).
- **Pas de garantie sur le 403** : si la cause est la configuration Auth0 (durée de vie, lien à la session), l'option A ne la supprime pas.
- **Dépôt incomplet** : plusieurs fichiers du projet sont reconstitués depuis des captures. Les conclusions sur « aucun appelant » sont à reconfirmer sur la branche réelle.
- **Fichiers non lus** : `TokensDataSource` (introuvable), `TokenHttpService.refreshTokens`, et le chemin Nous joindre → Nous écrire.

## 11. Résumé en une phrase

Le 400 et le « Problème technique » viennent du même défaut : `refreshAccessToken` n'a ni verrou, ni garde, ni traitement du 403, alors que la version protégée, `getOrRefreshAccessToken`, n'est appelée par personne.

## 12. Sources

- Captures du ticket (description, étapes, observé, attendu, contournement) et captures DevTools BrowserStack (403, 400, liste réseau, écran « Problème technique »).
- Messages Teams de Jimmy Bergeron relayés par Guillaume Chenard (2026-10-14).
- Code : `LowPrivilegeTokenRepository.kt`, `ProfileAuthenticationViewModel.kt`, `LoginHighPrivilegeViewModel.kt`, `Tokens.kt`, `TokenHttpRequest.kt`, `TokenHttpFacade.kt`, `AuthSessionManager.kt`.
