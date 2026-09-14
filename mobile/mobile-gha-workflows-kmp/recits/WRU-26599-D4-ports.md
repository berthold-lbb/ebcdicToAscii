# WRU-26599-D4 — Les ports du domaine

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/domain` — commonMain |
| **Estimation** | 0,5 j |
| **Dépend de** | D1 |
| **Bloque** | A1, A2, A4, A5 |

## Contexte

Les interfaces que la couche data devra implémenter. Elles ne contiennent aucune logique : c'est
le contrat, et il doit être stable avant que quiconque attaque la couche data.

## Fichier de référence — à lire avant d'écrire

| Ce qu'on écrit | Se calquer sur |
|---|---|
| Port de repository | `domain/.../ajusto/domain/achievements/repository/AjustoBadgeRepository.kt` |
| Port de datasource distant | `domain/.../ajusto/domain/history/datasource/AjustoHistoryPeriodDataSource.kt` |
| Modèle de réponse enveloppée | `domain/.../ajusto/domain/history/model/AjustoHistoryPeriodResponse.kt` |
| Mapping d'erreur | `domain/.../ajusto/domain/history/model/AjustoHistoryPeriodError.kt` |

> Les deux premiers montrent la convention exacte : `fun interface`, `suspend`,
> `Result<Succès, Erreur>`, annotation `@NativeCoroutinesRefined`.

## Fichiers à créer

- `contextualmessage/repository/AjustoContextualMessageRepository.kt` — `Flow<List<AjustoContextualMessage>>`
- `contextualmessage/datasource/CmtTripSignalsDataSource.kt` — `isRecording` + `recentTrips`
- `contextualmessage/datasource/AjustoRecentTrip.kt` — 3 champs, aucun type CMT
- `contextualmessage/datasource/AjustoTipDataSource.kt` + `AjustoTipResponse` + `AjustoTipError`
- `achievements/datasource/AjustoBadgeSource.kt` — **modifié** : ajout de `getAllBadges()`

## Tâches

- [ ] Relire les fichiers `WRU-26599-*` correspondants et figer les signatures
- [ ] Retirer les préfixes
- [ ] Fusionner `getAllBadges()` dans `AjustoBadgeSource.kt` existant et supprimer le fichier V2

## Critères d'acceptation

- Aucun type du SDK CMT ni du Core ne traverse ces interfaces
- `AjustoTipDataSource` rend une **liste** (le repository prendra le premier élément)
- Le module compile

## À noter

`CmtTripSignalsDataSource` est **le seul port qui restera dépendant du Core** après cette
migration — 2 membres, aucune décision transportée.
