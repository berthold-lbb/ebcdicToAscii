# Proposition finale — bouton d'information sur Android

Version du 23 octobre 2026. Le code complet des trois fichiers est dans [src/](./src/), au même chemin que dans le dépôt (le diff est dans `proposition/android.patch`). Les numéros de ligne ci-dessous renvoient à ces copies corrigées, pas aux sources actuelles.

## 1. La solution en quatre décisions

| # | Décision | Pourquoi |
| --- | --- | --- |
| 1 | Le bouton est un composable local à `WelcomeView.kt`, affiché seulement si `state.informationUrl != null` | La visibilité dépend de l'état du ViewModel, déjà fourni. Aucune logique métier dans l'interface. |
| 2 | Les minuteurs (1 s, 5 s) et les états `visible` / `expanded` vivent dans le composable, sauvegardés par `rememberSaveable` | Ce sont des détails de présentation, sans effet sur l'analytics ni sur la navigation. Rien à ajouter au shared. |
| 3 | La modale est pilotée par `WelcomeActivity` (`showInformationModal`), en réutilisant `ShowExternalDSDDialog` à qui on ajoute 4 paramètres de texte optionnels | Même mécanisme que la modale « mot de passe oublié ». Les textes du ticket (`GIA_LOGIN_INFORMATION_MODAL_*`) diffèrent des textes génériques, notamment en anglais. |
| 4 | L'ouverture du navigateur passe par la réaction existante `OpenExternalBrowser`, gérée dans `handleReaction` | L'URL reste dans le ViewModel ; l'activité n'a aucune URL à conserver. |

## 2. Tous les fichiers potentiellement concernés

### 2.1 À modifier côté Android (cette proposition)

| # | Fichier | Module | Changement | Lignes (proposées) |
| --- | --- | --- | --- | --- |
| 1 | `androidApp/.../ca/dgag/ajusto/gia/WelcomeView.kt` | androidApp | Imports, appel dans le `Box` de l'illustration, composable `InformationFloatingButton`, constantes de temps, deux styles de texte | 223-230, 327-382, 388-390, 401-418 |
| 2 | `androidApp/.../authentification/welcome/WelcomeActivity.kt` | androidApp | Interception de `InformationLinkTapped`, état de la modale, modale, branche `OpenExternalBrowser`, fonction `onInformationLinkTapped` | 56, 58-64, 88-103, 140-141, 154-158 |
| 3 | `androidApp/.../views/modal/ShowExternalDSDDialogComposable.kt` | androidApp | 4 paramètres optionnels : `title`, `message`, `primaryText`, `secondaryText` | 21-40 |

### 2.2 Déjà faits dans les PR (à ne pas refaire)

| # | Fichier | Module | Ce qu'il apporte | Vu dans |
| --- | --- | --- | --- | --- |
| 4 | `DynamicMessagesRemoteDataSource.kt` | transverse/domain | `retrievePublic()` | PR p1 (non revu) ; absent de la copie locale |
| 5 | `KtorDynamicMessagesDataSource.kt` | transverse/data | Implémentation de `retrievePublic()` | Copie locale (l.36-46) |
| 6 | `WelcomeAction.kt` | feature/authenticate | Les 4 actions avec leur analytics | Diff p1 → p2 |
| 7 | `WelcomeReaction.kt` | feature/authenticate | `OpenExternalBrowser(url)` | Diff p1 → p2 |
| 8 | `WelcomeUiState.kt` | feature/authenticate | `informationUrl: String?` | Diff p1 → p2 |
| 9 | `WelcomeUiStateData.kt` | feature/authenticate | `informationUrl: String?` | Diff p1 → p2 |
| 10 | `WelcomeUiStatesProvider.kt` | feature/authenticate | Recopie `informationUrl` | Diff p1 → p2 |
| 11 | `WelcomeViewModel.kt` | feature/authenticate | `loadInformationUrl`, validation, branches du `when` | Diff p1 → p2 |
| 12 | `LoginAnalyticsParameters.kt` | feature/authenticate | `viewInformationModal()` vu (`login_047`) ; les trois autres fonctions de clic non vues | Diff p1 → p2 |
| 13 | `LoginAnalyticsScreen.kt` | feature/authenticate | `APPSTART_INFORMATION_REDIRECT_MODAL` utilisé par le point précédent | Non vu |
| 14 | `KoreFeatureRuntimeKoinModules.kt` | shared | `dynamicMessagesRemoteDataSource = get()` (l.284) | Diff p1 → p2 ; absent de la copie locale |
| 15 | `translations-kore.json` | transverse/presentation | 7 clés `gia_login_information_*` (EN et FR) | Branche p3 |
| 16 | `GiaAnalyticsParametersTest.kt`, `WelcomeViewModelTest.kt` | shared (tests) | Tests des analytics et du ViewModel | Partiellement vus |

### 2.3 Optionnels ou hors périmètre

| # | Fichier | Statut | Remarque |
| --- | --- | --- | --- |
| 17 | `WelcomeMock.kt` (aperçu Compose) | Optionnel, non vu | Y mettre un `informationUrl` non nul pour voir le bouton dans la Preview. Les mocks existants compilent sans changement car le champ a une valeur par défaut. |
| 18 | `res/drawable/ico_learn_more.xml` | À créer plus tard | Remplacera `Icons.Filled.Info`, laissée comme icône provisoire. |
| 19 | `values/strings.xml`, `fr/strings.xml` | À vérifier | Aucun changement prévu : les textes sont lus par `GiaLocalizedString.get()`. À confirmer si ces fichiers sont la source de `translations-kore.json`. |
| 20 | `androidApp/build.gradle` | Aucun changement | `androidx.compose.material.icons` est déjà utilisé dans `WebviewComposable.kt`. |
| 21 | `AndroidManifest.xml` | Aucun changement | |
| 22 | `WelcomeLegacyActivity` et `WelcomeLegacyViewModel` | Hors périmètre | Décision de Ken. |
| 23 | iOS : `LoginInformationCTA` | Fait en p3 | Non disponible sur le disque ; aurait donné les temps de référence. |

## 3. Les changements, fichier par fichier

### 3.1 `ShowExternalDSDDialogComposable.kt` : textes paramétrables

```kotlin
@Composable
fun ShowExternalDSDDialog(
    primaryButtonOnClick: () -> Unit = {},
    secondaryButtonOnClick: () -> Unit = {},
    title: String = InsuranceLocalizedString.INSURANCE_EXTERNAL_WEBSITE_TITLE.get(),
    message: String = InsuranceLocalizedString.INSURANCE_EXTERNAL_WEBSITE_DSD_MESSAGE.get(),
    primaryText: String = AjustoLocalizedString.GLOBAL_CONTINUE.get(),
    secondaryText: String = AjustoLocalizedString.GLOBAL_CANCEL.get()
)
```

**Pourquoi** : l'appel existant (mot de passe oublié) utilise des paramètres nommés et garde ses textes par défaut : il n'est pas touché. Une valeur par défaut peut appeler un composable (`.get()` est `@Composable`).

### 3.2 `WelcomeActivity.kt` : modale et réaction

```kotlin
private var showInformationModal by mutableStateOf(false)

private val actionListener = ActionListener<WelcomeAction?> { action ->
    when (action) {
        null -> Unit
        WelcomeAction.InformationLinkTapped -> onInformationLinkTapped()
        else -> viewModel.executeAction(action)
    }
}

private fun onInformationLinkTapped() {
    viewModel.executeAction(WelcomeAction.InformationLinkTapped)   // login_115
    viewModel.executeAction(WelcomeAction.InformationModalViewed)  // login_047
    showInformationModal = true
}
```

Dans `setContent`, la modale :

```kotlin
if (showInformationModal) {
    ShowExternalDSDDialog(
        title = GiaLocalizedString.GIA_LOGIN_INFORMATION_MODAL_TITLE.get(),
        message = GiaLocalizedString.GIA_LOGIN_INFORMATION_MODAL_MESSAGE.get(),
        primaryText = GiaLocalizedString.GIA_LOGIN_INFORMATION_MODAL_CONTINUE.get(),
        secondaryText = GiaLocalizedString.GIA_LOGIN_INFORMATION_MODAL_CANCEL.get(),
        primaryButtonOnClick = {
            showInformationModal = false
            viewModel.executeAction(WelcomeAction.ContinueInformation)  // login_117
        },
        secondaryButtonOnClick = {
            showInformationModal = false
            viewModel.executeAction(WelcomeAction.CancelInformation)    // login_118
        }
    )
}
```

Dans `handleReaction` :

```kotlin
is WelcomeReaction.OpenExternalBrowser ->
    startActivity(Intent(Intent.ACTION_VIEW, reaction.url.toUri()))
```

**Pourquoi** : l'interception ne change rien aux autres actions (`else` les transmet comme avant). Les deux `executeAction` du tap sont séparés car chacun a son propre analytics.

### 3.3 `WelcomeView.kt` : le bouton

Appel, dans le `Box` de l'illustration, **après** la carte blanche pour qu'il soit dessiné par-dessus :

```kotlin
if (state.informationUrl != null) {
    InformationFloatingButton(
        modifier = Modifier.align(Alignment.TopEnd).padding(top = medium, end = medium),
        onClick = { actionListener.onClick(WelcomeAction.InformationLinkTapped) }
    )
}
```

Le composable, dans l'ordre :

```kotlin
var visible by rememberSaveable { mutableStateOf(false) }
var expanded by rememberSaveable { mutableStateOf(true) }

LaunchedEffect(Unit) {
    delay(INFO_SHOW_DELAY_MS)       // 1 s
    visible = true
    delay(INFO_COLLAPSE_DELAY_MS)   // 5 s
    expanded = false
}

AnimatedVisibility(visible, modifier, enter = slideInHorizontally(tween(400)) { it } + fadeIn(tween(400))) {
    Row(Modifier.clip(RoundedCornerShape(percent = 50)).background(...).clickable(role = Role.Button, onClick = onClick)
        .semantics { contentDescription = accessibilityHint }.padding(12.dp)) {
        Icon(Icons.Filled.Info, ...)                       // icône provisoire
        AnimatedVisibility(expanded, enter = expandHorizontally + fadeIn, exit = shrinkHorizontally + fadeOut) {
            Column { Text(title) ; Text(learnMore) }       // « La connexion évolue » / « En savoir plus »
        }
    }
}
```

**Pourquoi** :

- `AnimatedVisibility` gère l'entrée et la sortie sans code d'animation manuel.
- Le `padding(12.dp)` après le `clickable` donne une cible tactile d'environ 48 dp, même une fois repliée.
- Le `contentDescription` remplace la lecture du texte par TalkBack par le texte d'indice du ticket (`GIA_LOGIN_INFORMATION_ACCESSIBILITY_HINT`), dans l'état étendu comme dans l'état replié.

## 4. Alternatives examinées

| Alternative | Verdict |
| --- | --- |
| Réutiliser `ShowExternalDSDDialog` sans modification | Écartée : les textes génériques diffèrent des clés du ticket (notamment en EN). |
| Ajouter l'état de la modale dans le ViewModel (nouveau champ d'état) | Écartée : demande de modifier le shared (déjà revu par Copilot), pour un état purement visuel. |
| Faire les minuteurs dans le ViewModel | Écartée : le temps d'affichage est un détail de présentation ; iOS a son propre CTA. |
| `ExtendedFloatingActionButton` de Material 3 (paramètre `expanded`) | **À évaluer avec le Figma et le design system DSD.** Il animerait seul l'état étendu et replié, mais je n'ai pas vérifié la version de Material 3 du projet ni si le DSD accepte ce composant. |

## 5. Vérifications avant de pousser

| # | Scénario | Résultat attendu | Analytics |
| --- | --- | --- | --- |
| 1 | Ouvrir l'accueil avec réseau | Bouton absent, puis glissement depuis la droite à t0 + 1 s | Aucun |
| 2 | Attendre 5 s après l'arrivée | Texte replié, pastille ronde avec l'icône | Aucun |
| 3 | Taper sur le bouton | Modale « Redirection vers un site Web » | `login_115`, puis `login_047` |
| 4 | « Continuer vers le site » | Navigateur externe sur la valeur de `faq_gia_new_connexion` | `login_117` |
| 5 | « Annuler » | Retour à l'accueil, bouton visible | `login_118` |
| 6 | Mode avion au lancement | Pas de bouton, connexion utilisable | Aucun |
| 7 | Les deux marques et EN / FR | Textes corrects selon la langue | |
| 8 | Rotation pendant la séquence | Pas de nouveau glissement ; aucun plantage | |
| 9 | TalkBack | Le bouton est annoncé comme un bouton avec le texte d'indice | |

Avant cela : compiler. Les 7 enums `GIA_LOGIN_INFORMATION_*` sont générés à partir de `translations-kore.json` et je les ai déduits des clés (`TITLE`, `LEARN_MORE`, `ACCESSIBILITY_HINT`, `MODAL_TITLE`, `MODAL_MESSAGE`, `MODAL_CONTINUE`, `MODAL_CANCEL`).

## 6. Points ouverts et risques

| # | Point | Nature |
| --- | --- | --- |
| 1 | Import `ca.dgag.ajusto.views.model.ShowExternalDSDDialog` (`WelcomeActivity.kt` l.28) alors que le package du fichier est `ca.dgag.ajusto.views.modal` | Incohérence dans la copie locale ; non modifiée. S'il ne compile pas, c'est la cause. |
| 2 | Départ des minuteurs : à l'arrivée de l'URL, pas à l'ouverture de l'écran | Choix de ma part ; le ticket ne le précise pas. L'iOS `LoginInformationCTA` permettrait de confirmer. |
| 3 | Rotation : la modale se ferme et les minuteurs repartent | Comportement acceptable à valider. |
| 4 | `DSDModal` : j'ignore s'il a un `onDismiss`. Un tap à l'extérieur ou le retour système n'enverrait pas `login_118` | À vérifier dans la bibliothèque DSD. |
| 5 | Le retour système est bloqué sur l'accueil (`setupBackPressHandler`) | À tester avec la modale ouverte. |
| 6 | Couleur de fond, position (haut à droite de l'illustration), typographie, texte sur deux lignes, icône | Provisoires, à aligner avec le Figma. |
| 7 | Chargement de l'URL non retenté après un échec | Comportement du ViewModel déjà écrit (`informationUrlLoadStarted`). |
| 8 | Commentaire Copilot « High » sur `catch (IllegalArgumentException)` : `Url(value)` lève `URLParserException`, qui hérite d'`IllegalStateException` | Concerne le shared (PR p2). À corriger avant le merge : `catch (Exception)` convient, le bloc est synchrone. |
| 9 | Les copies locales de `DynamicMessagesRemoteDataSource.kt` et de `KoreFeatureRuntimeKoinModules.kt` n'ont pas les changements des PR | Écart du disque, pas de la PR. |
| 10 | Rien n'a été compilé, exécuté ni testé | Les temps et l'aspect de l'animation sont déduits du code. |

## 7. Appliquer la proposition

Depuis la racine de `ad-digital-mobile-aio`, sur une branche de travail :

```text
git apply --check ../analyse/WRU-26416-bouton-information/proposition/android.patch
git apply ../analyse/WRU-26416-bouton-information/proposition/android.patch
```

Le diff a été vérifié en simulation sur la copie locale (`patch -p1 --dry-run`). Dans le vrai dépôt, les fichiers peuvent avoir changé : ce qui ne s'applique pas se reporte à la main à partir des fichiers de `src/`.
