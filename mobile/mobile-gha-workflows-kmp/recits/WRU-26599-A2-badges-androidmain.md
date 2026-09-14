# WRU-26599-A2 — Badges : rebrancher la liste brute via le SDK CMT

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/data` — **androidMain** |
| **Estimation** | 1,5 j |
| **Dépend de** | D4 |
| **Bloque** | A5 |

## Contexte

`AjustoBadgeControllerBridger` a été supprimé : le port `AjustoBadgeSource` n'a plus
d'implémentation, **aucun badge n'arrive au KMP aujourd'hui**. La règle 7 ne peut donc pas se
déclencher.

Décision prise : on reste derrière le **SDK CMT**. La requête `/mobile/v3/get_badges` est signée
par `createPassThruRequester(appModel.context)` — un client Ktor nu ne suffit pas. L'implémentation
vit donc en `androidMain`, le port reste en `commonMain`.

## Fichier de référence — à lire avant d'écrire

| Ce qu'on écrit | Se calquer sur |
|---|---|
| Découpage dto / http / datasource | `data/.../history/` (même structure, transposée) |
| Appel signé par le SDK | `androidApp/.../core/impl/badge/http/BadgeHttpService.kt` |
| Filtre des badges supportés | `androidApp/.../core/impl/badge/BadgeProviderImpl.kt` |
| Remise à zéro à la déconnexion | `androidApp/.../core/impl/badge/BadgeRepository.kt` |

> Les fichiers `androidApp/core/impl/badge/` sont **déjà en Kotlin** : c'est un déplacement, sauf
> pour le parsing. **Ne pas les déplacer** — en créer l'équivalent au bon endroit, l'original reste.

## Fichiers à créer

Dans `data/src/androidMain/.../ajusto/data/achievements/` :

- `http/BadgeHttpService.kt` + `BadgeRequester` — transport, rend le JSON brut
- `dto/BadgeDto.kt` — remplace `BadgesResponseParser` + `BadgeMapper` par kotlinx.serialization
- `datasource/AjustoBadgeDataSourceImpl.kt` — filtre `level <= 6`

## Tâches

- [ ] Ajouter `implementation(libs.cmtelematics)` au bloc `androidMain` de `data/build.gradle.kts` (il est vide aujourd'hui)
- [ ] Trancher l'accès au helper de signature (voir bloquant ci-dessous)
- [ ] Relire les fichiers `WRU-26599-*`, retirer les préfixes
- [ ] Aligner les `@SerialName` du DTO sur la vraie réponse serveur
- [ ] Vérifier que le reset à la déconnexion est bien porté par le repository (A5)

## Critères d'acceptation

- `getAllBadges()` rend la liste **brute**, pas l'agrégat de `getBadgeSummary()`
- Le filtre `level <= 6` est conservé et testé
- Aucun type `ca.dgag.ajusto.core` dans le paquet `achievements`

## Bloquants à lever

- **Helper de signature** : `PassThruRequesterHelper` vit dans `androidApp`, qui dépend des modules
  et jamais l'inverse. Trois issues — le déplacer dans un module partagé, le dupliquer, ou injecter
  le requester via l'interface `BadgeRequester` (retenu par défaut, à valider).
- **Forme du JSON** : `BadgeMapper.kt` est vide dans le dépôt, `BadgesResponseMapper` est dans la
  lib Core. Lire l'un des deux, ou capturer une réponse réelle, avant de figer le DTO.
