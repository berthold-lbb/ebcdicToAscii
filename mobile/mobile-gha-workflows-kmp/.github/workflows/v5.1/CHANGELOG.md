# Changelog ci-kmp

Discipline de versionnage : chaque lot de changements = un nouveau dossier
`vX.Y` (workflow + docs), les versions précédentes restent intactes.
Les consommateurs épinglent `@vX.Y`.

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
