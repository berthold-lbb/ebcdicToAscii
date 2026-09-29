# WRU-26599-R0 — Détail technique

Pièce jointe du récit R0. Le récit dit *quoi* et *pourquoi* en langage fonctionnel ; ce document
dit *où* et *comment*.

**Tout ce qui suit est une proposition — sans exception.** Les noms, les emplacements et jusqu'aux
mécanismes eux-mêmes (le filtre d'activation, le catalogue d'aperçus) sont des choix à valider en
revue. Chaque entrée est justifiée : si une justification ne tient pas, c'est l'entrée qui tombe.

---

## 1. Le principe directeur

L'ancien socle Java décide *et* rend du texte déjà traduit, dans la même méthode
(`AjustoContextualMessageHelper.findContextualMessage()`, 183 lignes, dépôt
`ad-digital-mobile-core-lib`). Les deux responsabilités sont soudées, et c'est ce qui rend la
dépendance impossible à couper.

**On déplace la décision, pas les données.** Le domaine émet *quel cas s'applique*, sans un mot de
texte. La couche présentation, et elle seule, connaît les libellés, les icônes et les teintes.

Conséquence structurelle : les flèches vont toujours vers le domaine.

| Module | Ce qu'il contient | Ce dont il dépend |
|---|---|---|
| `modules/feature/ajusto/domain` | modèle, règles, use case, ports | rien : ni Android, ni SDK, ni Core, ni réseau |
| `modules/feature/ajusto/data` | implémentations des ports (`dto/`, `http/`, `datasource/`, `repository/`) | le domaine ; seul ce qui a besoin du SDK descend en `androidMain` |
| `modules/feature/ajusto/presentation` | libellés traduits, icônes, teintes | le domaine |
| `androidApp` | écrans Compose, adaptateurs SDK, injection, aperçus | tout le reste |

---

## 2. Arborescence proposée

Ne figure ici que ce que R0 livre réellement. `rule/` et `datasource/` du domaine se remplissent
aux récits suivants et ne sont donc pas créés.

### Le code

```
modules/feature/ajusto/domain/src/commonMain/…/ajusto/domain/contextualmessage/
├── model/
│   ├── AjustoContextualMessage.kt            sealed, 8 variantes, aucun texte
│   ├── AjustoContextualSignals.kt            les 13 signaux, tous avec valeur par défaut
│   ├── AjustoMessageGroup.kt                 ADVICE · NOTICE · BADGE
│   └── AjustoBadgeScope.kt                   les familles de médailles retenues
├── datasource/
│   ├── AjustoTip.kt                          le contenu d'un « Bon à savoir », alimenté en R6
│   └── AjustoRecentTrip.kt                   un trajet récent réduit à 3 champs, alimenté en R3
├── usecase/
│   └── ResolveContextualMessagesUseCase.kt   assemble, aucune règle branchée
└── repository/
    └── AjustoContextualMessageRepository.kt  le port

modules/feature/ajusto/data/src/commonMain/…/ajusto/data/contextualmessage/repository/
└── AjustoContextualMessageRepositoryImpl.kt  squelette, étendu par chaque récit

modules/feature/ajusto/presentation/src/commonMain/…/presentation/summary/
├── ContextualMessageActivation.kt            8 types à false
└── ContextualMessageMapper.kt                une branche par type, à compléter

androidApp/src/main/…/feature/ajusto/presentation/summary/
├── view/
│   └── AjustoSummaryMessageBox.kt                 la boîte affichée + les 2 aperçus
└── preview/
    ├── ContextualMessageMockCatalog.kt            un exemplaire par type
    └── AjustoSummaryMessageBoxMockProvider.kt     alimente les aperçus depuis le catalogue
```

### Les tests

```
modules/feature/ajusto/domain/src/commonTest/…/contextualmessage/
├── AjustoBadgeFactory.kt                         fabrique un badge pour les tests
└── usecase/
    └── ResolveContextualMessagesUseCaseTest.kt   l'ordre de sortie et la liste vide

androidApp/src/test/…/presentation/summary/preview/
└── ContextualMessageMockCatalogTest.kt           échoue si un type n'a pas d'exemplaire
```

Le résultat attendu, fichier par fichier, est dans le dossier `code-attendu/` — mêmes chemins
qu'ici.

---

## 3. Où s'inspirer pour chaque modèle

Aucun modèle ne s'invente : chacun a une contrepartie lisible, dans le Core Java ou dans le code
Android existant. On y lit la **décision**, jamais le texte.

| Modèle à écrire | Où le lire avant de l'écrire | Ce qu'on y prend |
|---|---|---|
| `AjustoContextualMessage` | `core-lib` `ajusto/core/trip/AjustoContextualMessageHelper.java` | les huit cas de la cascade et leur ordre |
| `AjustoContextualSignals` | même fichier, plus `core-lib` `ajusto/core/DeviceInfo.java` et `aio` `androidApp/…/core/impl/legacy/DeviceInfoImpl.kt` | la liste de ce que la cascade interroge réellement |
| `AjustoMessageGroup` | aucune source Java — le regroupement n'existe pas dans le Core. Rendu actuel dans `aio` `androidApp/…/ajusto/dashboard/AjustoDashboardFragment.kt` | les trois groupes viennent de la maquette du Summary |
| `AjustoBadgeScope` | `core-lib` `ajusto/core/badge/Badge.java` et `badge/BadgeScoper.java` | les identifiants de famille et les exclusions |
| `AjustoRecentTrip` | `core-lib` `ajusto/core/trip/TripServiceImpl.java` et `classifyinvite/ClassifyInviteChecker.java` | les trois seuls champs consommés : date, étiqueté, rattrapage |
| `AjustoTip` | aucune source — ce message n'existe pas côté Java | déclaré vide ici, source tranchée en R6 |

Deux modèles **ne sont pas à créer**, ils existent et se réutilisent tels quels :

| Modèle existant | Où il est |
|---|---|
| `AjustoBadge` | `aio` `modules/feature/ajusto/domain/…/achievements/model/AjustoBadge.kt` |
| `AjustoSummaryUiStateModel.MessageBox` | `aio` `modules/feature/ajusto/presentation/…/summary/AjustoSummaryUiState.kt` |

---

## 4. Pourquoi ces fichiers, et pas d'autres

**Les huit variantes sont déclarées dès maintenant**, même si aucune n'est produite. Ce sont de
simples déclarations, et les déclarer ensemble évite un modèle taillé pour le premier message et
inadapté au septième.

**Tous les signaux ont une valeur par défaut**, celle qui ne déclenche aucune alerte. C'est ce qui
permet à une règle de se prononcer dès que *ses* signaux sont connus, sans attendre les autres — et
donc à un récit de brancher son signal sans que les douze autres existent.

**`AjustoTip` et `AjustoRecentTrip` sont sous `datasource/`, pas sous `model/`.** Ce sont les formes
que rendent deux ports, pas des concepts du domaine. Ils suivent leur port, comme le fait déjà
`AjustoTipDataSource` dans le dépôt.

**`ContextualMessageMapper` est le seul endroit qui connaît les mots.** Il prend un message du
domaine, sans texte, et rend la `MessageBox` de l'écran : titre traduit, texte, clé d'icône, teinte,
action éventuelle. C'est lui qui garantit que le domaine reste sans langue et sans Android.

**`AjustoSummaryMessageBox` est la boîte à l'écran.** Composant Compose qui empile les boîtes
reçues, ou n'affiche rien si la liste est vide — état normal, pas une erreur.

**`ContextualMessageMockCatalog` est la source unique des exemples d'aperçu**, avec deux garde-fous :
un `when` exhaustif sans branche `else`, qui casse la compilation si un neuvième type apparaît sans
exemplaire, et `ContextualMessageMockCatalogTest`, qui échoue en CI si la liste n'a pas été remplie.

**Pourquoi un catalogue alors qu'il existe déjà des mock providers.** L'écran Summary en a plusieurs,
tous écrivant leurs valeurs à la main. Le provider de cette zone ne le fait pas : il *dérive* du
catalogue et passe par le vrai mapper. Un nouveau type obtient donc son aperçu sans que personne y
pense, et un aperçu ne peut plus mentir quand une clé de traduction ou une teinte change.

**`ContextualMessageActivation` est un interrupteur par type, et c'est une proposition à part
entière.** Le besoin n'est pas discutable : R0 déclare huit types d'un coup, aucun n'a de règle
branchée — sans filtre, le premier message livré sortirait avec sept types vides. La proposition est
un `when` exhaustif livré avec les huit types à `false`, que chaque récit bascule à `true`. Trois
conséquences à peser en revue :

- le filtre est au *dernier* étage, juste avant la traduction : un message désactivé reste visible
  en aperçu et peut être montré à l'équipe sans être exposé en production ;
- l'exhaustivité du `when` casse la compilation le jour où un neuvième type apparaît : impossible
  d'oublier de se prononcer sur lui ;
- **en contrepartie, activer un message demande de recompiler.** Si l'équipe veut l'activer à
  distance, c'est un autre mécanisme — et le choix se fait maintenant, pas après R5.

**`AjustoBadgeFactory` existe pour une raison vérifiable en trois secondes.** Dans `AjustoBadge`,
seize champs sur dix-huit ont une valeur par défaut — mais pas `nextBadge` ni `previousBadge`. Toute
construction doit donc les passer explicitement, `null` compris. Sans cette fabrique, chaque test qui
a besoin d'une médaille répète ces deux lignes de bruit. Elle vit en `commonTest`, invisible de la
production. Si ces deux champs gagnent un jour une valeur par défaut, la fabrique se supprime.

**Le dossier `rule/` n'est pas créé ici** parce qu'il serait vide. Il accueillera les règles qui ne
tiennent pas en une ligne : l'invitation à identifier un trajet (R3), le calcul des jours avant
l'entrée en vigueur (R4), le périmètre des médailles et le choix de la médaille à proposer (R5). Les
règles de R1 et R2 tiennent dans le use case.

---

## 4 bis. Les aperçus, et comment ils évoluent récit après récit

`AjustoSummaryMessageBoxMockProvider` produit trois familles d'aperçus, dans cet ordre :

1. **la zone vide** — état normal confirmé produit, le cas à ne surtout pas régresser ;
2. **chaque type, un par un** — les huit, y compris ceux qui sont encore éteints. C'est ce qui
   permet de faire relire un message par le design ou le métier avant qu'il soit actif ;
3. **l'empilement réellement affiché** — le catalogue passé au filtre de
   `ContextualMessageActivation`.

**C'est la troisième famille qui évolue toute seule.** Elle ne liste rien à la main : elle prend le
catalogue et garde ce que l'activation laisse passer. À la livraison de R0, tous les interrupteurs
sont à `false` : cet aperçu est vide. Quand R1 bascule ses trois lignes à `true`, le *même* aperçu
montre trois boîtes. Aucun fichier d'aperçu n'a été touché.

Un récit n'a donc **rien à écrire côté aperçu** : son message a déjà son exemplaire dans le
catalogue depuis R0, et l'empilement se met à jour par le seul fait de basculer l'interrupteur.

**Ce que les aperçus ne montrent pas, et ne doivent pas montrer.** Ils rendent des messages, pas des
règles : ils ne disent pas *dans quelles conditions* un message sort. Vérifier qu'une batterie à
15 % branchée sur secteur ne déclenche rien, ou qu'une cascade ne laisse sortir qu'une seule boîte,
relève des tests unitaires de `ResolveContextualMessagesUseCase`, où ça se lit et s'exécute en
millisecondes. Chaque récit R1 à R6 apporte donc **ses tests de règles**, pas ses aperçus.

---

## 5. Les treize signaux et le récit qui les branche

| Source | Signaux produits | Récit |
|---|---|---|
| État du téléphone (OS) | ⑦ batterie faible · ⑧ charge soutenue · ⑨ économie d'énergie · ⑩ marque | R1 |
| SDK télématique — trajets | ① trajets récents · ② enregistrement en cours | R1, R3 |
| SDK télématique — profil | ⑪ jours avant l'entrée en vigueur | R4 |
| Requête HTTP signée par le SDK | ③ médailles brutes | R5 |
| Requête HTTP + cache local | ④ appareil compatible | R2 |
| Compte Ajusto — déjà en KMP | ⑤ mode · ⑥ nombre de trajets · ⑬ nom du programme | R3 |
| Stockage local du téléphone | ⑫ invitation écartée | R3 |
| « Bon à savoir » — source non tranchée | règle 8 | R6 |

---

## 6. Vérifier localement

```bash
# compilation du module domaine
./gradlew :modules:feature:ajusto:domain:build

# tests du domaine, toutes plateformes
./gradlew :modules:feature:ajusto:domain:allTests

# test du catalogue d'aperçus
./gradlew :androidApp:testDebugUnitTest --tests "*ContextualMessageMockCatalogTest*"
```

---

## 7. Références

**Dépôt `ad-digital-mobile-core-lib`**, sous `src/main/java/ca/dgag/ajusto/core/` :

- `trip/AjustoContextualMessageHelper.java` — la cascade complète, référence pour l'ordre des règles
- `badge/Badge.java` et `badge/BadgeScoper.java` — familles de médailles et exclusions
- `DeviceInfo.java` — les signaux d'état du téléphone

**Dépôt `ad-digital-mobile-aio`** :

- `androidApp/src/main/java/ca/dgag/ajusto/ajusto/dashboard/AjustoDashboardFragment.kt` — le rendu actuel, référence visuelle
- `androidApp/src/main/java/ca/dgag/ajusto/core/impl/legacy/DeviceInfoImpl.kt` — l'adaptateur Android existant
