# Azure Pipelines → ci-kmp v5 : mapping fonctionnel complet

Document de traçabilité : chaque bloc d'`azure-pipelines.yml` et de ses
templates, son équivalent v5, et la justification du choix.

---

## 1. Graphe d'exécution réel (parallélisme + conditions)

```mermaid
flowchart TD
    subgraph SEQ["Séquentiel (≈30s)"]
        E[01 evaluate<br/>product/component/branche] --> RC[02 resolve-context<br/>table de décision + matrices]
        RC --> VI[03 validate-inputs]
    end

    VI --> QS
    VI --> QA
    VI --> QI

    subgraph PAR1["Parallèle — 3 runners simultanés"]
        QS["10 quality-shared (Linux)<br/>if shared_enabled"]
        QA["11 quality-android (Linux)<br/>if android_enabled"]
        QI["12 quality-ios-reports (macOS)<br/>if ios_enabled<br/>checkout submodules+LFS"]
    end

    QI --> SI["13 sonar-ios (Linux)<br/>if ios_enabled && enableSonar<br/>télécharge les 2 rapports"]

    QS --> G
    QA --> G
    SI --> G

    G{"20 gates<br/>if always()<br/>agrège les 3 résultats"}

    G -- "allow_build=true" --> BA
    G -- "allow_build=true" --> BI
    G -- "allow_build=false" --> X[Tous les jobs suivants skipped]

    subgraph PAR2["Parallèle — jusqu'à 4 runners (matrix)"]
        BA["30 build-android<br/>matrix: Dgag ∥ Tpic"]
        BI["31 build-ios (macOS)<br/>matrix: DesjardinsAssurances ∥ LaPersonnelle"]
    end

    BA --> PAA["40 applivery Android<br/>if distribution=applivery && allow_publish"]
    BA --> PGP["41 google-play<br/>if enableGooglePlay && release*<br/>(défaut: skipped)"]
    BI --> PIA["42 applivery iOS<br/>matrix par scheme"]
    BI --> PTF["43 testflight<br/>matrix par scheme, if release*"]

    PAA --> UV["50 update-build-version (macOS)<br/>if run_update_version && rien en failure"]
    PGP --> UV
    PIA --> UV
    PTF --> UV
    UV --> S["60 summary — if always()"]
```

Lecture : GitHub Actions lance un job dès que tous ses `needs` sont terminés et
que son `if` est vrai. Les trois jobs qualité démarrent donc **en même temps**
sur trois runners. Les matrices ajoutent un niveau : `build-android` = 2 jobs
simultanés (Dgag, Tpic), `build-ios` = 2 jobs macOS simultanés. Au pic, 4
runners de build tournent en parallèle — Azure faisait pareil avec ses stages
`dependsOn: []`.

Les jobs en aval d'un job skipped utilisent `if: always() && <conditions>` :
`always()` empêche le skip en cascade, et la condition explicite
(`needs.gates.outputs.allow_build == 'true'`) reprend le contrôle. C'est le
remplacement exact des `${{ if }}` de compilation Azure, mais évalué au runtime
(un seul YAML couvre toutes les branches).

---

## 2. Mapping bloc par bloc Azure → v5

### Stage SonarScanAndroidApp (scan-template-gradle.yml)

| Step Azure | Équivalent v5 | Justification |
|---|---|---|
| `SonarQubePrepare@7` (endpoint SonarQube) | vault-action → `sonarqube-token value \| SONAR_TOKEN` + input `sonarqubeUrl` | GitHub n'a pas de service connections ; convention ci-android v7 |
| `Cache@2` gradle | `gradle/actions/setup-gradle@v4` (emerald-setup-android-env) | action officielle, clés dérivées des lockfiles, gère aussi le build-cache |
| `Gradle@3` : `testDgagQaDebugUnitTest koverXmlReportSonarqube sonar --build-cache -PcmtSdkUserName=... -PcmtSdkPassword=... -PazurePassword=$(System.AccessToken)` + 30 env ArkanaKeys | `emerald-mobile-sonar-scan-gradle` : `androidQualityTasks` + `androidCoverageTask` + `androidSonarTask`, `-P` reconstitués depuis l'env Vault (`azure-feed`), ArkanaKeys injectées avant (vault-action + export) | mêmes tâches Gradle, mêmes propriétés ; les credentials viennent de Vault au lieu du variable group |
| `SonarQubePublish@7` (pollingTimeout 600) | `-Dsonar.qualitygate.wait=true` (input `sonarQualityGateWait`) | équivalent natif scanner, supprime un step |

### Stage SonarScanShared

Identique au précédent avec `:shared:*` → job `quality-shared`, mêmes
mécanismes. Azure y injectait aussi les ArkanaKeys ; v5 le fait via
`sharedQualityArkana: true` (les deux modes dotenv/plat sont supportés).
Défaut `false` car les tests `:shared` n'en ont en principe pas besoin — à
activer si un test lit ces variables.

### Stage Linter (androidApp/testing-template.yml)

| Azure | v5 | Justification |
|---|---|---|
| `bundle exec fastlane ktlintCheck` + env complet | tâche `ktlintCheck` intégrée à `androidQualityTasks` du job quality-android | la lane Azure ne faisait que `gradle ktlintCheck` avec les mêmes `-P` ; passer par Gradle directement supprime un job et une installation Ruby. Même commande, même résultat. |

### Stage UnitTestiOSApp (iosApp/testing-template.yml)

| Step Azure | v5 (job quality-ios-reports, macOS) | Justification |
|---|---|---|
| `checkout: self, submodules: recursive, persistCredentials` | `actions/checkout@v4` `submodules: ${{ inputs.checkoutSubmodules }}` (défaut `recursive`) + `token: GIT_PAT \|\| github.token` | submodule DGAG-Ajusto-Core requis pour compiler |
| `git lfs install` + `git lfs pull` | `lfs: true` au checkout **et** `git lfs pull` dans emerald-setup-ios-env | double sécurité : checkout récupère les pointeurs, le setup force le pull (parité exacte) |
| `gem install bundler` + `bundle install` | `ruby/setup-ruby@v1` avec `bundler-cache` | version org-standard, avec cache |
| variable `CI: 'false'` | `env: CI: ${{ inputs.iosUnitTestsCiValue }}` (défaut `'false'`) sur le step de tests uniquement | Azure le mettait au niveau job ; v5 le limite au step qui en a besoin (les builds simulateur) |
| `./swiftlint_ci.sh` | step SwiftLint (`iosSwiftlintScript`) | identique |
| `fastlane unit_tests_sonarqube --env dgag_qa` + ArkanaKeys | step Unit tests avec `iosUnitTestsLane`/`iosUnitTestsFastlaneEnv`, ArkanaKeys injectées avant par vault-action | identique |
| `PublishBuildArtifacts` ×2 (swiftlint.xml, coverage.xml) | `actions/upload-artifact@v4` ×2 (`ios-sonar-swiftlint`, `ios-sonar-coverage`) | transport inter-jobs identique |

### Stage SonarScanIosApp (sonar/scan-template-ios.yml)

| Step Azure (Linux !) | v5 (job sonar-ios, Linux) | Justification |
|---|---|---|
| `DownloadBuildArtifacts` ×2 | `actions/download-artifact@v4` ×2 (dans emerald-mobile-sonar-scan-ios) | même architecture 2 phases macOS→Linux, conservée car le scanner CLI sur Linux est moins cher et la config Sonar y est centralisée |
| `SonarQubePrepare` CLI, projectKey `com.desjardins.appsmobilesdgag:ui-ad-digital-mobile-ios`, toutes les propriétés (suffixes, exclusions, coverageReportPaths, swiftlint.reportPaths, qualitygate.wait) | sonar-scanner CLI avec **exactement les mêmes propriétés**, projectKey = input `iosSonarProjectKey` | voir §6 — la clé doit rester celle d'Azure pour conserver l'historique |
| `sonar.pullrequest.*` | `pr-key/pr-branch/pr-base` alimentés par le contexte PR GitHub | analyse PR conservée |

### Stage AndroidAppBuild (androidApp/building-template.yml) ×2 brands

| Step Azure | v5 (job build-android, matrix) | Justification |
|---|---|---|
| 2 jobs déclarés en dur (Dgag, Tpic) | `strategy.matrix` générée par resolve-context depuis `androidBrandsConfig` | ajouter une brand = 1 entrée JSON, zéro YAML |
| `DownloadSecureFile` keystore Dgag/Tpic Prod | `emerald-android-signing` mode `vault-keystore` : secret `keystore-<brand>-<env>` (keystoreData base64) décodé au chemin exact de build.gradle.kts, supprimé en `if: always()` | GitHub n'a pas de Secure Files ; le pattern smd-android (base64 dans Vault) est l'équivalent éprouvé. En Debug/Qa : mode `repo-keystore`, les fichiers du repo + passwords ArkanaKeys suffisent (rien à faire). |
| `if Release && env≠Qa` → `fastlane bundle` + `JAVA_HOME_21_X64`, sinon `fastlane assemble` + `JAVA_HOME_17_X64` | resolve-context met `fastlaneLane=bundle/assemble`, `javaVersion=21/17`, `artifactFormat=aab/apk` dans chaque entrée de matrice ; build-android exporte `JAVA_HOME_<ver>_X64=$JAVA_HOME` | même aiguillage, calculé une seule fois au lieu de conditions de template dupliquées |
| `BUILD_VARIANT: DgagQaRelease` + 30 env + `CMT_SDK_*` + `SYSTEM_ACCESS_TOKEN` | `BUILD_VARIANT` = `matrix.buildVariant` ; ArkanaKeys via vault-action (env + androidApp/.env) ; `CMT_SDK_*`/`SYSTEM_ACCESS_TOKEN` via secret `azure-feed` | mêmes noms de variables → Fastfile et getEnvValue inchangés |
| `CopyFiles` + `PublishBuildArtifacts` (APK ou AAB, flatten) | `actions/upload-artifact@v4` avec glob apk/aab selon `matrix.artifactGlob` | même rôle |

### Stage PublishAndroidToAppLivery (androidApp/publishing-template.yml)

| Step Azure | v5 (job publish-android-applivery) | Justification |
|---|---|---|
| condition `publishAndroidToApplivery` (main/rc/applivery-archives) + `dependsOn: Linter, AndroidAppBuild` + `condition: succeeded()` | `if: distribution=applivery && allow_publish && build-android=success` | même condition, plus le gate transverse (amélioration) |
| `DownloadBuildArtifacts` → staging | `download-artifact pattern: android-*` → `ARTIFACTS_PATH` | **jamais de rebuild**, comme Azure |
| `fastlane applivery_deploy` env `APP_LIVERY_API_TOKEN_DA/LP`, `APP_LIVERY_TAGS`, `BRANCH_NAME` | même lane, tokens depuis Vault (`applivery-token-da/lp`, champ `value`), tag `branch:<sha256[0:8]>` recalculé dans l'action | la lane publie les 2 brands en un appel — conservé tel quel (1 job, pas de matrix) |

### Stages iOSAppBuild / iOSAppDeploy (building/publishing-template.yml)

| Step Azure | v5 (job build-ios, matrix) | Justification |
|---|---|---|
| condition `if not(main/rc/...)` pour build PR vs `if main/rc/applivery-archives` pour deploy | resolve-context : PR → lane `iosValidateLane` ; applivery → `iosBuildLane` (build IPA) puis job publish séparé | Azure rebuildait dans le job deploy ; v5 sépare build/publish (décision validée « publish ne rebuild jamais »). La parité stricte reste possible : `iosAppliveryPublishMode: fastlane`. |
| `checkout matchcodesigningrepo` + `git checkout --force main` + `MATCH_GIT_URL=file://...` | `emerald-mobile-build-ios-app` : checkout du repo Match (`matrix.matchRepo`, token GIT_PAT), `MATCH_GIT_URL=file://$GITHUB_WORKSPACE/.match-codesigning` | reproduction exacte du contournement Azure |
| `MATCH_KEYCHAIN_NAME` (enterprise) vs `MATCH_KEYCHAIN_NAME_CREATION` (appstore) | `matrix.profileType == 'appstore' && iosMatchKeychainNameCreation \|\| iosMatchKeychainName` | distinction conservée |
| `SCHEME`, `PROFILE_TYPE`, `CONFIGURATION`, `IPA_NAME`, `--env dgag_qa` | tous dans la matrice (scheme réel `DesjardinsAssurances`/`LaPersonnelle`, ipaName enterprise/store selon profileType, fastlaneEnv `<brand>_<qa\|store>`) | calculés par resolve-context depuis `iosSchemesConfig` |
| keychain non nettoyé | `security delete-keychain` en `if: always()` | amélioration sécurité |

### Stages iOSBuildReleaseAndPublish / iOSBuildBetaAndPublish

| Step Azure | v5 | Justification |
|---|---|---|
| `fastlane testflight_deploy --env <brand>_store`, `PROFILE_TYPE=appstore`, `CONFIGURATION=Prod\|Beta` | build-ios produit l'IPA appstore (CONFIGURATION=Prod/Beta selon release/* vs release-gia/*) ; publish-ios-testflight uploade | séparation build/publish ; mode `fastlane` dispo pour parité stricte |
| `mkdir ~/.appstoreconnect/private_keys` + `echo $ALTOOL_API_KEY \| base64 -d` + `xcrun altool --upload-app` | identique dans emerald-mobile-publish-testflight (mode altool), secrets `altool-api-key[-id]-<brand>`, `altool-issuer-id-<brand>` (champ `value`) | reproduction exacte, noms = ta Vault |
| `rm -rf ~/.appstoreconnect/private_keys` `condition: always()` | step cleanup `if: always()` | identique |

### Stage UpdateBuildVersion (update-version-template.yml)

| Step Azure | v5 (job update-build-version, macOS) | Justification |
|---|---|---|
| `dependsOn` variable selon branche (iOSAppDeploy+Publish… sur main/rc ; iOSBuildRelease+AndroidAppBuild sur release/*…) | `needs` sur tous les publish/build + `if: run_update_version && aucun ≠ failure` | un seul prédicat runtime équivaut aux 3 variantes compile-time d'Azure ; `run_update_version=true` sur main/rc/release/release-gia exactement comme Azure |
| `git config` + fetch/checkout branche + `gradle incrementVersion -PazurePassword` + `gradlew --stop` + `increment_build_number.sh` + push | `emerald-mobile-update-build-version` : mêmes étapes, message `[skip ci]` pour éviter la boucle | parité ; le `[skip ci]` remplace l'absence de re-trigger d'Azure |
| skip si `Build.Reason == Schedule` (applivery-archives) | sans objet | aucun trigger schedule défini dans le workflow consommateur |

---

## 3. publish-android-google-play : pourquoi il existe sans équivalent Azure

Tu as raison : **Azure n'avait pas ce stage**. Sur `release/*`, Azure buildait
l'AAB (`fastlane bundle`) puis le laissait **en artefact** — l'upload vers la
Play Console se faisait manuellement. v5 reproduit ce comportement par défaut :
`enableGooglePlay: false` → le job est **skipped**, l'AAB reste disponible en
artefact téléchargeable, rien ne change.

Le job existe parce que ton contexte initial listait « Google Play potentiel /
si activé » dans la table de décision. C'est l'automatisation future de l'étape
manuelle : `enableGooglePlay: true` + secret Vault `google-play`
(serviceAccountJson) + track `internal` et statut `draft` par défaut (aucune
mise en production accidentelle). Si tu n'en veux pas du tout, on peut le
retirer — il est inerte tant que l'input reste `false`.

---

## 4. emerald-android-signing : la logique keystore local / Vault

```mermaid
flowchart TD
    RC[resolve-context] --> D{buildConfiguration=Release<br/>ET env ≠ Qa ?}
    D -- non --> RK["signingMode = repo-keystore"]
    D -- oui --> PK["signingMode = androidProdSigningMode<br/>(défaut: vault-keystore)"]

    RK --> RK1["Action = no-op (sort immédiatement)"]
    RK1 --> RK2["Gradle lit keystore/debug.keystore,<br/>dgag-qa-key.keystore... (fichiers du repo)"]
    RK2 --> RK3["Passwords via ArkanaKeys :<br/>KeystoreDebugPassword, KeystoreDgagQaPassword,<br/>KeystoreTpicQaPassword (env + .env)"]

    PK --> VK1["vault-action lit keystore-brand-env :<br/>keystoreData(b64), keystorePassword,<br/>keyAlias, keyPassword"]
    VK1 --> VK2["Action décode le base64 vers<br/>matrix.prodKeystorePath<br/>(ex: androidApp/keystore/ajusto-release-key.keystore)<br/>= le chemin EN DUR de build.gradle.kts, écrasé"]
    VK2 --> VK3["Gradle signe : storeFile=fichier décodé,<br/>storePassword=getEnvValue(KeystoreDgagPassword)"]
    VK3 --> VK4["rm -f du keystore décodé — if: always()"]
```

Vérifications faites : l'action échoue explicitement si `keystoreData` ou un
des trois autres champs manque ; le fichier est `chmod 600` ; le cleanup
s'exécute même si le build échoue. **Bug corrigé pendant cette vérification** :
les noms d'env attendus par l'action (`KeystoreData`) ne correspondaient pas à
ceux exportés par vault-action (`keystoreData`) — le workflow passe maintenant
les overrides explicitement.

⚠️ Point restant : `build.gradle.kts` lit `getEnvValue("KeystoreDgagPassword")`
/ `KeystoreTpicPassword` pour les signingConfigs Prod. Ces deux variables
doivent donc être dans `androidArkanaSecretsLines` (elles étaient dans le
variable group Azure). Le champ `keystorePassword` du secret Vault sert au
pattern smd (gradle lit `uploadKeyStorePassword`) — pour ce projet, c'est la
variable Arkana qui compte.

---

## 5. ArkanaKeys : les 30 clés sont-elles toutes chargées ?

Oui — dans les jobs qui en ont besoin, selon le mode :

| Job | Azure injectait | v5 charge | Mode plat (ta Vault) |
|---|---|---|---|
| quality-shared | les 30 | opt-in `sharedQualityArkana` | ✅ supporté (corrigé) |
| quality-android | les 30 | ✅ toutes | 1 appel vault-action avec tes 30 lignes |
| quality-ios-reports | les ~45 iOS | ✅ toutes (`iosArkanaSecretsLines`) | idem |
| build-android | les 30 | ✅ toutes + quartet signing si Prod/Beta | idem |
| build-ios | les ~45 | ✅ toutes + MATCH_* | idem |
| update-build-version | les 30 | ✅ toutes | idem |
| publish-* | tokens seulement | tokens seulement | applivery/altool plats |

Mécanique en mode plat : tes 30 lignes → 1 step compose (préfixe
`concourse/<product>/`) → 1 appel vault-action (30 lectures) → chaque variable
masquée + exportée en env + écrite dans `androidApp/.env`. Si un secret
n'existe pas, vault-action échoue avec son nom dans le log — pas d'oubli
silencieux.

---

## 6. iosSonarProjectKey : nécessaire ?

Oui, si tu veux conserver le projet Sonar existant. Azure analysait sous la clé
`com.desjardins.appsmobilesdgag:ui-ad-digital-mobile-ios` — c'est là que vivent
l'historique, le new code period et les quality gates configurés. Sans l'input,
v5 retombe sur `com.desjardins:<component>-ios`, ce qui créerait un **nouveau**
projet Sonar vide (gates PR sans baseline, historique perdu). Donc : garder la
ligne tant que le projet Sonar n'est pas renommé.

---

## 7. GIT_PAT : les 3 cas d'usage

| Cas | Pourquoi github.token ne suffit pas |
|---|---|
| Checkout des repos Match (`codesigning-ios-*`) | github.token n'a accès qu'au repo courant |
| Push de update-build-version | un push fait avec github.token ne redéclenche aucun workflow et peut être bloqué par les branch protections |
| Submodule `DGAG-Ajusto-Core` | seulement s'il migre sur GitHub ; tant qu'il est sur Azure DevOps, il faut un credential Azure (point de migration ouvert) |

Partout ailleurs : fallback `GIT_PAT || github.token` — l'absence du secret ne
casse que ces trois cas.
