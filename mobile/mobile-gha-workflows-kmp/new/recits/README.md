# WRU-26599 — Récits par message contextuel

Ce dossier découpe le chantier **par message affiché**, et non par couche technique.
Chaque récit livre une **tranche verticale complète** : la source de données, le signal, la règle,
son activation dans le use case et son rendu à l'écran.

Un récit se lit sans avoir lu les autres, et se démontre à l'écran quand il est terminé.

## Pourquoi ce découpage

Un découpage par couche — tout le domaine, puis toute la couche data — oblige à comprendre
l'ensemble du chantier avant de commencer, et ne produit rien de visible avant la toute fin.
Découpé par message, chaque récit répond à une question simple : *« ce message s'affiche-t-il
correctement ? »*. S'il manque une information, on s'en aperçoit immédiatement parce que le
message ne sort pas.

## Organisation du dossier

Un sous-dossier par récit. Chacun contient son récit au format Jira wiki (`.jira.txt`), ses
schémas en PNG à joindre à la carte, et leur source Mermaid pour les régénérer.

```
recits/
├── README.md          ← ce fichier
├── R0/                ← le socle
├── R1/ … R6/          ← les messages
└── R7/                ← parité et clôture
```

## Les récits

| Récit | Message livré | Source à brancher | Est. |
|---|---|---|---|
| [R0](R0/R0-socle.jira.txt) | *aucun* — le socle, le use case et la mécanique de preview | — | 2 j |
| [R1](R1/R1-etat-du-telephone.jira.txt) | **Trois messages** : marque non compatible, batterie faible, économie d'énergie | état du téléphone + enregistrement en cours | 2,5 j |
| [R2](R2/R2-appareil-non-compatible.jira.txt) | Appareil non compatible | requête HTTP + stockage typé | 1,5 j |
| [R3](R3/R3-invitation-etiqueter.jira.txt) | Invitation à étiqueter un trajet | trajets SDK + compte + stockage | 2,5 j |
| [R4](R4/R4-entree-en-vigueur.jira.txt) | Jours avant l'entrée en vigueur | profil SDK | 1,5 j |
| [R5](R5/R5-medaille.jira.txt) | Nouvelle médaille à réclamer | requête badges signée par le SDK | 3 j |
| [R6](R6/R6-bon-a-savoir.jira.txt) | Bon à savoir | source non tranchée | 2 j |
| [R7](R7/R7-parite-et-cloture.jira.txt) | *aucun* — parité, suppression des ponts, nettoyage | — | 2 j |

**R0 d'abord, R7 en dernier.** Entre les deux, R1 à R6 sont indépendants et peuvent être pris dans
n'importe quel ordre, à une exception près : R1 crée l'adaptateur de trajets dont R3 a besoin.

**Pourquoi R1 porte trois messages.** Marque, batterie et économie d'énergie sortent du même
adaptateur : un seul objet lit les quatre signaux que l'OS expose. Les séparer ferait écrire trois
fois le même port, le même adaptateur et le même branchement, pour trois règles qui tiennent
chacune en une ligne. Les six autres messages ont chacun leur propre source, et gardent donc leur
propre récit.

## La règle des fichiers partagés

Deux éléments servent à plusieurs récits. Le premier récit qui en a besoin le crée, le suivant
l'étend. Sans cette règle, ils seraient construits deux fois.

| Élément partagé | Créé par | Étendu par |
|---|---|---|
| Adaptateur des trajets du SDK | R1 — l'état d'enregistrement seul | R3 — la liste des trajets récents |
| Stockage typé (booléens et entiers) | R2 | R3 |

Chaque récit concerné le dit explicitement dans sa section « Arborescence ».

## Deux façons de reprendre l'existant

Les récits distinguent systématiquement deux situations, parce qu'elles ne demandent pas le même
travail.

**À porter** — la logique vit en Java dans `ad-digital-mobile-core-lib`. On la réécrit en Kotlin
pur dans le domaine, en gardant le fichier Java comme référence de comportement. Le Java disparaît
au récit R7.

**À déplacer** — le code existe déjà en Kotlin dans `androidApp`, souvent sous `ca.dgag.ajusto`.
On en crée l'équivalent au bon endroit dans le module feature. *L'original n'est pas supprimé ni
déplacé* tant que le récit n'est pas fusionné.

**À ne pas toucher** — les enveloppes du SDK télématique sous `com/mirego/cmt/wrapper/` : on les
lit, on s'y branche, on ne les modifie pas.

| Élément | Où il est aujourd'hui | Ce qu'on en fait | Récit |
|---|---|---|---|
| `trip/AjustoContextualMessageHelper.java` | Core | à porter — la cascade et les conditions des règles | R0, puis chaque récit |
| `core/DeviceInfo.java` | Core | à porter — batterie, économie d'énergie, marque | R1 |
| `core/impl/legacy/DeviceInfoImpl.kt` | androidApp | à déplacer — la lecture réelle de l'OS | R1 |
| `com/mirego/cmt/wrapper/trips/CMTTripManagerImpl.kt` | androidApp | à déplacer — enregistrement en cours | R1 |
| `ajusto/AjustoDeviceCompatible.java` et son implémentation | Core | à porter — compatibilité et cache | R2 |
| `kore/info/platform/StorageImpl.kt` | androidApp | à déplacer et étendre — accesseurs typés | R2 |
| `classifyinvite/ClassifyInviteChecker.java` | Core | à porter — les 5 conditions | R3 |
| `classifyinvite/ClassifyInviteQualifier.java` | Core | à porter — le drapeau persistant | R3 |
| `trip/TripServiceImpl.java` | Core | à porter — le filtre 90 jours uniquement | R3 |
| `com/mirego/cmt/wrapper/trips/CMTTripProviderImpl.java` | androidApp | à lire, ne pas toucher | R3 |
| `telematics/CMTProfile.java` | Core | à porter — le calcul des jours restants | R4 |
| `core/impl/profile/CMTProfileMapper.kt` | androidApp | à déplacer — lecture du profil SDK | R4 |
| `badge/BadgeScoper.java` | Core | à porter — classement par famille | R5 |
| `badge/TopClaimableBadgeFinder.java` | Core | à porter — sélection de la médaille | R5 |
| `badge/Badge.java` | Core | à porter — familles, bornes, comparaison de niveaux | R0 et R5 |
| `core/impl/badge/http/BadgeHttpService.kt` | androidApp | à déplacer — requête signée par le SDK | R5 |
| `core/impl/badge/BadgeRepository.kt` | androidApp | à déplacer — cache et remise à zéro | R5 |
| `core/impl/badge/BadgeProviderImpl.kt` | androidApp | à déplacer — filtre de niveau | R5 |

## Ce qui vaut pour tous les récits

**Zéro texte traduit dans le domaine.** Le domaine dit *quel cas s'applique*. Le libellé, l'icône
et la teinte descendent en présentation.

**Les fichiers sources existants ne se déplacent pas.** Quand un fichier doit changer de place, on
crée l'équivalent au bon endroit ; l'original reste intact jusqu'à la fusion.

**La structure de la couche data suit la convention du dépôt** : `datasource/`, `dto/`, `http/`,
`repository/`. Voir `ajusto/data/summary/` et `ajusto/data/history/`.

**Une preview par type de message, garantie.** Le socle installe le catalogue de previews, dont le
`when` exhaustif casse la compilation si un type de message n'a pas d'exemplaire, et dont le test
d'intégration continue échoue si la liste n'est pas remplie. Conséquence pratique : dès qu'un
récit branche son message, sa preview existe et s'affiche — c'est le critère de fin le plus rapide
à vérifier.

**Le domaine résout toujours les huit règles.** Rien n'est coupé en amont : seule l'activation
décide de ce qui sort à l'écran. Chaque récit bascule une ligne quand son message est prêt.

## Le modèle de groupes, en une phrase

Trois groupes seulement — `ADVICE` (« Bon à savoir »), `NOTICE` (« Avis ») et `BADGE`. Les quatre
situations d'appareil et les deux situations d'engagement portent **toutes** le libellé « Avis » :
elles partagent donc le groupe `NOTICE`, et se départagent entre elles par `priority`. Les
« familles » que mentionnent les récits — appareil, engagement, médaille, conseil — sont un
découpage **interne au use case**, pas des groupes d'affichage. Voir le document 22.

## Documents de référence

- **`22-WRU-26599-modele-et-arborescence-a-jour.html`** — le modèle de groupes et l'arborescence
  cible complète, fichier par fichier, avec le récit responsable de chacun. **C'est la référence à
  jour.**
- `19-Parcours-des-dependances-et-plan-daction-v3.html` — parcours des 13 dépendances et verdict
  sur les bridgers. Sur le modèle et l'arborescence, c'est le document 22 qui fait foi.
- `18-WRU-26599-etat-des-lieux-et-decisions.html` — état des lieux et raisonnements derrière les
  décisions
- `20-*.html` et `21-*.html` — spécification fonctionnelle des messages, pour le produit et le
  design. Le document 21 donne le cas maximal : quatre boîtes, appareil et engagement partageant le
  libellé « Avis ».
