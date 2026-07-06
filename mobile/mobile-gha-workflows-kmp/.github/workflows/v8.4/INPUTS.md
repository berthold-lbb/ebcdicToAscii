# INPUTS — Référence complète (ci-kmp v8.3)

Ce document couvre : (1) les inputs **essentiels** pour démarrer, (2) le **guide des
JSON** (comment écrire des configs valides), (3) les inputs du **consumer**
`mobile-ci-kmp.yml`, (4) la **référence exhaustive** des 102 inputs du workflow,
(5) la **comparaison step-par-step avec Azure** et la justification de l'ordre
qualité → build.

---

## 1. Les inputs ESSENTIELS (à régler pour toute nouvelle app)

| Input | Pourquoi c'est essentiel | Exemple |
|---|---|---|
| `productName` | Préfixe des chemins Vault `concourse/<product>/...`. Vide = custom property `product` du repo, sinon nom du repo. | `ad-digital-mobile` |
| `componentName` | Identité du composant (Sonar, artefacts). | `ui-ad-digital-mobile` |
| `macosRunnerLabel` | Sans lui, les jobs iOS **ne démarrent jamais** (validate-inputs bloque tôt). | `macos-15` |
| `androidBrandsConfig` / `iosSchemesConfig` | Les **matrices** : qui on builde. Voir §2. | — |
| `iosMatchSecretMap` | Noms Vault Match **irréguliers** → mapping explicite obligatoire. Voir §2. | — |
| `androidArkanaSecretsLines` / `iosArkanaSecretsLines` | Les clés Arkana lues de Vault (1 ligne = 1 secret). **Doivent matcher les `.arkana.yml`** de l'app. | — |
| `versionCodeOffset` | `versionCode = run_number + offset`. **≥ dernier code publié au store**, sinon rejet. | `'32100'` |
| `enableMacosOfflineWorkaround` | `true` tant que les runners macOS n'atteignent pas Artifactory. | `true` |
| `sharedSonarProjectKey` / `androidSonarProjectKey` / `iosSonarProjectKey` | Liens dashboards Sonar dans le summary (v8.3). | clés des `build.gradle.kts` |
| secrets `ROLEID` / `SECRETID` | Les **deux seuls** secrets GitHub (AppRole Vault). | — |

---

## 2. Guide des JSON — comment écrire des configs valides

⚠️ Règles générales : JSON **strict** (guillemets doubles, pas de virgule finale,
pas de commentaire) ; dans le YAML, encadrer de quotes simples `'{...}'` ou `>-`.
En cas de JSON invalide, `resolve-context` échoue au job 02 (`jq: invalid JSON`).

### 2.1 `androidBrandsConfig` (array)

```json
[
  {"brandKey":"dgag","brandName":"Dgag","businessLabel":"DGAG",
   "prodKeystorePath":"androidApp/keystore/ajusto-release-key.keystore",
   "packageName":"com.desjardins.assurances"},
  {"brandKey":"tpic","brandName":"Tpic","businessLabel":"LP",
   "prodKeystorePath":"androidApp/keystore/tpic-release-key.keystore",
   "packageName":"com.lapersonnelle.assurances"}
]
```
- `brandKey` : clé technique (filtre `manualAndroidBrand`, templates Vault `{brandKey}`).
- `brandName` : préfixe des variants Gradle (`DgagQaDebug` = brandName+env+config).
- `prodKeystorePath` : où décoder le keystore Vault en mode `vault-keystore` —
  doit égaler le `storeFile` du `build.gradle.kts`.
- La **1ʳᵉ entrée** est le brand par défaut des PR (matrice restreinte).

### 2.2 `iosSchemesConfig` (array)

```json
[
  {"brandKey":"dgag","businessLabel":"DGAG","scheme":"DesjardinsAssurances",
   "ipaNameEnterprise":"com.ent.dgaginno.desjardins.assurances.ipa",
   "ipaNameStore":"com.desjardins.ajusto.ipa",
   "matchRepoEnterprise":"mobile-support/codesigning-ios-enterprise-dgag",
   "matchRepoStore":"mobile-support/codesigning-ios-public-desjardins"},
  {"brandKey":"tpic","businessLabel":"LP","scheme":"LaPersonnelle",
   "ipaNameEnterprise":"com.ent.dgaginno.lapersonnelle.ipa",
   "ipaNameStore":"com.lapersonnelle.ajusto.ipa",
   "matchRepoEnterprise":"mobile-support/codesigning-ios-enterprise-dgag",
   "matchRepoStore":"mobile-support/codesigning-ios-public-lapersonnelle"}
]
```
- `scheme` : le **vrai** scheme Xcode. `resolve-context` choisit
  `ipaName*`/`matchRepo*` selon le `profileType` (enterprise = AppLivery,
  appstore = TestFlight).

### 2.3 `iosMatchSecretMap` (objet `brandKey-profileType` → secret Vault)

```json
{"dgag-enterprise":"match-password-dgag-ent",
 "tpic-enterprise":"match-password-dgag-ent",
 "dgag-appstore":"match-password-fede-public",
 "tpic-appstore":"match-password-lp-public"}
```
Obligatoire ici car les noms Vault sont **irréguliers** (dgag→fede en appstore,
tpic→lp ; cert enterprise partagé). Clé absente = fallback sur
`iosMatchSecretTemplate` (`match-password-{profileType}-{brandKey}`).

### 2.4 `branchRulesJson` (objet `branch_type` → surcharge partielle)

```json
{"rc":{"distribution":"none"},
 "main":{"env":"Dev","buildConfiguration":"Debug"}}
```
Champs possibles : `env`, `buildConfiguration`, `distribution`, `fullMatrix` —
**seuls les champs fournis** remplacent la règle par défaut. branch_type absents
= comportement historique. Priorité : défauts → branchRulesJson → dispatch →
manualDistribution.

### 2.5 `androidArkanaSecretsLines` / `iosArkanaSecretsLines` (bloc `|`)

```yaml
androidArkanaSecretsLines: |
  dragon-api-key-dev value | DragonServerApiKeyDev
  keystore-dgag-password value | KeystoreDgagPassword
```
- Format : `<secret-vault> value | <ENV_NAME>` — gauche = nom **exact** dans
  Vault ; droite = nom **exact** attendu par `.arkana.yml` / `getEnvValue()`.
- ⚠️ Jamais de `#` dans le bloc `|` (YAML le prend comme une vraie ligne).
- ⚠️ Les listes Android et iOS sont **différentes** (ne pas copier l'une sur
  l'autre) : iOS = les 39 `global_secrets` de `iosApp/.arkana.yml`.

---

## 3. Le consumer `mobile-ci-kmp.yml` — ce qu'il fournit

| Bloc consumer | Rôle |
|---|---|
| `on: pull_request` (types + `labeled`) | CI de PR + publication de test par label `publish:applivery`/`publish:testflight` (v8.1). |
| `on: push` (main, rc/**, release/**, release-gia/**, applivery-archives) | Déclencheurs publiants selon la branche. |
| `on: workflow_dispatch` (platform, androidBrand, iosScheme, distribution, dryRun) | Run manuel ciblé ; `dryRun` = publication simulée. |
| `permissions: contents: write, actions: read, checks: write` | Minimum requis (artefacts, checks). |
| `uses: ...v8.3/ci-kmp.yml@v8.3` | Épinglage de version — rollback en 1 ligne. |
| `with:` | Tous les inputs ci-dessus (§1/§2 + référence §4). |
| `secrets: ROLEID / SECRETID` | Credentials AppRole Vault — les seuls secrets GitHub. |
| `manualPlatform/Brand/Scheme/Distribution` | Relais des choix dispatch/label vers resolve-context. |

---

## 4. Référence EXHAUSTIVE des inputs du workflow (générée depuis le YAML v8.3)

| Input | Type | Défaut | Description |
|---|---|---|---|
| `productName` | string | `''` | Nom produit Vault. Vide = custom_properties.product puis nom du repo. |
| `componentName` | string | `''` | Nom de composant (Sonar). Vide = nom du repo. |
| `enableShared` | boolean | `True` | Active la qualité shared/Kore. |
| `enableAndroid` | boolean | `True` | Active qualité + build + publish Android. |
| `enableIos` | boolean | `True` | Active qualité + build + publish iOS. |
| `linuxRunnerLabel` | string | `${{ vars.DEFAULT_RUNNER_LABEL }}` | Runner Linux. |
| `macosRunnerLabel` | string | `${{ vars.DEFAULT_MACOS_RUNNER_LABEL }}` | Runner macOS. |
| `vaultUrl` | string | `${{ vars.VAULT_URL_NPROD }}` | URL Vault. |
| `vaultPath` | string | `${{ vars.VAULT_PATH_NPROD }}` | Mount AppRole Vault. |
| `vaultSecretsRoot` | string | `concourse` | Racine des secrets de données. Parité v7: `concourse`. |
| `sonarqubeUrl` | string | `${{ vars.SONARQUBE_URL }}` | URL SonarQube. |
| `androidBrandsConfig` | string | `[{"brandKey":"dgag","brandName":"Dgag","businessLabel":"DGAG","prodKeystorePath":"androidApp/keystore/ajusto-release-key.keystore","packageName":"ca.dgag.ajusto","appliveryTokenEnv":"APP_LIVERY_API_TOKEN_DA"},{"brandKey":"tpic","brandName":"Tpic","businessLabel":"LP","prodKeystorePath":"androidApp/keystore/lapersonnelle-release-key.keystore","packageName":"ca.lapersonnelle.ajusto","appliveryTokenEnv":"APP_LIVERY_API_TOKEN_LP"}]` | JSON des brands Android (brandKey, brandName, businessLabel, prodKeystorePath, packageName, appliveryTokenEnv). |
| `iosSchemesConfig` | string | `[{"brandKey":"dgag","businessLabel":"DGAG","scheme":"DesjardinsAssurances","ipaNameEnterprise":"com.ent.dgaginno.desjardins.assurances.ipa","ipaNameStore":"com.desjardins.ajusto.ipa","matchRepoEnterprise":"mobile-support/codesigning-ios-enterprise-dgag","matchRepoStore":"mobile-support/codesigning-ios-public-desjardins","appliveryTokenEnv":"APP_LIVERY_API_TOKEN_DA"},{"brandKey":"tpic","businessLabel":"LP","scheme":"LaPersonnelle","ipaNameEnterprise":"com.ent.dgaginno.tpic.ipa","ipaNameStore":"com.lapersonnelle.ajusto.ipa","matchRepoEnterprise":"mobile-support/codesigning-ios-enterprise-dgag","matchRepoStore":"mobile-support/codesigning-ios-public-lapersonnelle","appliveryTokenEnv":"APP_LIVERY_API_TOKEN_LP"}]` | JSON des schemes iOS (brandKey, businessLabel, scheme, ipaNameEnterprise, ipaNameStore, matchRepoEnterprise, matchRepoStore, appliveryTokenEnv). |
| `androidDefaultBrandKey` | string | `dgag` | Brand du build de validation PR. |
| `iosDefaultSchemeKey` | string | `dgag` | Scheme (brandKey) de la validation PR. |
| `rcEnvName` | string | `Qa` | Env des branches rc/*. |
| `branchRulesJson` | string | `{}` | v8 — Règles de branches PERSONNALISÉES (JSON). Clé = branch_type (feature\|pr\|main\|applivery-archives\|rc\|release\|release-gia), valeur = {"env","buildConfiguration","distribution","fullMatrix"} — chaque champ est optionnel et SURCHARGE la règle par défaut codée (parité Azure). Exemple: '{"rc":{"distribution":"none"},"release":{"env":"Prod"}}'. Vide/'{}' = règles historiques inchangées. |
| `enableMacosOfflineWorkaround` | boolean | `True` | v8 — Active le contournement Artifactory pour runners macOS ISOLÉS du réseau interne : job 05 mirror-internal-deps + setup-mirror (init script Gradle) + DIAG réseau dans les jobs iOS. Mettre `false` si les runners macOS atteignent Artifactory (résolution directe, comme Linux). NB: le seal/unseal des secrets (jobs 04/12/31/43) reste TOUJOURS actif — léger et fonctionne dans les deux cas. |
| `enableAppLivery` | boolean | `True` | AppLivery sur main/rc/applivery-archives. |
| `enableTestFlight` | boolean | `True` | TestFlight sur release/* et release-gia/*. |
| `versionCodeOffset` | string | `0` | Offset ajouté à github.run_number pour le versionCode Android (et le build number iOS). Mettre la valeur ≥ au dernier VERSION_CODE déjà publié au store, sinon l'upload est rejeté. Exemple: '1000'. |
| `dryRun` | boolean | `False` | Builds réels, publications simulées. |
| `androidBuildMode` | string | `fastlane` | `fastlane` (BUILD_VARIANT, parité Azure) ou `gradle`. |
| `androidFastlaneDirectory` | string | `androidApp` | Répertoire Gemfile/Fastfile Android. |
| `androidApkLane` | string | `assemble` | Lane APK (Qa). Azure: `assemble`. |
| `androidAabLane` | string | `bundle` | Lane AAB (Prod/Beta). Azure: `bundle`. |
| `androidProdSigningMode` | string | `vault-keystore` | Signature Prod/Beta: `vault-keystore` ou `repo-keystore`. |
| `androidEnvFlavorMap` | string | `{}` | Mapping env logique → flavor Gradle réel pour le buildVariant. Exemple: `{"Beta":"Prod"}` si build.gradle.kts ne déclare que des flavors *Qa/*Prod (cas ui-ad-digital-mobile : release-gia/* construit assembleDgagProdRelease, l'env reste Beta pour la publication). |
| `androidExtraGradleArgs` | string | `''` | Args Gradle additionnels des builds. |
| `compileSdkVersion` | string | `''` | Plateforme SDK à installer (vide = préinstallée). |
| `buildToolsVersion` | string | `''` | Build-tools à installer (vide = ignoré). |
| `androidJdkVersionQuality` | string | `21` | JDK des jobs qualité. |
| `sharedModule` | string | `:shared` | Module Gradle du shared/Kore. Exemple: `:shared`. |
| `androidModule` | string | `:androidApp` | Module Gradle de l'app Android. Exemple: `:androidApp`. |
| `sharedQualityTasks` | string | `''` | Tests shared. Vide = dérivé de sharedModule (parité Azure). |
| `sharedCoverageTask` | string | `''` | Kover shared. Vide = dérivé de sharedModule. |
| `sharedSonarTask` | string | `''` | Sonar shared. Vide = dérivé de sharedModule. |
| `androidQualityTasks` | string | `''` | Lint + tests androidApp. Vide = dérivé de androidModule + brand par défaut (parité Azure: ktlint + tests Dgag Qa). |
| `androidCoverageTask` | string | `''` | Kover androidApp. Vide = dérivé de androidModule. |
| `androidSonarTask` | string | `''` | Sonar androidApp. Vide = dérivé de androidModule. |
| `iosWorkingDirectory` | string | `iosApp` | Répertoire iOS. |
| `iosJdkVersion` | string | `21` | JDK utilisé par la phase Xcode « Setup Shared Modules » qui compile le framework KMP shared (./gradlew :shared:embedAndSignAppleFrameworkForXcode). DOIT être 21 : build-logic est compilé en bytecode Java 21, un daemon Gradle en JDK < 21 lève UnsupportedClassVersionError. Parité Azure (Temurin 21). |
| `iosValidateLane` | string | `validate_build` | Lane validation PR. Azure: `validate_build`. |
| `iosBuildLane` | string | `validate_build` | Lane IPA enterprise (AppLivery). |
| `iosStoreBuildLane` | string | `validate_build` | Lane IPA appstore (TestFlight, sans publier). |
| `iosUnitTestsLane` | string | `unit_tests_sonarqube` | Lane tests + rapports Sonar. Azure: `unit_tests_sonarqube`. |
| `iosUnitTestsFastlaneEnv` | string | `dgag_qa` | --env des tests iOS. Azure: `dgag_qa`. |
| `iosUnitTestsScheme` | string | `DesjardinsAssurances` | Scheme Xcode pour les tests unitaires (scan). Azure testing-template: `DesjardinsAssurances`. |
| `iosSwiftlintScript` | string | `./swiftlint_ci.sh` | Script SwiftLint. Azure: `./swiftlint_ci.sh`. |
| `iosReportsDirectory` | string | `test_derived_data` | Répertoire des rapports Sonar iOS (relatif au répertoire iOS). |
| `iosSonarProjectKey` | string | `''` | Clé Sonar iOS. Vide = com.desjardins:<component>-ios. |
| `sharedSonarProjectKey` | string | `''` | v8.3 — Clé Sonar du module shared (lien direct dans le summary). Vide = pas de lien. |
| `androidSonarProjectKey` | string | `''` | v8.3 — Clé Sonar Android (lien direct dans le summary). Vide = pas de lien. |
| `iosMatchRef` | string | `main` | Branche des repos Match. |
| `iosUnitTestsCiValue` | string | `false` | Valeur de CI pour les tests simulateur. Azure: `false`. |
| `checkoutSubmodules` | string | `recursive` | Submodules du checkout iOS: `recursive`, `true`, `false`. |
| `xcodeVersion` | string | `''` | Version Xcode (vide = défaut runner). |
| `androidAppliveryPublishMode` | string | `fastlane` | `fastlane` (applivery_deploy, parité Azure) ou `api`. |
| `androidAppliveryLane` | string | `applivery_deploy` | Lane AppLivery Android. |
| `iosAppliveryPublishMode` | string | `api` | `api` (recommandé, sans rebuild) ou `fastlane`. |
| `iosTestflightPublishMode` | string | `altool` | `altool` (recommandé, sans rebuild) ou `fastlane` (rebuild). |
| `enableQualityGates` | boolean | `True` | Politique globale des gates. |
| `enableSharedQualityGate` | boolean | `True` | Gate shared requis. |
| `enableAndroidQualityGate` | boolean | `True` | Gate Android requis. |
| `enableIosQualityGate` | boolean | `True` | Gate iOS requis. |
| `allowBuildWhenQualityGateSkipped` | boolean | `True` | Build autorisé si un gate est explicitement skipped. |
| `allowPublishWhenQualityGateSkipped` | boolean | `False` | Publish autorisé si un gate est skipped (recommandé: false). |
| `enableSonar` | boolean | `True` | Active les scans Sonar. |
| `sonarQualityGateWait` | boolean | `True` | Bloque sur le quality gate Sonar. |
| `sonarGradleJvmArgs` | string | `-Xmx2g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8` | JVM args des scans Gradle. |
| `enableGradleCache` | boolean | `True` | Cache Gradle (Linux + macOS — le build iOS compile shared). |
| `enableAndroidSdkCache` | boolean | `True` | Cache des packages sdkmanager. |
| `enableBundlerCache` | boolean | `True` | Cache des gems (Gemfile.lock). |
| `enableCocoaPodsCache` | boolean | `True` | Cache Pods (inutile si Pods/ commité). |
| `iosRunPodInstall` | boolean | `False` | Exécute pod install (false si Pods/ commité). |
| `enableSpmCache` | boolean | `False` | Cache SPM. |
| `enableXcodeDerivedDataCache` | boolean | `False` | Cache DerivedData (opt-in). |
| `enableKonanCache` | boolean | `True` | Cache Kotlin/Native (critique sur les jobs iOS KMP). |
| `sonarTokenSecret` | string | `sonarqube-token` | Secret du token Sonar (champ `value`). Parité v7: `sonarqube-token`. |
| `artifactoryTokenSecret` | string | `artifactory-api-key` | Secret du token Artifactory (champ `value`). Parité v7: `artifactory-api-key`. |
| `gitPatSecret` | string | `git-user-access-token` | Secret Vault (champ `value`) du PAT GitHub utilisé pour les checkouts (submodule iOS privé, repos Match). Récupéré depuis Vault comme les autres secrets — plus besoin du secret GitHub GIT_PAT. Vide = repli sur github.token (suffisant uniquement si aucun submodule/repo privé externe). |
| `mavenFeedUsernameSecret` | string | `cmt-sdk-username` | Secret plat (champ `value`) du username du repo Maven externe CMT Telematics (artifactory.cmtelematics.com du root build.gradle.kts). Exporté sous les deux casses lues par le projet: CMT_SDK_USERNAME (Fastfile, -P) et cmtSdkUserName (System.getenv du root build — indispensable au build iOS qui invoque Gradle sans -P). Vide = non chargé. |
| `mavenFeedPasswordSecret` | string | `cmt-sdk-password` | Secret plat (champ `value`) du password CMT. Exporté en CMT_SDK_PASSWORD et cmtSdkPassword. Vide = non chargé. |
| `arkanaLoadMode` | string | `full` | `full` (un secret global par plateforme) ou `profile` (par brand/env). |
| `androidArkanaSecret` | string | `arkana-android` | Secret Arkana Android mode full (champ `dotenv`). |
| `androidArkanaSecretTemplate` | string | `arkana-android-{brandKey}-{env}` | Template mode profile. Placeholders {brandKey},{env}. |
| `iosArkanaSecret` | string | `arkana-ios` | Secret Arkana iOS mode full (champ `dotenv`). |
| `iosArkanaSecretTemplate` | string | `arkana-ios-{brandKey}-{env}` | Template mode profile iOS. |
| `androidSigningSecretTemplate` | string | `keystore-{brandKey}-{env}` | Secret signature Prod/Beta (champs keystoreData/keystorePassword/keyAlias/keyPassword). |
| `iosMatchSecretTemplate` | string | `match-password-{profileType}-{brandKey}` | Secret PLAT du password Match (champ `value`), un par profil/brand. Azure: MATCH_PASSWORD_DGAG_ENT, MATCH_PASSWORD_FEDE_PUBLIC, MATCH_PASSWORD_LP_PUBLIC. Placeholders {profileType},{brandKey}. |
| `iosMatchSecretMap` | string | `{}` | Mapping explicite (JSON) du secret Match par `{brandKey}-{profileType}`, prioritaire sur iosMatchSecretTemplate (Vault aux noms irréguliers). Vide = template. Exemple: `{"dgag-enterprise":"match-password-dgag-ent"}`. |
| `appliveryTokenDaSecret` | string | `applivery-token-da` | Secret plat du token AppLivery DA (champ `value`). Vault réelle: `applivery-token-da`. |
| `appliveryTokenLpSecret` | string | `applivery-token-lp` | Secret plat du token AppLivery LP (champ `value`). Vault réelle: `applivery-token-lp`. |
| `androidArkanaSecretsLines` | string | `''` | Mode Vault PLAT pour les ArkanaKeys Android : une ligne par secret au format `<nom-secret> <champ> \| <ENV_VAR>` (sans le préfixe <root>/<product>/). Si non vide, remplace le secret dotenv `androidArkanaSecret`. Exemple: `dragon-server-api-key-qa value \| DragonServerApiKeyQA`. |
| `iosArkanaSecretsLines` | string | `''` | Mode Vault plat pour les ArkanaKeys iOS (même format). Si non vide, remplace `iosArkanaSecret`. |
| `sharedQualityArkana` | boolean | `False` | Charger les ArkanaKeys Android pour la qualité shared. |
| `manualPlatform` | string | `''` | `all`, `shared`, `android`, `ios`. |
| `manualAndroidBrand` | string | `''` | BrandKey forcé ou `all`. |
| `manualIosScheme` | string | `''` | BrandKey scheme forcé ou `all`. |
| `manualEnvName` | string | `''` | `Qa`, `Prod`, `Beta`. |
| `manualBuildConfiguration` | string | `''` | `Debug`, `Release`. |
| `manualDistribution` | string | `''` | `none`, `applivery`, `testflight`. |

---

## 5. Comparaison step-par-step avec Azure — et justification des choix

### 5.1 Correspondance des étapes

| Étape Azure (azure-pipelines.yml + templates) | Équivalent GHA v8.3 | Amélioration |
|---|---|---|
| Variables/paramètres dispersés dans les stages `${{ if }}` | Job 02 `resolve-context` (1 action, table de décision + matrices JSON) | Logique centralisée, testable, surchargée par `branchRulesJson` sans fork |
| Variable group `DGAG-Pipelines` | Vault AppRole (2 secrets GitHub au total) | Coffre unique audité, rotation centralisée |
| `DownloadSecureFile` (keystores) | Keystore base64 dans Vault → décodé au build → supprimé `if: always()` | Même garantie sans service propriétaire ; multi-champs (data+passwords+alias) |
| `sudo gem install bundler` + `bundle install` (Ruby système, non gelé) | `ruby/setup-ruby` 3.2.5 + Bundler frozen + `Gemfile.lock` + cache gems | Builds reproductibles + plus rapides (cache) |
| Testing template (tests unitaires + Sonar par plateforme, stages séquentiels) | Jobs 10/11/12 **en parallèle** (shared / Android / iOS) | Latence réduite : 3 qualités simultanées |
| Sonar publish + quality gate implicite | Job 13 (scan iOS) + job 20 `gate-policy` (allow_build/allow_publish explicites) | Politique visible, options *skipped* configurables |
| Building templates (1 stage par brand, séquentiel) | Jobs 30/31 **matriciels** (1 job par brand/scheme, parallèles) | 2 brands = 2 builds simultanés ; ajout d'un brand = 1 entrée JSON |
| `UpdateBuildVersion` (incrementVersion + commit `[skip ci]`) | `versionCode = run_number + versionCodeOffset` (injection Gradle) | Plus de push CI, plus de boucle, reproductible |
| Publish AppLivery/TestFlight (relance des templates de build) | Jobs 40/42/43 **sans rebuild** (artefact du build publié tel quel) | Binaire publié = binaire testé ; publication plus rapide |
| Google Play | **Retiré (v8.2)** — AAB Prod en artefact | Décision produit, parité avec l'usage réel Azure |
| — (impossible sur Azure self-hosted équivalent) | Seal/unseal secrets + mirror Artifactory pour runners macOS isolés | Contrainte réseau absorbée, débranchable (`enableMacosOfflineWorkaround`) |
| Logs de stage bruts | Summary v8.3 : liens Sonar, icônes, build number, artefacts | Observabilité du run en un écran |

### 5.2 Pourquoi qualité (tests+Sonar) AVANT build ?

C'est le choix hérité d'Azure, **conservé volontairement** :
1. **Échec au plus tôt/au moins cher** : un test rouge coûte ~minutes Linux ;
   un build iOS signé coûte des dizaines de minutes macOS (ressource rare).
   Construire un binaire qu'on jettera si la qualité est rouge = gaspillage.
2. **Le gate a besoin de Sonar** : `allow_publish` dépend du quality gate Sonar —
   il faut donc l'analyse avant de décider de builder/publier.
3. **Pas de perte de parallélisme réel** : les 3 qualités tournent en parallèle,
   et les builds (30/31) démarrent dès le gate — sur des runners différents.

Compromis assumé (documenté) : le **gate global unique** fait attendre le build
Android sur la qualité iOS. L'alternative (gates par plateforme) accélérerait
Android au prix d'une politique plus complexe — à activer si la latence Android
devient un irritant réel.

### 5.3 Ordre interne d'un job de build (et pourquoi)

1. **Unseal** (secrets d'abord : le checkout du submodule privé a besoin du PAT).
2. **Checkout** (avec `GIT_ACCESS_TOKEN`).
3. **Mirror/init script** (avant tout Gradle : les repos doivent être en place
   AVANT la première résolution).
4. **Setup env** (JDK/Ruby/SDK/caches).
5. **Signing** (keystore décodé juste avant le build, pas avant).
6. **Build** (Fastlane).
7. **Cleanup `if: always()`** (keystore + .env supprimés même en échec).
