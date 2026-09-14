# WRU-26599-A3 — Compatibilité de l'appareil et stockage typé

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/data` + `shared` + `androidApp` |
| **Estimation** | 1 j (+ réseau bloqué) |
| **Dépend de** | D4 |
| **Bloque** | A5 (partiellement) |

## Contexte

Deux sujets distincts dans le même ticket parce qu'ils touchent la même clé de stockage.

**Le stockage** est débloqué : les sources de `SharedPreferencesKeyValueStorage` montrent que le
Core écrit en types **natifs**, dans la même instance chiffrée que le `Storage` KMP. Lire
`IS_DEVICE_COMPATIBLE_KEY` avec `getString()` lève une `ClassCastException` — pas un `null`.

**Le réseau** reste bloqué : la route `AuthenticationHttpService.isDeviceCompatible` est
introuvable dans le dépôt.

## Fichier de référence — à lire avant d'écrire

| Ce qu'on écrit | Se calquer sur |
|---|---|
| Datasource Ktor avec POST | `data/.../summary/datasource/KtorAjustoSummaryDataSource.kt` |
| Interface de stockage | `shared/.../kore/data/repository/Storage.kt` |
| Implémentation Android du stockage | `androidApp/.../kore/info/platform/StorageImpl.kt` |
| Accesseurs typés côté Core (le contrat à reproduire) | `com.mirego.scratch.core.storage.SharedPreferencesKeyValueStorage` (lib externe) |

## Fichiers à créer

- `shared/.../kore/data/repository/TypedStorage.kt` — ajoute `getBoolean/putBoolean/getInt/putInt`
- `androidApp/.../kore/info/platform/TypedStorageImpl.kt` — délégation aux accesseurs natifs
- `data/.../contextualmessage/datasource/DeviceCompatibilityDataSource.kt`

## Tâches

- [ ] Relire les fichiers `WRU-26599-*`, retirer les préfixes
- [ ] Brancher `TypedStorage` dans le graphe Koin à la place de `Storage`
- [ ] Vérifier que le cache reste un `Int` sous la **même clé** (sinon les installations existantes repartent de zéro)
- [ ] Tests : cache présent / absent / échec réseau

## Critères d'acceptation

- Une valeur écrite par le Core est lue par le KMP sans conversion
- **Correction D-A appliquée** : on interroge le serveur, on retombe sur le cache en cas d'échec —
  et non l'inverse comme le faisait le Java, qui publiait `false` quand le cache était absent

## Hors portée

- **iOS** : `TypedStorage` n'est implémenté que côté Android pour l'instant (décision assumée).
  L'implémentation iOS fera l'objet d'un ticket séparé.

## Bloquant

- La route serveur doit être retrouvée côté backend avant que l'appel réel puisse être écrit.
  Le reste du ticket est livrable sans elle.
