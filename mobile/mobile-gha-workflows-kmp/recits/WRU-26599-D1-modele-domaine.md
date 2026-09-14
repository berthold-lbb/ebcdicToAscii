# WRU-26599-D1 — Modèle de domaine des messages contextuels

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/domain` — commonMain |
| **Estimation** | 0,5 j |
| **Dépend de** | — (premier ticket du chantier) |
| **Bloque** | D2, D3, A5 |

## Contexte

La cascade de décision vit aujourd'hui en Java dans `AjustoContextualMessageHelper` et rend du
texte **déjà traduit**. On la remplace par un modèle de domaine qui dit seulement **quel cas
s'applique** — zéro texte, zéro icône. La traduction descend en présentation.

Une proposition complète existe déjà dans le dépôt, préfixée `WRU-26599-`. Le travail de ce ticket
est de **la relire, la valider et la finaliser**, pas de repartir de zéro.

## Fichier de référence — à lire avant d'écrire

| Ce qu'on écrit | Se calquer sur |
|---|---|
| Modèle de données du domaine | `domain/.../ajusto/domain/achievements/model/AjustoBadge.kt` |
| Enum de domaine porteur de logique | `domain/.../ajusto/domain/score/AjustoScoreProgressStatus.kt` |
| Modèle avec valeurs par défaut | `domain/.../ajusto/domain/history/model/AjustoHistoryPeriod.kt` |

## Fichiers à créer

Dans `domain/src/commonMain/kotlin/com/desjardins/assurancedommages/mobile/ajusto/domain/contextualmessage/model/` :

- `AjustoContextualMessage.kt` — sealed class, 8 variantes, avec `group` et `priority`
- `AjustoContextualSignals.kt` — les 13 signaux d'entrée, tous avec valeur par défaut
- `AjustoMessageGroup.kt` — `ADVICE` · `NOTICE` · `BADGE` (**trois** valeurs, voir ci-dessous)
- `AjustoBadgeScope.kt` — les 7 familles de médailles

## Tâches

- [ ] Relire les 4 fichiers `WRU-26599-*` correspondants et valider le modèle
- [ ] Retirer le préfixe `WRU-26599-` des noms de fichiers
- [ ] Vérifier que `priority` reproduit l'ordre exact du `if/else if` Java (1 à 8)
- [ ] Vérifier que les 6 premières variantes portent bien `NOTICE` (fusion DEVICE + ENGAGEMENT)
- [ ] Tests : instanciation des 8 variantes, `group` et `priority` attendus

## Critères d'acceptation

- Le module `domain` compile, rien n'est branché
- Aucun `String` de libellé, aucune référence à une icône ou à une couleur dans ces 4 fichiers
- Couverture 100 % sur le paquet `contextualmessage/model`

## Décision appliquée — 14 septembre

`AjustoMessageGroup` est passé de **quatre à trois** valeurs. `DEVICE` et `ENGAGEMENT` sont
fusionnées dans `NOTICE`, parce qu'elles n'avaient aucune traduction visuelle : batterie, mode
économie, appareil non compatible et invitation à étiqueter portent tous le libellé « Avis » à
l'écran. Le groupe ne sert plus qu'à choisir ce libellé.

La distinction entre règles d'appareil (1 à 4) et règles d'engagement (5 et 6) n'est pas perdue :
elle vit dans `priority` et dans les deux fonctions de résolution du use case.

**Effet de bord utile** : la décision produit A.1 — « où placer la catégorie engagement dans
l'ordre d'affichage ? » — **tombe d'elle-même**. Les messages d'engagement sont des `NOTICE` de
priorité 5 et 6 : ils se rangent mécaniquement après les alertes d'appareil et avant la médaille.
Plus rien à trancher.
