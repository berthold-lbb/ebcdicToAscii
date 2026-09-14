# WRU-26599 — Tickets Jira, couches domain et data

Neuf tickets, volontairement petits : trois à cinq tâches chacun, un seul sujet par ticket.
La couche présentation et l'UI font l'objet d'un lot séparé, non couvert ici.

## Ordre et dépendances

```
D1 ─┬─ D2 ── D3 ─────────────┐
    └─ D4 ─┬─ A1 ────────────┤
           ├─ A2 ────────────┼── A5 ── (présentation)
           ├─ A3 ────────────┤
           └─ A4 ────────────┘
```

| Ticket | Sujet | Couche | Est. |
|---|---|---|---|
| [D1](WRU-26599-D1-modele-domaine.md) | Modèle de domaine — sealed, signaux, catégories | domain | 0,5 j |
| [D2](WRU-26599-D2-regles-decision.md) | Les 4 règles de décision | domain | 1 j |
| [D3](WRU-26599-D3-usecase-resolution.md) | Use case de résolution + table de vérité | domain | 1,5 j |
| [D4](WRU-26599-D4-ports.md) | Les ports (repository + datasources) | domain | 0,5 j |
| [A1](WRU-26599-A1-bon-a-savoir.md) | « Bon à savoir » — dto / http / datasource | data | 1 j |
| [A2](WRU-26599-A2-badges-androidmain.md) | Badges via le SDK CMT | data · androidMain | 1,5 j |
| [A3](WRU-26599-A3-compatibilite-appareil.md) | Compatibilité appareil + stockage typé | data + shared | 1 j |
| [A4](WRU-26599-A4-trajets-cmt.md) | Filtre 90 jours + adaptateur CMT | data · androidMain | 2 j |
| [A5](WRU-26599-A5-repository-agregation.md) | Repository d'agrégation + injection | data | 1,5 j |
| _à écrire_ | Fermeture des messages (la croix) | domain + data | — |

D2, D4 et les quatre tickets data sont parallélisables. Chemin critique : D1 → D4 → A4 → A5.

**Un dixième récit reste à écrire** : la croix de fermeture présente sur chaque boîte « Bon à
savoir » et « Avis » dans la maquette. Aujourd'hui un seul message est refermable dans le legacy
(l'invitation à étiqueter, via `CLASSIFY_INVITE_DISMISSED`) et la fonction qui l'écrit n'a même
aucun appelant — la croix n'a jamais été branchée. Généraliser demande un identifiant stable par
message, un port de persistance, un filtre, et surtout une décision produit : refermé pour
toujours, jusqu'au retour de la condition, ou pour la période en cours ? Hors portée des neuf
récits ci-dessus ; rien n'y est coûteux à rattraper après coup.

## Ce qui vaut pour tous les tickets

**Le code existe déjà, en proposition.** Chaque fichier à écrire a son équivalent dans le dépôt,
préfixé `WRU-26599-`. Le travail n'est pas d'écrire à partir de rien mais de **relire, valider,
puis retirer le préfixe**. Si la relecture conclut qu'une proposition est mauvaise, la refaire —
mais en le disant, pas en silence.

**Deux fichiers ne se suppriment jamais** : `WRU-26599-AjustoBadgeDataSourceImpl-Backup.kt` et
`WRU-26599-DeviceCompatibilityDataSource-Backup.kt`.

**Les fichiers sources existants ne se déplacent pas.** Quand un fichier doit changer de place, on
crée l'équivalent au bon endroit ; l'original reste intact jusqu'à la fusion du lot.

**La structure de la couche data suit la convention du dépôt** : `datasource/`, `dto/`, `http/`,
`repository/`. Voir `ajusto/data/summary/` et `ajusto/data/history/`, qui la respectent tous les deux.

**Zéro texte traduit dans le domaine.** Le domaine émet quel cas s'applique ; la traduction, les
icônes et les teintes descendent en présentation.

## Préalables hors de ces tickets

| Sujet | Qui | Bloque |
|---|---|---|
| Route `AuthenticationHttpService.isDeviceCompatible` introuvable | Backend | A3 (partie réseau) |
| Forme du JSON de `/mobile/v3/get_badges` | Backend / Core | A2 |
| Valeur exacte de `CONTINUOUS_V4` (décision D-H) | Vérification code | D2 |
| Relecture SCRATCH des observables CMT | Équipe télématique | A4 |
| Source du « Bon à savoir » | Produit | A1 (le mock permet d'avancer sans) |

## Documents de référence

- **doc 19** — parcours des 13 dépendances, plan par lots, arborescence fichier par fichier
- **doc 18** — état des lieux, inventaire, raisonnements derrière les décisions
- **doc 20 / 21** — spécification fonctionnelle des messages, pour le produit et le design
