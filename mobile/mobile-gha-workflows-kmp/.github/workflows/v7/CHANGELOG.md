# Changelog ci-kmp

Discipline de versionnage : chaque lot de changements = un nouveau dossier
`vX.Y` (workflow + docs), les versions précédentes restent intactes.
Les consommateurs épinglent `@vX.Y`.

## v7 (2026-06-29)

v7 = **v6 + contournement de l'isolement réseau des runners macOS**. L'infra a
confirmé que les runners macOS-15 n'ont **aucun accès au réseau interne Desjardins**
(ni Vault, ni Artifactory `.lc.`). v6 gérait déjà les secrets (seal/unseal) ; v7
ajoute le contournement pour **Artifactory** (résolution Gradle du framework KMP
`shared` compilé sur macOS) et un diagnostic réseau.

Nouveautés v7 (détail par action dans `.github/actions/README.md`) :

1. **DIAG réseau** — action `emerald-mobile-diag-network` (1.1.0), placée en tête du
   job `build-ios`. Non-bloquante : imprime infos VM, DNS, route, et teste DNS+TCP+HTTPS
   vers Artifactory/Vault. Teste aussi la **route** (`curl --resolve`) avec l'IP
   résolue côté Linux (nouvel output `artifactory_ip` du job seal) → dit si un simple
   `/etc/hosts` suffirait ou s'il faut l'infra.
2. **Mirror Artifactory** — nouveau job Linux `05 - mirror-internal-deps` +
   action `emerald-mobile-mirror-internal-deps` (1.0.0) : télécharge sur Linux les
   groupes Maven internes (par fichier, klibs iOS inclus) → artifact `internal-mirror`.
3. **Setup mirror macOS** — action `emerald-mobile-setup-mirror` (1.0.0) : init script
   Gradle qui résout internes = mirror local, publiques = Internet (joignable depuis
   macOS), `.lc.` jamais contacté. Branché dans les jobs `12` et `31`.

⚠️ Contournement tant que l'infra n'ouvre pas l'accès (voir
`docs/INFRA-TICKET-macos-runners-network.md` et
`docs/IOS-KMP-BUILD-INTERNAL-DEPS-WORKAROUND.md`).

## v6 (2026-06-18)

Issu du run réel : job `12 - Quality iOS` en échec sur
`Import Git PAT from Vault` → `getaddrinfo ENOTFOUND vault.cfzcea.dev.desjardins.com`.
**Cause racine** : les runners **macOS ne peuvent pas joindre Vault** (pas de
résolution DNS du host interne), contrairement aux runners Linux. Confirmé par
le repo de référence `mobile-gha-workflows-ios` dont les actions indiquent
explicitement « secrets for use on iOS build that can't access secrets directly ».

### 1. Seal / Unseal des secrets iOS (base64) — fix du blocage

- **Nouveau job Linux `04 - Seal iOS secrets`** : lit dans Vault l'**union** des
  secrets dont les jobs iOS ont besoin sur **toute la `ios_matrix`** (git PAT,
  Arkana iOS, Artifactory, CMT/Maven, `MATCH_PASSWORD` par `signingVaultProfile`,
  `ALTOOL_*` par `brandKey` si publish TestFlight), les sérialise en blob
  `NAME=base64(value)` puis **scelle le tout en base64** dans un output de job.
  Tourne **en parallèle de `validate-inputs`** (≈0 ajout sur le chemin critique).
- **Nouvelle action composite `emerald-mobile-unseal-ios-secrets`** : descelle le
  blob côté macOS, exporte chaque secret en variable d'env **masquée**
  (`::add-mask::`), résout `MATCH_PASSWORD` / `ALTOOL_*` pour l'entrée de matrice
  courante. **Décodage base64 portable** (`-d` GNU / `-D` BSD-macOS). Aucun Vault.
- **Jobs `12`, `31`, `43` réécrits** : suppression de **tous** les
  `hashicorp/vault-action` (2–3 par job, ×matrice) → 1 seul step `unseal`. Effet
  de bord : **plus rapide** sur les runners macOS (les plus lents) + fin des
  warnings Node20-deprecated de vault-action sur macOS.
- **Pré-requis** : Arkana iOS en mode **flat lines** (`iosArkanaSecretsLines`).
  Le mode dotenv iOS n'est pas géré dans le chemin scellé.
- **Sécurité** : base64 = repo privé + masquage. Le blob n'est jamais `echo`-é ;
  les valeurs sont re-masquées côté consommateur (le masquage ne traverse pas la
  frontière de job).

### 2. Suppression du job `50 - Update build version` → `run_number`

- Job `50` (commit du bump de version, sur macOS) **supprimé**. Le `versionCode`
  Android vient désormais de **`github.run_number + versionCodeOffset`**, injecté
  via la variable `ORG_GRADLE_PROJECT_versionCode` sur le job `30` (Gradle la
  mappe en `project.property("versionCode")`).
- **Modif côté app requise (faite)** : `androidApp/build.gradle.kts`
  `getVersionCode()` lit d'abord le `versionCode` injecté, fallback
  `version.properties` (dev local).
- **Nouvel input `versionCodeOffset`** (string, défaut `"0"`) : mettre ≥ au dernier
  `VERSION_CODE` déjà publié au store, sinon l'upload est rejeté.
- Input `enableUpdateBuildVersion` **déprécié** (sans effet, conservé pour compat).
- ⚠️ **ACTION REQUISE — iOS `CFBundleVersion`** : le job 50 incrémentait aussi le
  build number iOS. La fastlane iOS doit désormais fixer `CFBundleVersion` depuis
  `ENV['GITHUB_RUN_NUMBER']` (+ offset). Sans ça, le build number iOS n'incrémente
  plus → TestFlight/App Store rejettera les uploads en doublon.

### 3. Correctifs révélés par les premiers runs v6

- **Ruby (`ruby/setup-ruby` exigeait une version)** : le repo n'a ni
  `.ruby-version` ni `.tool-versions` (Azure utilisait le Ruby système de l'agent
  via `gem install bundler` + `bundle install`). Ajout d'un input `ruby-version`
  sur `emerald-setup-android-env` et `emerald-setup-ios-env` (défaut `3.2.5`,
  = version rbenv des runners), passé à `ruby/setup-ruby`.
- **Match (noms Vault irréguliers)** : le job seal (sur Linux) a révélé que le
  template `match-password-{profileType}-{brandKey}` ne correspond pas aux secrets
  réels (`match-password-dgag-ent`, `-fede-public`, `-lp-public`). Avant v6 c'était
  masqué (macOS ne joignait pas Vault → ENOTFOUND). Ajout d'un input
  `iosMatchSecretMap` (mapping explicite `{brandKey}-{profileType}` → secret,
  prioritaire sur le template) dans `emerald-kmp-resolve-context` + `ci-kmp` +
  consumer. Parité Azure : enterprise/applivery → dgag ET tpic utilisent
  `match-password-dgag-ent` (cert enterprise partagé).
- **Arkana iOS** : `CmtApiKeyCertif1FDA` corrigé en `CmtApiKeyCertifDA`
  (`cmt-api-key-certif-da`) suite à la correction de `.arkana.yml`.

### 4. Runners macOS isolés du réseau interne — DIAG + MIRROR (contournement Artifactory)

Confirmé par l'infra : les runners **macOS-15 n'ont aucun accès au réseau interne
Desjardins** (ni Vault, ni Artifactory `.lc.`). Vault est déjà contourné (seal/unseal).
Pour Artifactory (résolution Gradle du framework KMP `shared` sur macOS) :

- **Nouvelle action `emerald-mobile-diag-network` (1.1.0)** : diagnostic réseau
  non-bloquant (DNS + TCP + HTTPS + infos VM + test de ROUTE via `curl --resolve`
  avec l'IP résolue côté Linux). Placée en tête de `build-ios`. Le job `seal`
  expose désormais `artifactory_ip` pour ce test.
- **Nouveau job Linux `05 - mirror-internal-deps`** + action
  `emerald-mobile-mirror-internal-deps` (1.0.0) : télécharge (sur Linux, qui
  atteint `.lc.`) les **groupes Maven internes** (`com.desjardins.mobile`,
  `com.dgag`, `ca.dgag`) **par fichier** via l'API storage Artifactory — y compris
  les **klibs iOS** que Gradle/Linux ne sait pas résoudre — vers un dépôt Maven
  local, publié en artifact `internal-mirror`.
- **Action `emerald-mobile-setup-mirror` (1.0.0)** : sur macOS, installe un init
  script Gradle qui force `dependencyResolutionManagement` en `PREFER_SETTINGS` et
  remplace les dépôts `.lc.` par le **mirror local** (internes) + **dépôts publics**
  (Maven Central / Google / Plugin Portal / jitpack, joignables depuis macOS).
- Jobs `12` et `31` : `needs: mirror-internal-deps` + download artifact + setup-mirror.

⚠️ **Contournement** tant que l'infra n'ouvre pas l'accès macOS → Artifactory (voir
`docs/INFRA-TICKET-macos-runners-network.md`). Le vrai correctif reste l'accès réseau.
Points à valider en CI réel : complétude du mirror (versions + transitifs internes),
override des dépôts via init script (dont `pluginManagement` / plugin `foojay` résolu
tôt), et résolution des deps publiques depuis Internet sur macOS.

### Action infra (créé) à valider
- Secret Vault `concourse/<product>/git-user-access-token` (déjà requis en v5.8).
- (Optionnel) si l'infra ouvre la route Vault → runner macOS, tout le mécanisme
  seal/unseal devient inutile (chaque job relit Vault). À évaluer en parallèle.

## v5.8 (2026-06-15)

Issu du run réel : `SDK location not found ... ANDROID_HOME` puis
`The action android-actions/setup-android@v3 is not allowed` (politique
d'actions de l'entreprise). Le runner self-hosted n'a aucun SDK Android.

1. **`emerald-setup-android-env` garantit le SDK en SHELL pur** (aucune action
   tierce — l'allowlist entreprise n'autorise que `actions/*`, `azure/*` et une
   liste blanche). Détection : `android-sdk-root` → `ANDROID_HOME` →
   `ANDROID_SDK_ROOT` → emplacements standards → `~/android-sdk` → `sdkmanager`
   sur le PATH. Exporte `ANDROID_HOME`/`ANDROID_SDK_ROOT` et écrit `sdk.dir`.
2. **Bootstrap shell** si SDK absent (`install-android-sdk: true`, défaut) :
   télécharge les cmdline-tools (`android-cmdline-tools-version`, miroir interne
   possible via `android-cmdline-tools-url`), accepte les licences **sans
   interaction** (`yes | sdkmanager --licenses`), installe `platform-tools`.
3. **Cache du bootstrap** : `~/android-sdk` restauré AVANT la détection → les
   ~150 Mo ne sont re-téléchargés qu'une fois. `compileSdkVersion`/
   `buildToolsVersion` (consumer) pré-installent plateforme + build-tools dans
   ce cache.
4. Échec gracieux si air-gapped : message indiquant miroir / `android-sdk-root`
   / pré-install.

## v5.7 (2026-06-12)

Issu du run réel : `Could not find GoogleMapsApiKeyQA in .env file or
environment variables` (getEnvValue, configuration d'androidApp) dans
quality-shared.

1. **`mavenFeedSecret` → `mavenFeedUsernameSecret` + `mavenFeedPasswordSecret`**
   — la Vault réelle stocke les credentials CMT en deux secrets plats
   (`cmt-sdk-username` / `cmt-sdk-password`, champ `value`), pas un secret à
   deux champs. Defaults alignés sur ces noms → fonctionne sans config.
   Chaque valeur reste exportée sous les deux casses
   (CMT_SDK_USERNAME/cmtSdkUserName, CMT_SDK_PASSWORD/cmtSdkPassword).
2. **Diagnostic de l'erreur du run (pas un bug du workflow)** — le
   chargement des ArkanaKeys dans quality-shared est opt-in
   (`sharedQualityArkana`, défaut false) et le consumer du projet ne
   l'activait pas. Or getEnvValue() lève une exception à la configuration
   Gradle d'androidApp, déclenchée même par `:shared:*`. Fix côté
   consommateur : `sharedQualityArkana: true` (présent dans
   consumer-example depuis v5.3). Rappel du flux dans build-android :
   vault-action (30 secrets plats) → export env + écriture androidApp/.env
   → getEnvValue lit .env puis System.getenv — équivalent du bloc env: de
   30 lignes qu'Azure injectait dans chaque step.

## v5.6 (2026-06-12)

1. **Retrait de `vaultUrlProd`/`vaultPathProd`** (introduits en v5.4) —
   inutiles dans le contexte réel : une seule Vault par produit, les
   environnements sont séparés par les chemins de secrets, pas par
   l'instance. Les 17 steps vault-action reviennent à
   `inputs.vaultUrl`/`inputs.vaultPath` directement ; les outputs
   `vault_url`/`vault_path` de resolve-context disparaissent.
   Si une Vault Prod distincte devenait nécessaire un jour, reprendre le
   mécanisme de v5.4 (sélection par env résolu dans les outputs du job
   resolve-context).
2. Note : le regroupement visuel des jobs 10/11 dans le graphe GitHub
   n'est pas un bug — les jobs ayant des `needs` identiques sont empilés
   dans une même boîte ; ils restent parallèles et indépendants.

## v5.5 (2026-06-12)

Issu du premier run réel (PR #6) : échec sur
`concourse/ad-digital-mobile/azure-feed ... not found`.

1. **`azureFeedSecret` renommé `mavenFeedSecret`** — clarification après
   analyse du root build.gradle.kts : les credentials `cmtSdkUserName`/
   `cmtSdkPassword` servent au repo Maven **CMT Telematics**
   (`artifactory.cmtelematics.com`), pas à Azure Artifacts. Ils restent
   nécessaires tant que le SDK CMT vient de ce repo externe. À créer dans
   Vault : `cmt-sdk` (champs `username`/`password`).
2. **Bug corrigé : double casse des credentials CMT** — le root build lit
   `System.getenv("cmtSdkUserName")` (camelCase) alors que le Fastfile lit
   `CMT_SDK_USERNAME`. Le build iOS invoque Gradle SANS `-P` (via le script
   embedAndSign de Xcode) → seuls les exports camelCase l'alimentent.
   Le secret est maintenant exporté sous les deux casses dans tous les jobs.
3. **Champ `accessToken` supprimé du mapping** — le fallback `azurePassword`/
   `SYSTEM_ACCESSTOKEN` du root build est du code mort (aucun repo Azure
   DevOps restant) ; le champ obligatoire faisait échouer vault-action si
   absent du secret.
4. **Submodule `DGAG-Ajusto-Core` migré vers GitHub** (côté projet) —
   `.gitmodules` passe de l'URL Azure DevOps à l'URL relative
   `../DGAG-Ajusto-Core.git` : résolue contre l'origin du superprojet, donc
   même org GitHub, et le `GIT_PAT` (ou github.token si le repo est
   accessible) suffit au checkout récursif. Après merge :
   `git submodule sync --recursive` chez les développeurs. Le commit épinglé
   du submodule est inchangé — vérifier qu'il existe bien sur le miroir
   GitHub (sinon re-pointer via `git submodule update --remote` + commit).
5. Constat du run : `product_name` résolu = `ad-digital-mobile` (custom
   property du repo) — les chemins Vault sont donc
   `concourse/ad-digital-mobile/...` ; nommer les secrets en conséquence.

## v5.4 (2026-06-11)

Issu d'une comparaison systématique avec la solution chatGPT
(ci-kmp-v2-vault-profile-docs) — deux idées valables reprises, le reste
écarté avec justification.

1. **Vault Prod vs NProd par environnement** — nouveaux inputs
   `vaultUrlProd`/`vaultPathProd` (defaults: vars `VAULT_URL_PROD`/
   `VAULT_PATH_PROD`). resolve-context expose `vault_url`/`vault_path`
   effectifs : env Prod/Beta → Vault PROD si configurée, sinon fallback
   nprod. Les 17 steps vault-action du workflow utilisent ces valeurs.
   Sans ça, release/* cherchait les keystores Prod dans la Vault Non Prod.
2. **Cleanup `androidApp/.env` en `if: always()`** — dans quality-shared,
   quality-android, build-android (fusionné avec le cleanup keystore) et
   update-build-version. Critique sur runners self-hosted (PoolLabMobile) :
   le fichier contenait les 30 ArkanaKeys et survivait au job.

Écarté après analyse (présent chez chatGPT, non repris) :
- `qualityMatrixMode` + qualité Android/iOS en matrix par brand : le
  sonar.projectKey est unique dans build.gradle.kts — deux scans
  écraseraient la même analyse ; Azure ne scannait que Dgag Qa (parité).
- `iosSonarCommand` (commande libre) : notre action structurée porte les
  propriétés Azure exactes, moins fragile.
- Sa concurrency `cancel-in-progress: true` inconditionnelle : la nôtre
  protège release/* et release-gia/*.
- Son update-build-version : placeholder TODO ; le nôtre est complet.

## v5.3 (2026-06-11)

Issu de l'analyse du nouveau build.gradle.kts d'androidApp (1001 lignes,
système multimodule en cours d'introduction).

1. **Fix bloquant : pas de flavor Beta dans Gradle** — les flavors déclarés
   sont `tpicQa`, `dgagQa`, `tpicProd`, `dgagProd`. La table de décision
   Azure produisait `DgagBetaRelease` pour release-gia/* → la tâche
   `assembleDgagBetaRelease` n'existe pas. Nouvel input
   `androidEnvFlavorMap` (resolve-context `android-env-flavor-map`) :
   `{"Beta":"Prod"}` fait construire `assembleDgagProdRelease` tout en
   gardant l'env logique Beta (publication TestFlight Beta, nommage
   d'artefacts `android-dgag-beta-release`). Défaut `{}` = comportement
   inchangé pour les autres projets.
2. **Consumer : `sharedQualityArkana: true`** — `getEnvValue()` (confirmé
   dans le build) lit `.env` puis `System.getenv` et **lève une exception
   à la configuration** si une clé manque. Les `signingConfigs` étant
   évalués à chaque invocation Gradle (même `:shared:testDebugUnitTest`),
   toutes les clés (Keystore*, GoogleMapsApiKeyQA…) doivent être présentes
   dans TOUS les jobs Gradle, y compris la qualité shared. C'est la raison
   historique pour laquelle Azure injectait les 30 clés dans SonarScanShared.
   Conséquence V2 (`arkanaLoadMode: profile`) : chaque profil par brand/env
   doit quand même contenir l'ensemble des clés référencées à la
   configuration — le mode profile ne protège que les clés lues à
   l'exécution. Documenté.
3. **Constats sans changement de code** (projet, pas CI) :
   - `settings.gradle.kts` n'inclut que `:shared` et `:androidApp` —
     `modules/feature/*` et `modules/transverse/*` ont leurs build.gradle.kts
     mais ne sont pas `include()`, et `build-logic` n'est pas `includeBuild()`.
     Quand ils le seront : prévoir l'agrégation Kover multi-modules et la
     portée Sonar ; le CI n'a pas à changer (les tâches sont des inputs).
   - `sonar.projectKey` Android est maintenant DANS le build
     (`com.desjardins.addigitalmobile:ui-ad-digital-mobile-android`) avec
     `qualitygate.wait=true` — cohérent avec la clé iOS v5.2 ; le `-Dsonar.*`
     du CI reste sans effet de conflit (le build prime).
   - La variante Kover `sonarqube` n'agrège que `dgagQaDebug` — cohérent
     avec les tâches qualité dérivées par défaut.
   - `settings.gradle.kts` lit `System.getenv("ARTIFACTORY_REF_TOKEN")` —
     valide l'injection v5.2 sur tous les jobs Gradle, iOS compris.
   - Le root build.gradle.kts lit encore `cmtSdkUserName`/`cmtSdkPassword`/
     `azurePassword` (propriété ou env) pour un repo Maven → le secret
     `azure-feed` reste nécessaire pendant la transition.

## v5.2 (2026-06-11)

Issu d'une revue critique des jobs iOS, inspirée techniquement de
mobile-gha-workflows-ios (fonctionnellement, Azure reste la référence).

1. **Keychain Match éphémère** — `MATCH_KEYCHAIN_NAME` et
   `MATCH_KEYCHAIN_PASSWORD` deviennent `runner-<run_id>-<run_attempt>`,
   créés/détruits dans le job (pattern macos/build-variant de l'org).
   Inputs `iosMatchKeychainName`/`iosMatchKeychainNameCreation` supprimés,
   `MATCH_KEYCHAIN_PASSWORD` retiré de Vault. Justification : Azure
   distinguait deux keychains car ses agents étaient partagés ; chaque job
   GitHub est un runner neuf, un keychain jetable suffit et ne fuit rien.
2. **Secret Match plat** — `iosMatchSecretTemplate` devient
   `match-password-{profileType}-{brandKey}` (champ `value`), cohérent avec
   la Vault plate de l'org (équivalents de MATCH_PASSWORD_DGAG_ENT,
   MATCH_PASSWORD_FEDE_PUBLIC, MATCH_PASSWORD_LP_PUBLIC).
3. **Bug corrigé : credentials Gradle absents des jobs iOS** — le build
   Xcode compile le framework shared KMP via Gradle, qui doit résoudre les
   dépendances. `ARTIFACTORY_REF_TOKEN` + secret `azure-feed` sont maintenant
   importés dans quality-ios-reports et build-ios.
4. **Bug corrigé : orthographe SYSTEM_ACCESSTOKEN** — les templates iOS
   d'Azure utilisaient `SYSTEM_ACCESSTOKEN` (sans underscore) alors
   qu'Android utilisait `SYSTEM_ACCESS_TOKEN`. Les jobs iOS exportent
   maintenant la variante iOS.
5. **Stabilité Fastlane CI** — `FASTLANE_HIDE_TIMESTAMP`,
   `FASTLANE_XCODE_LIST_TIMEOUT=60`, `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=10`,
   `FASTLANE_XCODEBUILD_SETTINGS_RETRIES=3`, `FASTLANE_SKIP_UPDATE_CHECK`
   sur les steps de build/tests iOS (pattern org).
6. **Clé Sonar iOS** — décision : `com.desjardins.addigitalmobile:ui-ad-digital-mobile-ios`
   (remplace `com.desjardins.appsmobilesdgag:...` d'Azure). Projet Sonar à
   créer/renommer en conséquence.
7. **Submodule DGAG-Ajusto-Core sur GitHub** — note mise à jour : le checkout
   `submodules: recursive` récupère automatiquement le commit épinglé par le
   superprojet. `GIT_PAT` reste requis si le repo du submodule est privé
   (le `github.token` est limité au repo courant), mais le problème
   "credential Azure DevOps" disparaît.

## v5.1 (2026-06-11)

### Nouveautés

1. **Inputs `sharedModule` / `androidModule`** — source de vérité unique des
   modules KMP. Les six tâches qualité (`sharedQualityTasks`,
   `sharedCoverageTask`, `sharedSonarTask`, `androidQualityTasks`,
   `androidCoverageTask`, `androidSonarTask`) sont maintenant **dérivées des
   modules** quand elles sont vides :
   - `:shared` → `:shared:testDebugUnitTest`, `:shared:koverXmlReportSonarqube`, `:shared:sonar`
   - `:androidApp` → `ktlintCheck :androidApp:test<Brand>QaDebugUnitTest`,
     `:androidApp:koverXmlReportSonarqube`, `:androidApp:sonar`
     (`<Brand>` = brandName de la 1ère entrée de `androidBrandsConfig`, parité Azure Dgag)
   Un projet avec `:core` au lieu de `:shared` ne change qu'un input.
   Les overrides explicites restent prioritaires.

2. **Diagramme corrigé (review)** — le Sonar Android/shared est maintenant
   visible dans les nœuds quality-* du graphe, avec la justification :
   le scan Gradle tourne dans le même job Linux que les tests (1 job),
   seul iOS est en 2 jobs (tests macOS → scanner CLI Linux), parité Azure.

### Corrections intégrées depuis la publication initiale de v5
(appliquées d'abord en place dans v5, tracées ici pour l'historique)

3. **Vault plate** — support des secrets individuels existants de l'org :
   `androidArkanaSecretsLines` / `iosArkanaSecretsLines`
   (`<secret> <champ> | <ENV>` par ligne, préfixe `concourse/<product>/`
   automatique, export env + écriture `androidApp/.env`).
4. **AppLivery / altool** — alignés sur les noms réels de la Vault :
   `applivery-token-da`/`applivery-token-lp` (champ `value`),
   `altool-api-key[-id]-<brand>`, `altool-issuer-id-<brand>`.
5. **Fix signature vault-keystore** — les noms d'env attendus par
   `emerald-android-signing` (`KeystoreData`…) ne correspondaient pas à ceux
   exportés par vault-action (`keystoreData`…) ; overrides explicites ajoutés.
6. **Fix quality-shared** — supporte le mode Vault plat (Azure injectait les
   ArkanaKeys dans SonarScanShared).

## v5 (2026-06-11)

- Alignement conventions ci-android v7 : `hashicorp/vault-action@v3` +
  `concourse/<product>/<secret>`, secrets GitHub réduits à ROLEID/SECRETID
  (+ GIT_PAT optionnel), productName via `custom_properties.product`,
  defaults sur les vars d'organisation, composite actions référencées `@v5`
  (plus de checkout du repo de workflows).

## v4 (2026-06-11)

- Première version complète : table de décision Azure, matrices
  brands/schemes JSON, APK/AAB + JDK 17/21, signature repo/vault-keystore,
  Sonar iOS 2 phases, gates configurables, publish sans rebuild,
  UpdateBuildVersion, caches Gradle/Konan sur les jobs iOS.

## v1–v3 (historique)

- Scaffolds exploratoires (v3 = composition de ci-android v7 +
  mobile-gha-workflows-ios). Conservés pour référence.
