# Explication du code proposé, bloc par bloc

Les numéros de ligne renvoient aux fichiers de [src/](./src/) (copies corrigées, même chemin que dans le dépôt), pas aux sources actuelles. Rien n'a été compilé ni exécuté : ce qui concerne le rendu ou le comportement à l'exécution est un raisonnement sur le code, à confirmer sur appareil.

## 1. `ShowExternalDSDDialogComposable.kt` — textes paramétrables

| Lignes | Code | Ce qu'il fait | Pourquoi |
| --- | --- | --- | --- |
| 22-23 | `primaryButtonOnClick`, `secondaryButtonOnClick` | Les deux paramètres existants, inchangés | L'appel « mot de passe oublié » (`WelcomeActivity` l.78) les passe par nom et continue de compiler. |
| 24-27 | `title`, `message`, `primaryText`, `secondaryText` avec les anciens textes en valeur par défaut | 4 paramètres nouveaux et optionnels | Sans eux, la modale ne peut afficher que les textes génériques. Une valeur par défaut peut appeler `.get()`, car l'expression est évaluée dans le contexte composable de l'appelant. |
| 30 | `title = title` | Le titre vient du paramètre | Avant : valeur codée en dur dans le corps. |
| 31, 34 | `DSDModalButton(text = primaryText)`, `(text = secondaryText)` | Le libellé des boutons vient des paramètres | Ticket : « Continuer vers le site » et « Annuler ». |
| 38 | `Text(text = message)` | Le message vient du paramètre | Ticket : « La page s'affichera dans le navigateur Web de votre appareil. » |

Les aperçus du même fichier appellent `ShowExternalDSDDialog()` sans argument : ils gardent les textes d'avant.

## 2. `WelcomeActivity.kt` — modale, actions et réaction

### 2.1 L'état de la modale (l.56)

```kotlin
private var showInformationModal by mutableStateOf(false)
```

Une propriété de l'activité adossée à un état Compose. `setContent` la lit (l.88) : quand elle change, Compose recompose et affiche ou retire la modale. Elle est dans l'activité, et non dans `setContent`, parce que `actionListener` (une propriété de l'activité) doit pouvoir la modifier. C'est le rôle que jouait `showDialogSetter` pour la modale existante. Conséquence : elle n'est pas sauvegardée, donc elle est perdue à la rotation.

### 2.2 L'interception des actions (l.58-64)

| Ligne | Code | Effet |
| --- | --- | --- |
| 59 | `when (action)` | `action` est de type `WelcomeAction?`. |
| 60 | `null -> Unit` | Une action nulle ne fait rien. C'est l'ancien `action?.let`. |
| 61 | `WelcomeAction.InformationLinkTapped -> onInformationLinkTapped()` | Cette action-là n'est pas envoyée telle quelle au ViewModel : elle déclenche aussi l'ouverture de la modale. |
| 62 | `else -> viewModel.executeAction(action)` | Toutes les autres actions passent comme avant. Après la branche `null`, `action` est connue comme non nulle. |

### 2.3 La modale (l.88-103)

| Lignes | Effet |
| --- | --- |
| 88 | N'affiche la modale que si `showInformationModal` est vrai. |
| 90-93 | Textes du ticket, lus par `GiaLocalizedString.….get()` : la langue de l'appareil décide EN ou FR. |
| 94-97 | « Continuer » : ferme la modale, puis envoie `ContinueInformation` (analytics `login_117`). Le ViewModel répond par la réaction `OpenExternalBrowser`. |
| 98-101 | « Annuler » : ferme la modale, puis envoie `CancelInformation` (analytics `login_118`). Rien d'autre : l'accueil et le bouton sont déjà à l'écran. |

La modale est placée avant `showDialogSetter` (l.105), donc à côté de la modale « mot de passe oublié » sans la toucher.

### 2.4 La réaction (l.140-141)

```kotlin
is WelcomeReaction.OpenExternalBrowser ->
    startActivity(Intent(Intent.ACTION_VIEW, reaction.url.toUri()))
```

`is` est nécessaire car `OpenExternalBrowser` est une `data class` qui porte l'URL (les autres réactions de la liste sont des `data object`). L'URL vient de la réaction, jamais de l'interface : le ViewModel est seul à la connaître. `ACTION_VIEW` demande à Android d'ouvrir le navigateur par défaut, ce que le ticket appelle « navigateur externe ».

### 2.5 Le tap (l.154-158)

```kotlin
private fun onInformationLinkTapped() {
    viewModel.executeAction(WelcomeAction.InformationLinkTapped)   // login_115
    viewModel.executeAction(WelcomeAction.InformationModalViewed)  // login_047
    showInformationModal = true
}
```

`executeAction` appelle `trackAction`, qui envoie l'analytics des actions de type `ActionAnalytics`, puis `handleAction` (`BaseViewModel` l.76-79). Deux actions distinctes parce que deux événements distincts : le clic (`login_115`) et la vue de la modale (`login_047`, un événement d'écran). La modale est ouverte en dernier, pour que `login_047` corresponde à une modale réellement affichée.

## 3. `WelcomeView.kt` — le bouton

### 3.1 L'appel dans l'écran (l.223-230)

| Ligne | Code | Pourquoi |
| --- | --- | --- |
| 223 | `if (state.informationUrl != null)` | Pas d'URL valide, pas de bouton. C'est l'état du ViewModel qui décide. |
| 226 | `.align(Alignment.TopEnd)` | Le bouton est placé en haut à droite du `Box` de l'illustration. Position provisoire, à aligner avec le Figma. |
| 227 | `.padding(top = medium, end = medium)` | Marges de 16 dp, la constante existante du fichier. |
| 228 | `actionListener.onClick(WelcomeAction.InformationLinkTapped)` | Le bouton ne connaît pas la modale : il signale seulement l'action. |

L'appel est placé après la carte blanche (qui se termine à la l.222) : dans un `Box`, ce qui est écrit après est dessiné par-dessus.

### 3.2 L'état du bouton (l.329-330)

```kotlin
var visible by rememberSaveable { mutableStateOf(false) }
var expanded by rememberSaveable { mutableStateOf(true) }
```

Deux booléens. `visible` : le bouton est-il arrivé ? `expanded` : le texte est-il déployé ? `rememberSaveable` les conserve à la rotation (et à la recréation du processus), alors que `remember` les perdrait.

### 3.3 Les minuteurs (l.332-337)

```kotlin
LaunchedEffect(Unit) {
    delay(INFO_SHOW_DELAY_MS)       // 1 000 ms
    visible = true
    delay(INFO_COLLAPSE_DELAY_MS)   // 5 000 ms
    expanded = false
}
```

`LaunchedEffect(Unit)` lance une coroutine quand le composable entre dans l'arbre, une seule fois (la clé `Unit` ne change jamais). Elle est annulée si le composable quitte l'écran. La séquence est linéaire : 1 s d'attente, apparition, 5 s d'attente, repli. Les 5 s sont donc comptées à partir du début de l'apparition.

### 3.4 L'indice d'accessibilité (l.339)

Lu hors de la coroutine, car `.get()` est composable. Texte : « Ouvre l'information sur la nouvelle méthode de connexion ».

### 3.5 L'apparition (l.341-346)

| Ligne | Code | Effet |
| --- | --- | --- |
| 342 | `visible = visible` | Quand la valeur passe de faux à vrai, Compose joue la transition d'entrée. Tant qu'elle est fausse, rien n'est dessiné. |
| 344 | `slideInHorizontally(tween(400)) { fullWidth -> fullWidth }` | La fonction renvoie le décalage de départ : une largeur complète vers la droite. Le bouton glisse donc depuis la droite vers sa place en 400 ms. |
| 345 | `+ fadeIn(tween(400))` | `+` combine deux transitions jouées en même temps : glissement et fondu. |

### 3.6 La pastille (l.347-355)

L'ordre des modificateurs compte :

| Ligne | Modificateur | Rôle |
| --- | --- | --- |
| 349 | `.clip(RoundedCornerShape(percent = 50))` | Découpe en forme de pilule. Quand la largeur devient égale à la hauteur, elle devient un cercle. |
| 350 | `.background(colorResource(dsd_confirmation_4))` | Le fond. Couleur provisoire (celle des boutons verts de l'écran). |
| 351 | `.clickable(role = Role.Button, onClick = onClick)` | Rend la pastille cliquable ; l'effet de pression est découpé par le `clip`. `Role.Button` fait annoncer « bouton » par TalkBack. |
| 352 | `.semantics { contentDescription = accessibilityHint }` | Texte lu par TalkBack à la place du contenu, dans l'état étendu comme replié. |
| 353 | `.padding(12.dp)` | Marge **intérieure** (après le `clickable`), donc comprise dans la zone tactile : 24 dp d'icône + 2 × 12 dp = 48 dp. |

### 3.7 L'icône (l.356-361)

`Icons.Filled.Info` est un remplaçant. Elle vient de `material-icons-core`, déjà utilisée dans `WebviewComposable.kt`. L'icône est blanche (`tint`) et décorative (`contentDescription = null`) : le texte lu est déjà porté par la pastille.

### 3.8 Le repli du texte (l.362-379)

| Ligne | Code | Effet |
| --- | --- | --- |
| 363 | `visible = expanded` | Vrai au départ, puis faux après 6 s. |
| 364-365 | `enter = expandHorizontally + fadeIn` | Utilisée si le texte revient (par exemple après une recomposition avec `expanded = true`). |
| 366-367 | `exit = shrinkHorizontally + fadeOut` | Le bloc de texte se rétrécit en largeur en 400 ms en s'estompant. |
| 369 | `Column(Modifier.padding(start = small))` | Deux lignes de texte, à 8 dp de l'icône. |
| 371, 375 | `GIA_LOGIN_INFORMATION_TITLE` et `…_LEARN_MORE` | « La connexion évolue » puis « En savoir plus ». |

Comme le fond est posé sur le `Row` parent (l.349-350) et que le `Row` prend la taille de son contenu, la pastille se contracte en même temps que le texte. Aucune animation de taille n'a besoin d'être écrite à la main.

### 3.9 Constantes et styles (l.388-390, l.401-418)

- `1_000L`, `5_000L`, `400` : les temps du ticket et la durée des transitions, regroupés en haut du fichier pour être changés au même endroit.
- `informationTitleTextStyle` (14 sp, gras) et `informationLearnMoreTextStyle` (12 sp, souligné) : blanc sur le fond vert. Tailles provisoires, à aligner avec le Figma. Ce sont des fonctions `@Composable`, comme `titleTextStyle()` juste au-dessus, qui suivent le même modèle.

## 4. Ce que ce code ne fait pas

| Sujet | Situation |
| --- | --- |
| Fermer la modale au retour système ou au tap extérieur | Non géré : je ne connais pas la signature de `DSDModal`. |
| Conserver la modale à la rotation | Non : l'état est dans l'activité, sans sauvegarde. |
| Icône `ico_learn_more` | Remplacée par `Icons.Filled.Info`. |
| Position, couleur, typographie | Provisoires. |
| Écran « legacy » | Non traité. |
| Tests automatisés | Aucun ajouté ; la liste des scénarios manuels est dans `PROPOSITION-FINALE.md` §5. |
