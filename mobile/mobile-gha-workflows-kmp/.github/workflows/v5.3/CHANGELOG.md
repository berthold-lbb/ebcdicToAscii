# Changelog ci-kmp

Discipline de versionnage : chaque lot de changements = un nouveau dossier
`vX.Y` (workflow + docs), les versions précédentes restent intactes.
Les consommateurs épinglent `@vX.Y`.

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
