# WRU-26599-A1 — « Bon à savoir » : DTO, service HTTP, datasource

| | |
|---|---|
| **Type** | Tâche technique |
| **Couche** | `modules/feature/ajusto/data` — commonMain |
| **Estimation** | 1 j |
| **Dépend de** | D4 |
| **Bloque** | A5 |

## Contexte

Le 8ᵉ signal, le seul qui n'existe pas dans l'ancien tableau de bord. Sa **source réelle n'est pas
tranchée** (3 hypothèses : champ de l'API sommaire, endpoint dédié, ou DynamicMessages). On monte
donc les quatre étages au complet et on branche un **mock** en attendant : le jour où la source
est connue, seule l'implémentation HTTP change.

## Fichier de référence — à lire avant d'écrire

> `ajusto/data/history/` est le patron à recopier étage par étage. C'est le sous-module le plus
> proche de ce qu'on construit : une liste d'objets simples, lue par une route unique.

| Ce qu'on écrit | Se calquer sur |
|---|---|
| DTO + `toDomain()` | `data/.../history/dto/HistoryPeriodDto.kt` |
| Interface du service HTTP | `data/.../history/http/HistoryPeriodHttpService.kt` |
| Implémentation Ktor | `data/.../history/http/HistoryPeriodHttpServiceImpl.kt` |
| Datasource (mapping DTO → domaine) | `data/.../history/datasource/KtorAjustoHistoryPeriodDataSource.kt` |
| Tests | `data/src/commonTest/.../history/dto/HistoryPeriodDtoTest.kt` et `.../datasource/KtorAjustoHistoryPeriodDataSourceTest.kt` |

## Fichiers à créer

Dans `data/src/commonMain/.../contextualmessage/` :

- `dto/TipDto.kt` — `@Serializable` + `toDomain()`
- `http/TipHttpService.kt` — `fun interface`
- `http/KtorTipHttpService.kt` — squelette, route inconnue
- `datasource/KtorAjustoTipDataSource.kt` — mapping DTO → domaine
- `datasource/MockAjustoTipDataSource.kt` — liste en dur, **branché par défaut**

## Tâches

- [ ] Relire les fichiers `WRU-26599-*` correspondants, retirer les préfixes
- [ ] Vérifier que le mock traverse bien `TipDto.toDomain()` et pas un raccourci
- [ ] Tests du DTO et du datasource, sur le modèle de `history`

## Critères d'acceptation

- Le mock rend une liste non vide, et le cas liste vide est testé
- Basculer du mock vers la vraie source = changer une ligne dans `AjustoDataModule`

## À noter

Le mock est au niveau du **datasource**, pas du service HTTP : `CachedHttpResponse` ne peut pas
être construit à la main sans connaître sa signature. Décision assumée, documentée dans le fichier.

## À confirmer

- Les `@SerialName` de `TipDto` sont provisoires — ils reprennent le besoin du domaine, pas un
  contrat serveur. À aligner dès que la source est tranchée.
