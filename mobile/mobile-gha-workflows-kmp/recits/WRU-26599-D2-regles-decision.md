# WRU-26599-D2 — Les quatre règles de décision

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/domain` — commonMain |
| **Estimation** | 1 j |
| **Dépend de** | D1 |
| **Bloque** | D3 |

## Contexte

Port des trois algorithmes Java du Core (`ClassifyInviteChecker` 54 l., `BadgeScoper` 81 l.,
`TopClaimableBadgeFinder` 33 l.) plus le calcul des jours restants. Ce sont des **objets purs** :
ils prennent des signaux, ils rendent un booléen ou une sélection. Aucun accès réseau, aucun état.

Proposition déjà écrite, préfixée `WRU-26599-` — à relire et finaliser.

## Fichier de référence — à lire avant d'écrire

| Ce qu'on écrit | Se calquer sur |
|---|---|
| Objet de logique pure sans état | `domain/.../ajusto/domain/score/AjustoScoreProgressStatus.kt` |

> Il n'existe **aucun autre objet de règle** dans ce module aujourd'hui : c'est un motif nouveau.
> Convention retenue : `object` Kotlin, une fonction publique, constantes en `private const`.

## Fichiers à créer

Dans `domain/src/commonMain/.../contextualmessage/rule/` :

- `ClassifyInviteRule.kt` — les 5 conditions de l'invitation à étiqueter
- `RemainingDaysUntilPolicyRule.kt` — jours restants > 0
- `BadgeScopeResolver.kt` — port de `BadgeScoper`, **sans mutation** (l'original mutait sa liste)
- `TopClaimableBadgeSelector.kt` — la médaille réclamable la plus avancée

## Tâches

- [ ] Relire les 4 fichiers `WRU-26599-*` et confirmer la fidélité au Java
- [ ] Retirer le préfixe des noms de fichiers
- [ ] Tests unitaires des 3 algorithmes, cas limites compris (liste vide, aucune médaille réclamable)

## Critères d'acceptation

- Chaque règle est testée isolément, sans dépendance sur le use case
- `BadgeScopeResolver` ne modifie pas la liste reçue en entrée
- Couverture 100 % sur le paquet `contextualmessage/rule`

## Bloquant à lever avant de coder

- **D-H** : `ClassifyInviteRule` compare `mode` avec `"continuous4"`, comparaison **exacte et
  sensible à la casse**. La valeur réelle de `AjustoParameters.Mode.CONTINUOUS_V4` doit être
  reconfirmée sur le dépôt Core avant de figer la constante.
