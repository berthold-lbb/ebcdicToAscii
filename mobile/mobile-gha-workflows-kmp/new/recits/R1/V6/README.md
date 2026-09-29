# WRU-26599-R1 — Détail technique

Pièce jointe du récit R1. Le récit dit *quoi* et *pourquoi* en langage fonctionnel ; ce document
dit *où* et *comment*.

**Tout ce qui suit est une proposition — sans exception**, emplacements compris. Un emplacement
reste ouvert : voir §5.

---

## 1. Les trois règles, telles qu'elles sont écrites en Java

| Message | Condition |
|---|---|
| Marque non compatible | le fabricant est sur liste d'exclusion — comparaison insensible à la casse, fabricant inconnu réputé compatible |
| Batterie faible | niveau ≤ 20 % **et** appareil pas en charge |
| Mode économie d'énergie | le mode est actif **et** aucun trajet en cours d'enregistrement |

Elles sont **en cascade entre elles** : deux problèmes simultanés ne donnent qu'un message, le
premier de cette liste. `DeviceNotCompatible` s'insérera entre la marque et la batterie au récit R2,
sans rien changer ici.

Côté Java, ces trois règles reçoivent le mode du compte en paramètre et **ne s'en servent jamais**.
Ne pas reporter ce paramètre mort.

Les trois sources viennent toutes d'Android, mais par trois mécanismes différents — et c'est ce qui
explique les deux comportements hérités listés dans le récit :

| Signal | Mécanisme Android | Conséquence |
|---|---|---|
| batterie, en charge | diffusion système `ACTION_BATTERY_CHANGED`, poussée vers l'app | le receveur n'est enregistré qu'en avant-plan |
| mode économie | lecture à la demande sur `PowerManager` | Android ne prévient jamais du changement |
| fabricant | constante `Build.MANUFACTURER` | ne change jamais en cours d'exécution |

---

## 2. Arborescence proposée

### Le code

```
modules/feature/ajusto/domain/src/commonMain/…/contextualmessage/
├── datasource/
│   ├── DeviceStateDataSource.kt              CRÉÉ     le port, 4 signaux de l'OS
│   └── CmtTripSignalsDataSource.kt           CRÉÉ     l'enregistrement seul, étendu par R3
└── usecase/
    └── ResolveContextualMessagesUseCase.kt   MODIFIÉ  la première famille reçoit ses 3 branches

modules/feature/ajusto/data/src/androidMain/…/contextualmessage/datasource/
├── AndroidDeviceStateDataSource.kt           CRÉÉ     lit la batterie, l'économie, le fabricant
└── AndroidCmtTripSignalsDataSource.kt        CRÉÉ     lit le SDK télématique

modules/feature/ajusto/data/src/commonMain/…/ajusto/data/
├── contextualmessage/repository/
│   └── AjustoContextualMessageRepositoryImpl.kt  MODIFIÉ  combine les deux sources
└── AjustoDataModule.kt                       MODIFIÉ  enregistre les deux adaptateurs

modules/feature/ajusto/presentation/src/commonMain/…/summary/
├── ContextualMessageMapper.kt                MODIFIÉ  3 branches complétées
└── ContextualMessageActivation.kt            MODIFIÉ  3 lignes passent de false à true

modules/feature/ajusto/data/build.gradle.kts  MODIFIÉ  dépendance SDK dans androidMain
```

**Rien à écrire côté aperçu.** Les trois messages ont déjà leur exemplaire dans
`ContextualMessageMockCatalog` depuis R0. Basculer les trois lignes d'activation suffit : le
troisième aperçu du provider — celui qui montre l'empilement réellement affiché — passe de vide à
trois boîtes tout seul. C'est le contrôle visuel du récit, et il ne coûte aucune ligne.

**Ce que l'aperçu ne prouve pas, et que les tests doivent prouver.** L'aperçu montre les trois
boîtes ; il ne dit pas dans quelles conditions elles sortent. Les quatre cas qui comptent vont dans
`ResolveContextualMessagesUseCaseTest` :

| Cas | Attendu |
|---|---|
| batterie ≤ 20 %, débranché | le message batterie |
| batterie ≤ 20 % **mais en charge** | rien — la seconde moitié de la règle |
| marque non supportée **et** batterie faible | **un seul** message, celui de la marque — la cascade |
| mode économie **pendant** un enregistrement | rien — et c'est ce cas qui échouera tant que l'adaptateur SDK émettra `false` en dur (voir §6) |

Le dernier est le test qui garde le point ouvert du §6 visible : tant qu'il est rouge, le récit
n'est pas fusionnable.

### Les tests

```
modules/feature/ajusto/domain/src/commonTest/…/contextualmessage/usecase/
└── ResolveContextualMessagesUseCaseTest.kt   ÉTENDU   les 3 règles et leur cascade

modules/feature/ajusto/data/src/androidUnitTest/…/contextualmessage/datasource/
└── AndroidDeviceStateDataSourceTest.kt       CRÉÉ     lecture des 4 signaux, valeurs limites

modules/feature/ajusto/data/src/androidInstrumentedTest/…/contextualmessage/datasource/
└── DeviceStateForegroundTest.kt              CRÉÉ     le retour d'avant-plan relit la batterie
```

Le résultat attendu, fichier par fichier, est dans le dossier `code-attendu/`. Sur les fichiers
modifiés, les lignes changées portent `// WRU-26599-R1` en fin de ligne.

---

## 3. Où s'inspirer pour chaque fichier

Rien ne s'invente : chaque adaptateur a une contrepartie déjà écrite. On reprend la **lecture du
signal**, jamais le texte ni la décision d'affichage.

| Fichier à écrire | Où le lire avant de l'écrire | Ce qu'on y prend |
|---|---|---|
| `DeviceStateDataSource` (port) | `core-lib` `ajusto/core/DeviceInfo.java` | la liste des signaux d'appareil réellement consommés — le Java en expose dix-sept, quatre nous concernent |
| `AndroidDeviceStateDataSource` | `aio` `androidApp/…/core/impl/legacy/DeviceInfoImpl.kt` | les lectures Android exactes : seuil de batterie, champ « en charge », service système, liste d'exclusion de fabricants |
| `CmtTripSignalsDataSource` (port) | `aio` `androidApp/…/com/mirego/cmt/wrapper/trips/CMTTripManagerImpl.kt` | le seul booléen dont R1 a besoin, et sa façon d'être rafraîchi |
| `AndroidCmtTripSignalsDataSource` | même fichier, **l. 52** et **l. 80** | l'appel réel au SDK et son observable — *à relire avec quelqu'un qui connaît cette bibliothèque* |
| les 3 règles du use case | `core-lib` `ajusto/core/trip/AjustoContextualMessageHelper.java` | les conditions exactes et leur ordre dans la cascade |
| les 3 branches du mapper | `aio` `androidApp/…/ajusto/dashboard/AjustoDashboardFragment.kt` | le rendu actuel : titre, icône, teinte — la référence visuelle, pas le Java |

---

## 4. Pourquoi ces fichiers, et pas d'autres

**Deux ports plutôt qu'un.** Les quatre signaux de l'OS et le booléen du SDK pourraient tenir dans
un seul port. Ils sont séparés parce qu'ils n'ont ni la même durée de vie ni les mêmes contraintes :
l'OS répond toujours, le SDK ne répond que si la personne est authentifiée. Les mélanger rendrait
l'ensemble indisponible dès que le SDK l'est, et ferait descendre les trois messages d'appareil avec
lui.

**`CmtTripSignalsDataSource` ne porte qu'un booléen, volontairement.** R3 y ajoutera la liste des
trajets récents. Le nommer au pluriel dès maintenant évite de renommer un port public au récit
suivant ; ne lui donner qu'un membre évite d'écrire en R1 du code que seul R3 utilisera.

**Le fabricant n'est pas un flux.** `Build.MANUFACTURER` ne change jamais en cours d'exécution. Le
port l'expose comme une valeur simple, là où les trois autres signaux sont observables. Un flux qui
n'émet qu'une fois coûterait un abonnement pour rien.

**L'adaptateur descend en `androidMain`, le port reste en `commonMain`.** C'est la seule raison pour
laquelle le domaine peut ignorer Android : le use case ne voit que quatre booléens.

**Les trois règles restent dans le use case, pas dans `rule/`.** Chacune tient en une ligne. Une
classe par ligne ajouterait trois fichiers, trois injections et trois tests pour une condition
lisible sur place. `rule/` accueillera celles qui ne tiennent pas en une ligne, à partir de R3.

**Le fichier d'activation est modifié, pas réécrit.** Trois lignes passent de `false` à `true` ; les
cinq autres restent à `false`. C'est le geste qui fait apparaître les messages à l'écran.

---

## 5. Un point à trancher : où vit le port d'état d'appareil

L'arborescence ci-dessus place `DeviceStateDataSource` sous `feature/ajusto/domain`. **Un port du
même nom existe déjà dans le dépôt** sous `modules/transverse/domain/…/device/`, avec son
implémentation Android à côté.

Les deux emplacements se défendent : l'état du téléphone n'a rien de propre à Ajusto, ce qui plaide
pour `transverse` ; mais seul Ajusto le consomme aujourd'hui, ce qui plaide pour le garder dans la
feature tant qu'il n'a qu'un client. **Trancher avant d'écrire le code** — déplacer un port public
après coup touche l'injection et tous ses appelants.

---

## 6. Deux fichiers non écrits dans `code-attendu/`, volontairement

**`ContextualMessageMapper.kt`** — trois branches à compléter, avec les clés de traduction, les
icônes et les teintes. La liste réelle des clés Lokalise n'a pas été relue ; écrire des clés
plausibles produirait du code qui compile et n'affiche rien.

**`AjustoContextualMessageRepositoryImpl.kt`** — la combinaison des deux sources. Le squelette vient
de R0, mais la forme retenue pour le `combine` et l'enregistrement dans le graphe d'injection
restent à relire dans le dépôt.

**Point ouvert dans le code livré :** `AndroidCmtTripSignalsDataSource` émet `false` en dur.
L'abonnement réel à l'observable du SDK n'est pas écrit, et c'est délibéré — une conversion
approximative produit une fuite d'abonnement invisible en test. Conséquence tant que ce n'est pas
fait : le message « Mode économie d'énergie » s'affiche même pendant un enregistrement.

---

## 7. Vérifier localement

```bash
# compilation des modules touchés
./gradlew :modules:feature:ajusto:domain:build :modules:feature:ajusto:data:build

# tests unitaires
./gradlew :modules:feature:ajusto:domain:allTests :modules:feature:ajusto:data:allTests

# test instrumenté du retour d'avant-plan
./gradlew :modules:feature:ajusto:data:connectedAndroidTest
```

---

## 8. Références

- `core-lib` : `src/main/java/ca/dgag/ajusto/core/DeviceInfo.java`, `…/core/trip/AjustoContextualMessageHelper.java`
- `aio` : `androidApp/src/main/java/ca/dgag/ajusto/core/impl/legacy/DeviceInfoImpl.kt`, `androidApp/src/main/java/com/mirego/cmt/wrapper/trips/CMTTripManagerImpl.kt`
