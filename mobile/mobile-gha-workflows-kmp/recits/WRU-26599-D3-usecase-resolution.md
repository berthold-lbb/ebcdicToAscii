# WRU-26599-D3 — Use case de résolution et table de vérité

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/domain` — commonMain |
| **Estimation** | 1,5 j |
| **Dépend de** | D1, D2 |
| **Bloque** | A5 |

## Contexte

C'est le cœur du chantier : le seul endroit qui décide **quels messages s'appliquent**. Il évalue
les 8 règles et rend de 0 à 4 messages, **au plus un par catégorie** — les messages s'empilent.

Attention à ne pas reproduire l'erreur corrigée le 10/09 : une version antérieure portait la
cascade Java à l'identique (un seul `when` sur les règles 1 à 7), ce qui rendait l'empilement
impossible. Chaque catégorie doit être évaluée **indépendamment**.

## Fichier de référence — à lire avant d'écrire

| Ce qu'on écrit | Se calquer sur |
|---|---|
| Use case de domaine | **aucun n'existe dans le dépôt** — motif nouveau |
| Convention d'objet pur | `domain/.../ajusto/domain/score/AjustoScoreProgressStatus.kt` |
| Structure de test de domaine | `domain/src/commonTest/.../history/model/AjustoHistoryPeriodTest.kt` |

## Fichiers à créer

- `domain/src/commonMain/.../contextualmessage/usecase/ResolveContextualMessagesUseCase.kt`
- `domain/src/commonTest/.../contextualmessage/usecase/ResolveContextualMessagesUseCaseTest.kt`
- `domain/src/commonTest/.../contextualmessage/ContextualMessageTruthTable.kt` — jeu de données versionné

## Tâches

- [ ] Relire `WRU-26599-ResolveContextualMessagesUseCase.kt` et valider la résolution par famille
- [ ] Vérifier qu'il n'y a **plus de `groupBy`** dans `resolve()` — voir l'encadré ci-dessous
- [ ] Retirer le préfixe du nom de fichier
- [ ] Écrire les 24 cas de la table de vérité comme fichier de données versionné
- [ ] Ajouter les cas d'empilement : conseil + batterie + médaille → **3 messages**

## Critères d'acceptation

- De 0 à 4 messages rendus : au plus un par famille de règles (appareil, engagement, médaille) plus le conseil
- La liste vide est un cas testé, pas une erreur
- **Invariant de parité vérifié** :
  `resolve(signals, tip).filterNot { it is GoodToKnow }.firstOrNull() == cascadeJava(signals)`
  sur les 24 cas
- Couverture 100 % sur `contextualmessage/usecase`

## Attention — deux pièges

**`groupDisplayOrder` n'est pas cosmétique.** Il porte l'invariant de parité, parce que l'ordre des
familles reproduit celui des règles Java. Le modifier fait échouer les tests — c'est voulu.

**Ne pas réintroduire le `groupBy`.** La version d'origine faisait
`groupBy { group }` puis `minByOrNull { priority }` pour garantir « un message par catégorie ».
Depuis que `DEVICE` et `ENGAGEMENT` sont fusionnées dans `NOTICE` (voir D1), ce `groupBy`
**supprimerait silencieusement** une alerte d'appareil ou une invitation à étiqueter quand les deux
s'appliquent — elles partagent désormais le même groupe.

Il n'est de toute façon plus utile : `resolveDeviceState()` et `resolveEngagement()` rendent
chacune au plus un message, donc la déduplication est déjà faite, et explicitement. `resolve()` ne
fait plus qu'un tri à deux clés :
`sortedWith(compareBy({ groupDisplayOrder.indexOf(it.group) }, { it.priority }))`.
