# R0 — Code attendu

Le résultat attendu du récit R0. **L'arborescence de ce dossier reproduit celle du dépôt** : chaque
fichier est déjà à sa place, il n'y a qu'à recopier les répertoires par-dessus.

Tous les fichiers de R0 sont **créés**, aucun n'est modifié — le marqueur `WRU-26599-R0` est donc
en en-tête plutôt que ligne par ligne.

```
modules/feature/ajusto/domain/src/commonMain/…/contextualmessage/
├── model/
│   ├── AjustoContextualMessage.kt            la sealed class, 8 variantes
│   ├── AjustoContextualSignals.kt            les 13 signaux, tous avec valeur par défaut
│   ├── AjustoMessageGroup.kt                 ADVICE · NOTICE · BADGE
│   └── AjustoBadgeScope.kt                   les 7 familles de médailles, TURN exclu
├── datasource/
│   ├── AjustoTip.kt                          déclaré ici, alimenté par R6
│   └── AjustoRecentTrip.kt                   déclaré ici, alimenté par R3
├── usecase/
│   └── ResolveContextualMessagesUseCase.kt   l'assemblage, les 4 familles encore vides
└── repository/
    └── AjustoContextualMessageRepository.kt  le port

modules/feature/ajusto/domain/src/commonTest/…/contextualmessage/
└── AjustoBadgeFactory.kt                     fabrique de médailles pour les tests

modules/feature/ajusto/presentation/src/commonMain/…/summary/
└── ContextualMessageActivation.kt            les 8 types à false

androidApp/src/main/kotlin/…/summary/preview/
└── ContextualMessageMockCatalog.kt           un exemplaire par type

androidApp/src/test/kotlin/…/summary/preview/
└── ContextualMessageMockCatalogTest.kt       garde-fou d'intégration continue
```

## Trois points à savoir avant de lire

**`AjustoTip` et `AjustoRecentTrip` sont sous `datasource/`, pas sous `model/`.** Ce sont les
formes que rendent deux ports, pas des concepts du domaine — elles suivent leur port, comme le
fait déjà `AjustoTipDataSource` dans le dépôt.

**Il n'y a ni champ `priority`, ni tri.** L'ordre d'affichage est donné par l'ordre des quatre
lignes de `resolve()`, et nulle part ailleurs. Une version antérieure portait un `priority` sur
chaque variante plus un tri à deux clés : trois endroits encodaient le même ordre, avec le risque
de désynchronisation que ça implique.

**Les quatre fonctions de résolution rendent `null`.** C'est volontaire : R0 livre un squelette
inerte. Les `TODO` nomment le récit qui remplira chaque branche.
