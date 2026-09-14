# WRU-26599-A4 — Signaux de trajets : filtre 90 jours et adaptateur CMT

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/data` — commonMain + androidMain |
| **Estimation** | 2 j |
| **Dépend de** | D4 |
| **Bloque** | A5 |

## Contexte

Deux signaux viennent du SDK télématique : « un trajet est en cours » et « les trajets récents ».
Le filtre des trajets récents (90 jours / après la date de police / hors Mulligan) vit aujourd'hui
dans `TripServiceImpl` côté Java — on le porte en Kotlin.

**Le choix qui compte** : se brancher sur `CMTTripProviderImpl` et `CMTTripManagerImpl`
(androidApp, déjà en Kotlin), **pas sur `TripServiceImpl`**. Sinon celui-ci reste indéboulonnable
et le filtre 90 jours reste en Java.

## Fichier de référence — à lire avant d'écrire

| Ce qu'on écrit | Se calquer sur |
|---|---|
| Source des trajets | `androidApp/.../com/mirego/cmt/wrapper/trips/CMTTripProviderImpl` |
| État d'enregistrement | `androidApp/.../com/mirego/cmt/wrapper/trips/CMTTripManagerImpl` |
| Filtre d'origine à porter | `TripServiceImpl.notifyLatestTrips()` (Core Java) |
| Structure d'un datasource androidMain | `data/src/androidMain/` — aucun exemple existant, motif nouveau |

## Fichiers à créer

- `data/src/commonMain/.../contextualmessage/datasource/RecentTripsFilter.kt` — ~12 lignes
- `data/src/androidMain/.../contextualmessage/datasource/AndroidCmtTripSignalsDataSource.kt`

## Tâches

- [ ] Porter le filtre en Kotlin et écrire son **test de parité** avec le Java
- [ ] Écrire l'abonnement réel aux deux observables (voir bloquant)
- [ ] Retirer les préfixes `WRU-26599-`

## Critères d'acceptation

- `RecentTripsFilter` est testé isolément : fenêtre de 90 jours, date de police, exclusion Mulligan
- Aucun type CMT ne sort du paquet `androidMain`
- Les deux flux émettent une valeur initiale (ne pas bloquer les autres règles au 1ᵉʳ lancement)

## Bloquant

- `AndroidCmtTripSignalsDataSource.init` est aujourd'hui un `TODO()`. L'API des observables CMT
  (`SCRATCHObservable`, pas un `Flow` Kotlin) n'a pas été relue en détail. **Faire relire par
  quelqu'un qui connaît SCRATCH** avant d'écrire l'abonnement — prévoir un helper `asFlow()` avec
  `awaitClose`.
