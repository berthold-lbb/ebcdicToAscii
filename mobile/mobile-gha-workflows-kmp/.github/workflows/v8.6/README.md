# CI/CD KMP Mobile — v8.6

Pipeline GitHub Actions réutilisable pour l'app mobile **Kotlin Multiplatform**
`ui-ad-digital-mobile` (module `shared` + `androidApp` + `iosApp`), en remplacement
du pipeline Azure DevOps. Ce document explique **l'architecture, chaque choix
technologique et sa justification**, et compare avec la solution Azure.

---

## 1. Vue d'ensemble

```mermaid
flowchart TD
    subgraph PREP["1 · Préparation (Linux)"]
        E01["01 evaluate\nidentité produit"] --> E02["02 resolve-context\nbranche → env/distribution\n+ matrices"]
        E02 --> E03["03 validate-inputs"]
        E02 --> E04["04 seal-ios-secrets\nVault → blob scellé"]
        E02 --> E05["05 mirror-internal-deps\nArtifactory → mirror Maven"]
    end

    subgraph QUALITY["2 · Qualité"]
        Q10["10 quality-shared (Linux)"]
        Q11["11 quality-android (Linux)"]
        Q12["12 quality-iOS (macOS)\nunseal + mirror"]
    end

    subgraph GATE["3 · Gates"]
        Q13["13 sonar-iOS (Linux)"] --> G20["20 quality-gates\nallow_build / allow_publish"]
    end

    subgraph BUILD["4 · Build"]
        B30["30 build-android (Linux)\nmatrix brands\nversionCode = run# + offset\nsignature vault-keystore : keystore + password Vault,\nalias config, export Gradle par marque"]
        B31["31 build-iOS (macOS)\nmatrix schemes\nunseal + mirror"]
    end

    subgraph PUB["5 · Publication"]
        P40["40 AppLivery Android (Linux)\ntest-run : tags d'identification\nsur runs de test uniquement"]
        P42["42 AppLivery iOS (Linux)\nGemfile.publish minimal\ntest-run idem Android"]
        P43["43 TestFlight (macOS)\nunseal"]
    end

    E03 --> Q10 & Q11
    E04 --> Q12
    E05 -. "si workaround actif" .-> Q12
    Q10 & Q11 & Q12 --> Q13
    Q10 & Q11 --> G20
    G20 --> B30 & B31
    E04 --> B31
    E05 -. "si workaround actif" .-> B31
    B30 --> P40
    B31 --> P42 & P43
    E04 --> P43
    P40 & P42 & P43 --> S60["60 summary"]
```

**Structure du repo** : un workflow réutilisable `ci-kmp.yml` (+ variante
`ci-kmp.local.yml` pour tests en chemins relatifs) + des actions composites
`emerald-*` partagées + un consumer par app (`mobile-ci-kmp.yml`). Les
consommateurs épinglent une version (`@v8.6`).

---

## 2. La contrainte structurante : les runners macOS sont isolés

**Fait établi (confirmé infra + diagnostics)** : les runners **Linux** atteignent
le réseau interne Desjardins (Vault, Artifactory `.lc.`) ; les runners **macOS-15
n'atteignent QUE l'Internet public** (Maven Central, Google, JetBrains — vérifié 3/3).

Ce fait a dicté les deux mécanismes originaux de cette solution :

### 2.1 Secrets — seal/unseal (jobs 04 → 12/31/43)

```mermaid
sequenceDiagram
    participant V as Vault (interne)
    participant L as Job 04 (Linux)
    participant A as Artifact GitHub
    participant M as Jobs iOS (macOS)
    L->>V: lit l'union des secrets iOS<br/>(git PAT, Arkana, Artifactory,<br/>MATCH par profil, ALTOOL par brand)
    L->>L: blob NAME=base64(valeur)<br/>puis base64 du tout
    L->>A: output de job "sealed"
    M->>A: récupère le blob
    M->>M: unseal : décode, ::add-mask::,<br/>exporte en env, résout MATCH/ALTOOL<br/>pour l'entrée de matrice
    Note over M: zéro appel Vault sur macOS
```

**Justifications** :
- *Pourquoi base64 et pas chiffrement ?* Zéro dépendance runner (pas d'openssl/gpg
  à garantir sur macOS self-hosted), pattern déjà retenu par l'équipe iOS interne
  (`mobile-gha-workflows-ios`). Le base64 empêche aussi GitHub de masquer le blob
  en transit (le masquage `***` casserait le transport).
- *Pourquoi l'union de toute la matrice ?* macOS ne peut pas interroger Vault,
  donc les secrets dépendant de la matrice (MATCH par `signingVaultProfile`,
  ALTOOL par `brandKey`) doivent tous être scellés d'avance ; l'unseal résout
  ensuite l'entrée courante.
- *Compat bash 3.2* : macOS livre bash 3.2 (pas de `declare -A`) — l'unseal
  utilise un lookup `grep` au lieu d'un tableau associatif.

### 2.2 Dépendances — mirror Maven (job 05 → 12/31)

```mermaid
flowchart LR
    subgraph LNX["Job 05 (Linux)"]
        A["Artifactory .lc."] -->|"API storage + curl\ntéléchargement PAR FICHIER\n(inclut les klibs iOS)"| MIR["dépôt Maven local\ncom.desjardins.* / com.dgag / ca.dgag\n+ org.jlleitschuh (republié interne)"]
    end
    MIR -->|artifact| MAC["Jobs iOS (macOS)"]
    subgraph MACOS["macOS — init script Gradle (PREFER_SETTINGS)"]
        MAC --> R1["internes → mirror file://"]
        MAC --> R2["publiques → Maven Central / Google\n/ Plugin Portal / jitpack"]
        MAC --> R3["konan (kotlin-native-prebuilt)\n→ Maven Central (dép. Maven)"]
    end
```

**Justifications** :
- *Pourquoi par fichier et pas par résolution Gradle sur Linux ?* Les cibles
  Apple ne se **configurent que sur macOS** : Gradle/Linux ne peut pas résoudre
  `iosMain` (klibs iOS). L'API storage télécharge par chemin → les klibs entrent
  dans le mirror.
- *Pourquoi ne pas tout mirrorer ?* macOS a l'Internet public : les artefacts
  publics (kotlin, compose-compiler-plugin, atomicfu, stately, **konan**) se
  résolvent depuis Maven Central avec **toutes** leurs variantes
  (device/simulateur/cinterop) — surface de mirror minimale = robustesse maximale.
  (L'alternative « cache-seed » qui pré-résout tout sur Linux a échoué en pratique :
  chaque run révélait une variante publique manquante.)
- *Pièges rencontrés et couverts* : artefacts « publics » **republiés en interne**
  à des versions absentes du public (ex. `ktlint-gradle:12.2.0`) → leur groupe est
  ajouté aux `paths` du mirror.
- *Réversible* : `enableMacosOfflineWorkaround: false` coupe tout le mécanisme le
  jour où l'infra ouvre l'accès (une ligne dans le consumer).

---

## 3. resolve-context : le cerveau (branches, env, distribution)

Le job `02` répond à : *« sur cet événement/branche, que doit-on builder, dans
quel environnement, et où publie-t-on ? »*

```mermaid
flowchart TD
    EV["événement + branche"] --> BT{branch_type}
    BT -->|"feature / pr"| R1["env=Qa · Debug · distribution=none\n(matrice restreinte au brand défaut)"]
    BT -->|"main / applivery-archives"| R2["env=Qa · Release · applivery"]
    BT -->|"rc/*"| R3["env=rcEnvName · Release · applivery"]
    BT -->|"release/*"| R4["env=Prod · Release · testflight"]
    BT -->|"release-gia/*"| R5["env=Beta · Release · testflight-beta"]
    R1 & R2 & R3 & R4 & R5 --> BR["branchRulesJson (v8)\nsurcharge PARTIELLE par branch_type"]
    BR --> MD["manualDistribution\n(workflow_dispatch OU label PR publish:*)"]
    MD --> OUT["outputs : env_name, build_configuration,\ndistribution, android_matrix, ios_matrix,\nflags *_publish_*"]
```

**Ordre de priorité** : défauts (parité Azure) → `branchRulesJson` →
overrides `workflow_dispatch` (env/config) → `manualDistribution` (dispatch/label).

La `distribution` pilote ensuite les **flags de publication** :
`applivery` → jobs 40/42 ; `testflight*` → job 43 (si `enableTestFlight`).
Une PR = `none` = aucun publish (sauf label `publish:*`, v8.1).

**`branch_type` pilote aussi `test-run` (v8.6)** : les jobs de publication
AppLivery (40/42) calculent `test-run: branch_type in {manual, pr, feature}` —
ce flag détermine si des tags d'identification (`test:true,run:<n>,ref:<branche>`)
sont ajoutés à la publication AppLivery, **sans jamais toucher les publications
réelles** (main/rc/applivery-archives → tags strictement identiques à Azure).

**Pourquoi centraliser ça dans une action ?** Sur Azure, cette logique était
éclatée dans des conditions `${{ if }}` de templates. La centraliser rend le
graphe des jobs **statique et lisible** : les jobs existent toujours et se
skippent proprement selon les outputs — pas de YAML génératif.

---

## 4. Les matrices : c'est quoi, et comment on s'en sert

Une **matrix** GitHub Actions duplique un job pour chaque combinaison d'entrées.
Ici, `resolve-context` **fabrique la matrice dynamiquement** (JSON) et les jobs
la consomment :

```yaml
strategy:
  matrix: ${{ fromJSON(needs.resolve-context.outputs.ios_matrix) }}
```

```mermaid
flowchart LR
    CFG["androidBrandsConfig / iosSchemesConfig\n(JSON du consumer : brands & schemes)"] --> RC["resolve-context\n+ contexte branche (env, profileType)"]
    RC --> AM["android_matrix\n{brandKey, brandName, buildVariant,\njavaVersion 17/21, signingMode,\nsigningVaultProfile, keyAlias, artifactName…}"]
    RC --> IM["ios_matrix\n{brandKey, scheme, configuration,\nlane, ipaName, matchRepo,\nsigningVaultProfile, fastlaneEnv…}"]
    AM --> B30["30 build-android\n1 job PAR brand (dgag, tpic)"]
    IM --> B31["31 build-iOS\n1 job PAR scheme (DesjardinsAssurances,\nLaPersonnelle)"]
```

Chaque entrée porte **tout le contexte pré-résolu** : variant Gradle, JDK (17 Qa /
21 Store), lane Fastlane, nom d'IPA, repo Match, **nom du secret Vault de
signature** (via `iosMatchSecretMap`, car les noms Vault sont irréguliers :
`match-password-dgag-ent`, `-fede-public`, `-lp-public`), et depuis v8.6 le
**`keyAlias`** de la marque (fourni par la config, plus par Vault — voir §6).
En PR, la matrice est **restreinte au brand/scheme par défaut** (= « smoke ») ;
sur main/rc/release, matrice complète — l'équivalent du « smoke vs full » d'Azure,
sans dupliquer de templates.

**Pourquoi ce design ?** Ajouter une marque = **une entrée JSON dans le
consumer**, zéro changement de workflow. Et les jobs matriciels tournent **en
parallèle** (2 brands = 2 builds simultanés, là où Azure séquençait certains stages).

---

## 5. Versioning des builds (remplacement du job Azure « UpdateBuildVersion »)

```mermaid
flowchart LR
    RN["github.run_number"] --> ADD["+ versionCodeOffset\n(≥ dernier code publié au store)"]
    ADD --> VC["versionCode Android\n(ORG_GRADLE_PROJECT_versionCode\n→ getVersionCode() Gradle)"]
    ADD --> BN["build number iOS\n(CFBundleVersion = short.run#)"]
```

Azure **committait** un bump de version après chaque publication (`incrementVersion`
+ push `[skip ci]`). Remplacé par un numéro **dérivé du run CI** :

| | Azure (commit-back) | v8.6 (run_number) |
|---|---|---|
| Auth push + exception branch-protection | requise | — |
| Risque de boucle `[skip ci]` / course | réel | — |
| Job + latence supplémentaires | oui (job 50) | — |
| Historique git pollué | oui | non |
| Reproductibilité | moyenne | totale (numéro = run) |

La version **marketing** (`versionName` / `CFBundleShortVersionString`) reste
pilotée manuellement — seule la partie technique est automatisée.

---

## 6. Signature Android — refonte v8.6 (mot de passe séparé, alias en config)

Jusqu'à v8.5, `emerald-android-signing` lisait un **secret Vault unique**
(`keystore-{brandKey}-{env}`) portant les quatre champs `keystoreData` /
`keystorePassword` / `keyAlias` / `keyPassword`, et écrivait le keystore décodé
**dans le repo**, au chemin exact attendu par `build.gradle.kts`.

```mermaid
sequenceDiagram
    participant V as Vault
    participant J as Job 30 (Linux)
    participant CFG as androidBrandsConfig (consumer)
    participant G as Gradle
    J->>V: lit keystore-<brand>-<env> (value = keystoreData base64)
    J->>V: lit keystore-<brand>-password (value = store/key password)
    J->>CFG: keyAlias (config des marques, pas Vault)
    J->>J: décode base64 → $RUNNER_TEMP/android-signing/<fichier>\n(chemin ABSOLU, hors repo) · chmod 600
    J->>J: exporte Keystore<Brand>File / KeystoreStorePassword<Brand> /\nKeystoreAlias<Brand> / KeystoreKeyPassword<Brand> → $GITHUB_ENV
    J->>G: build signé (variables lues par build.gradle.kts)
    J->>J: cleanup « if: always() » : $RUNNER_TEMP nettoyé même si le build échoue
```

**Ce qui change et pourquoi** :
- **Keystore et password désormais dans deux secrets Vault distincts**
  (`keystore-{brandKey}-{env}` et `keystore-{brandKey}-password`) : le password
  ne dépend plus de l'environnement (Prod/Beta partagent le même), évite la
  duplication du secret par env.
- **`keyAlias` sort de Vault** : ce n'est pas une donnée sensible, elle vient de
  `androidBrandsConfig[].keyAlias` (config des marques, versionnée avec le
  consumer) via le nouvel input `key-alias-literal` de l'action — prioritaire sur
  l'ancien `key-alias-env` (conservé pour compat descendante).
- **Chemin ABSOLU sous `$RUNNER_TEMP`** au lieu d'un chemin relatif dans le repo :
  élimine tout risque de double résolution (`androidApp/androidApp/...`) et évite
  qu'un keystore décodé traîne dans l'arborescence versionnée entre le decode et
  le cleanup `if: always()`.
- **Export automatique des variables Gradle** : l'action écrit directement
  `Keystore<Brand>File` / `KeystoreStorePassword<Brand>` / `KeystoreAlias<Brand>` /
  `KeystoreKeyPassword<Brand>` dans `$GITHUB_ENV` — le workflow n'a plus besoin de
  recomposer ces noms lui-même, `matrix.brandName` (`Dgag`/`Tpic`) suffit.

En Qa/PR, le mode `repo-keystore` (keystores de dev commités, seuls les
passwords viennent de Vault) est inchangé.

---

## 7. Publication AppLivery — `test-run` remplace `extra-tags` (v8.6)

Historiquement, les tags d'identification (`run:<n>`, `test:true`) étaient
construits par le **consumer** via `extra-tags` et concaténés systématiquement.
En v8.6, `emerald-mobile-publish-applivery` prend en entrée un booléen
**`test-run`**, calculé par `ci-kmp.yml` depuis `resolve-context.outputs.branch_type`
(`manual`/`pr`/`feature` → `true` ; `main`/`rc`/`applivery-archives` → `false`) :

| `test-run` | Contexte | Tags AppLivery |
|---|---|---|
| `false` | main / rc / applivery-archives (publication réelle) | `applivery-tags` (base) + `branch:<sha256[0:8]>` — **identique à Azure**, aucun tag ajouté |
| `true` | workflow_dispatch manuel / PR / feature (test) | + `test:true`, `run:<n>`, `ref:<branche>` — pour filtrer les builds de test dans AppLivery |

**Pourquoi ce changement** : `extra-tags` étant un champ texte libre laissé au
consumer, rien n'empêchait un run de test d'oublier de le renseigner (tags de
test absents) ou, à l'inverse, un run réel de le renseigner par erreur (tags de
test sur un canal de prod). `test-run` déplace la décision dans `resolve-context`
(déjà la source de vérité du type de branche) — impossible de se tromper de côté.

L'action gagne aussi un **résumé enrichi** (`$GITHUB_STEP_SUMMARY` : tableau
nom/version/taille/build AppLivery des binaires publiés) et un **upload API
plus résilient** (`--http1.1`, retries, `--max-time 1800`, validation explicite
du code HTTP) qui corrige les échecs intermittents (524 passerelle, `PROTOCOL_ERROR`)
observés sur les gros IPA.

Côté iOS, la publication AppLivery utilise désormais un **`Gemfile.publish`
minimal** (fastlane + plugin applivery seulement) : les gems du Gemfile iOS
complet (cocoapods, arkana, xcode-install) ont des extensions natives qui ne
compilent pas sur le runner Linux du job de publication.

---

## 8. Autres choix technologiques et leur justification

| Choix | Alternative écartée | Justification |
|---|---|---|
| **Vault (AppRole) pour tous les secrets** ; GitHub ne garde que `ROLEID`/`SECRETID` | Secrets GitHub (équiv. variable group Azure) | Source unique auditée, rotation centralisée, pas de duplication GitHub/Vault ; parité avec la stratégie org. |
| **Keystore Android en base64 dans Vault**, décodé au build puis supprimé (`if: always()`), password/alias désormais séparés (v8.6) | Secure Files Azure | Même garantie (jamais commité, éphémère) sans service propriétaire ; le password ne dépend plus de l'env, l'alias (non sensible) vit en config versionnée. |
| **Workflow réutilisable versionné par dossier `vX.Y` + tags** | Modifier en place | Rollback en une ligne (`@v8.5`), historique intact, plusieurs apps peuvent épingler des versions différentes. |
| **Actions composites `emerald-*` versionnées (header + changelog)** | Steps inline dupliqués | Réutilisation entre jobs/workflows, testabilité, traçabilité des changements. |
| **Bundler en mode frozen + `Gemfile.lock` committés** (+ `Gemfile.publish` minimal iOS, v8.6) | `bundle install` libre (Azure) | Builds reproductibles + cache des gems (vitesse) ; le Gemfile de publication iOS évite les gems natifs non précompilés pour Linux. |
| **Ruby 3.2.5 épinglé** (`ruby-version` input) | Ruby système (Azure) | `ruby/setup-ruby` exige une version explicite ; 3.2.5 = version rbenv documentée des runners. |
| **SDK Android bootstrappé en shell pur + cache** | `android-actions/setup-android` | L'allowlist d'actions de l'entreprise n'autorise que `actions/*`/`azure/*` ; le shell est auditable et cacheable. |
| **Gates centralisés (job 20)** | Conditions dispersées | Politique unique `allow_build`/`allow_publish` (+ options *skipped*), lisible et testable. |
| **Publication sans rebuild** (AppLivery API/fastlane, altool sur l'IPA d'artefact) | Rebuild à la publication | Le binaire publié est **exactement** celui testé ; publication plus rapide. |
| **`test-run` calculé par resolve-context** (v8.6) | `extra-tags` texte libre côté consumer | Impossible d'oublier ou d'inverser les tags de test/prod : la source de vérité du type de branche décide. |
| **Google Play retiré (v8.2)** | Job de publication direct | Décision produit : l'AAB Prod reste en artefact (= comportement Azure effectif). |

---

## 9. Points forts vs Azure DevOps (bilan)

1. **Parallélisme réel** : qualités shared/android/ios en parallèle, builds
   matriciels en parallèle, jobs seal/mirror hors chemin critique — vs stages
   largement séquentiels côté Azure.
2. **Secrets** : un seul coffre (Vault), deux secrets GitHub au total ; Azure
   mélangeait variable group + secure files + PAT implicites (`System.AccessToken`).
3. **Versionnable et multi-apps** : `uses: ...@vX.Y` — un consumer de ~15 lignes
   minimales par app ; les templates Azure étaient copiés/adaptés par repo.
4. **Plus de commit de version** : suppression du job UpdateBuildVersion et de
   ses risques (boucles, push sur branches protégées).
5. **Résilience à l'infra** : la contrainte « macOS isolé » est absorbée par
   seal/unseal + mirror, et **débranchable** par flag quand l'infra évoluera.
6. **Portabilité (v8)** : règles de branches en JSON, workaround derrière un flag
   → réutilisable par une autre app/org sans fork.
7. **Testabilité** : variante `.local` (chemins relatifs) pour valider le
   workflow avant de tagger ; publication testable depuis une PR (v8.1) via label
   ou dispatch + `dryRun` ; tags de test isolés des tags réels (`test-run`, v8.6).
8. **Traçabilité** : chaque fichier (workflow, action) porte version + changelog ;
   chaque version de la recette est un dossier figé.

## 10. Limites connues / dettes assumées

- Le **mirror** doit suivre les groupes internes (et les artefacts « publics »
  republiés en interne) : si un build iOS échoue sur une dépendance interne
  inconnue, ajouter son groupe à l'input `paths` de
  `emerald-mobile-mirror-internal-deps`.
- Le **gate global unique** fait attendre le build Android sur la qualité iOS
  (compromis simplicité vs latence, hérité de la parité Azure).
- Le vrai correctif de l'isolement macOS reste **infra** (ticket :
  `docs/INFRA-TICKET-macos-runners-network.md`) ; le mirror est un contournement
  maîtrisé, pas une finalité.
- `extra-tags` reste supporté par l'action `emerald-mobile-publish-applivery`
  pour compat descendante mais n'est plus alimenté par `ci-kmp.yml` — candidat
  à suppression une fois qu'aucun consumer externe n'en dépend.
