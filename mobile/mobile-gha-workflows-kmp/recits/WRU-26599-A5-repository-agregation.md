# WRU-26599-A5 — Repository d'agrégation et injection

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/data` — commonMain |
| **Estimation** | 1,5 j |
| **Dépend de** | D3, D4, A1, A2, A3, A4 |
| **Bloque** | la couche présentation |

## Contexte

Le point de rassemblement : il combine les sources, construit `AjustoContextualSignals`, appelle
le use case et expose un `Flow<List<AjustoContextualMessage>>`. **Il ne décide rien lui-même.**

C'est aussi lui qui remplace le `combineLatest` de 6 flux de `notifyContextualMessage()`.

## Fichier de référence — à lire avant d'écrire

| Ce qu'on écrit | Se calquer sur |
|---|---|
| Implémentation de repository | `data/.../summary/repository/AjustoSummaryRepositoryImpl.kt` |
| Enregistrement Koin | `data/.../ajusto/data/AjustoDataModule.kt` |
| Test de repository | `data/src/commonTest/.../summary/repository/AjustoSummaryRepositoryImplTests.kt` |

## Fichiers à créer

- `data/src/commonMain/.../contextualmessage/repository/AjustoContextualMessageRepositoryImpl.kt`
- Ajouts dans `AjustoDataModule.kt`

## Tâches

- [ ] Relire `WRU-26599-AjustoContextualMessageRepositoryImpl.kt`, retirer le préfixe
- [ ] Utiliser le `combine` **groupé** (combine imbriqués typés), pas la variante `vararg`
- [ ] `flatMapLatest` sur l'état d'authentification, remise à zéro **uniquement** sur `NOT_AUTH`
- [ ] Enregistrer les implémentations dans `AjustoDataModule`
- [ ] Tests : chaque signal fait bien réémettre le flux

## Critères d'acceptation

- `distinctUntilChanged` porte sur la **liste entière**, pas sur un message
- Tous les signaux réellement disponibles sont renseignés — pas seulement ceux des 4 messages actifs
- Le domaine reçoit des signaux, jamais des types CMT ou Core

## Point à régler avant la mise en production

Le bloc de transformation de `combine` est une lambda `suspend` : les appels ponctuels
(`getAllBadges()`, `retrieve()` du conseil) s'exécutent **à chaque battement du flux** — donc à
chaque changement de batterie. Sans effet avec un mock en mémoire ; inacceptable avec la vraie
source badges, qui est un appel réseau signé.

Trois pistes, à trancher dans ce ticket : exposer ces sources en `Flow`, les mettre en cache avec
un déclencheur explicite (retour en avant-plan, comme le faisait `BadgeRepository`), ou passer par
un `flatMapLatest` sur un flux de rafraîchissement dédié.

## À brancher plus tard

`mode` et `numberOfTrips` : le port existe déjà
(`AccountPublicRepository.getAccountFlow()`, qui est un `Flow`). À confirmer sur le vrai dépôt,
puis à ajouter au `combine`.
