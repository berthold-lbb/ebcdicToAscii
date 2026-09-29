# R1 — Code attendu

Le résultat attendu du récit R1. **L'arborescence de ce dossier reproduit celle du dépôt** : chaque
fichier est déjà à sa place.

**Tout ce qui suit est une proposition**, emplacements compris — voir « Un point à trancher » dans
le récit au sujet de `DeviceStateDataSource`, dont un homonyme existe déjà sous
`modules/transverse/domain/…/device/`.

Sur les fichiers **modifiés**, les lignes changées portent `// WRU-26599-R1` en fin de ligne, et le
reste du fichier est reproduit tel quel pour que le résultat soit lisible d'un seul tenant.

```
modules/feature/ajusto/domain/src/commonMain/…/contextualmessage/
├── datasource/
│   ├── DeviceStateDataSource.kt              CRÉÉ     le port, 4 booléens
│   └── CmtTripSignalsDataSource.kt           CRÉÉ     l'enregistrement seul, étendu par R3
└── usecase/
    └── ResolveContextualMessagesUseCase.kt   MODIFIÉ  resolveDeviceState() reçoit ses 3 branches

modules/feature/ajusto/data/src/androidMain/…/contextualmessage/datasource/
├── AndroidDeviceStateDataSource.kt           CRÉÉ     lit la batterie, l'économie, le fabricant
└── AndroidCmtTripSignalsDataSource.kt        CRÉÉ     lit le SDK, étendu par R3

modules/feature/ajusto/presentation/src/commonMain/…/summary/
└── ContextualMessageActivation.kt            MODIFIÉ  3 lignes passent de false à true
```

## Deux fichiers que je n'ai pas écrits, volontairement

Le récit en liste deux autres comme modifiés, et je ne peux pas produire leur contenu sans
inventer :

**`ContextualMessageMapper.kt`** — trois branches à compléter, avec les clés de traduction, les
icônes et les teintes des trois messages. Je n'ai lu ni la structure existante de ce fichier, ni la
liste réelle des clés Lokalise. Écrire des clés plausibles produirait du code qui compile et
n'affiche rien.

**`AjustoContextualMessageRepositoryImpl.kt`** — la combinaison des deux sources et l'assemblage des
signaux. Le squelette vient de R0, mais je n'ai pas lu la forme retenue pour le `combine` ni
l'enregistrement dans le graphe d'injection.

Dis-moi si tu veux que je lise ces deux fichiers dans le dépôt, et je complète.

## Un point ouvert dans le code livré

`AndroidCmtTripSignalsDataSource` **émet `false` en dur**. L'abonnement réel à l'observable du SDK
n'est pas écrit, et c'est délibéré : le récit demande de le faire relire par quelqu'un qui connaît
cette bibliothèque avant de l'écrire, parce qu'une conversion approximative produit une fuite
d'abonnement invisible en test.

Conséquence tant que ce n'est pas fait : le message « Mode économie d'énergie » s'affichera même
pendant un enregistrement. C'est un écart à corriger **avant** la fusion du récit, pas après.
