# Emerald KMP Resolve Context

> Dossier : `.github/actions/emerald-kmp-resolve-context` · Version : **1.5.1**

**Rôle** : Le « cerveau » du pipeline : transforme la branche/événement en contrat d'exécution.

## Fonctionnement détaillé

1. Détermine `branch_type` depuis `ref-name`/`event-name` (feature, pr, main, rc, release, release-gia).
2. Applique la table de décision (parité Azure) : env (`Qa`/`Prod`/`Beta`), buildConfiguration (`Debug`/`Release`), distribution (`none`/`applivery`/`testflight*`).
3. Surcharge par `branch-rules-json` (partielle), puis par les overrides workflow_dispatch et `manual-distribution`.
4. Fabrique les MATRICES Android/iOS (jq) depuis `android-brands-config`/`ios-schemes-config` : variant Gradle, JDK 17/21, lanes, ipaName/matchRepo selon profileType, profils Vault (dont `signingVaultProfile` via `ios-match-secret-map` — noms Vault irréguliers).
5. Émet les flags de publication (`*_publish_*`) consommés par les `if` des jobs 40/42/43.

## Entrées

| Input | Défaut | Description |
|---|---|---|
| `event-name` | **requis** | Nom de l'événement GitHub. Exemple: `push`, `pull_request`, `workflow_dispatch`. |
| `ref-name` | **requis** | Nom de la branche/tag. Exemple: `main`, `rc/4.12`, `release/4.11`. |
| `enable-shared` | `true` | Active la qualité shared/Kore. Exemple: `true`. |
| `enable-android` | `true` | Active les jobs Android. Exemple: `true`. |
| `enable-ios` | `true` | Active les jobs iOS. Exemple: `true`. |
| `android-brands-config` | **requis** | JSON array décrivant chaque brand Android. Champs: brandKey (clé technique), brandName (préfixe variant Gradle), businessLabel (abréviation métier), prodKeystorePath (chemin du keystore écrasé en mode vault-keystore), apkPublishGlob (pattern de l'APK attendu par la lane applivery_deploy). Exemple (défaut): voir defaults du workflow ci-kmp. |
| `ios-schemes-config` | **requis** | JSON array décrivant chaque scheme iOS. Champs: brandKey, businessLabel, scheme (vrai scheme Xcode), ipaNameEnterprise, ipaNameStore, matchRepoEnterprise, matchRepoStore. Exemple: [{"brandKey":"dgag","businessLabel":"DGAG","scheme":"DesjardinsAssurances", ...}]. |
| `android-default-brand-key` | `dgag` | BrandKey utilisé pour le build de validation PR. Exemple: `dgag`. |
| `ios-default-scheme-key` | `dgag` | BrandKey du scheme utilisé pour la validation PR. Exemple: `dgag`. |
| `rc-env-name` | `Qa` | Environnement attribué aux branches rc/*. Exemple: `Qa` ou `Rc`. |
| `branch-rules-json` | `{}` | Règles de branches personnalisées (JSON). Clé = branch_type (feature\|pr\|main\|applivery-archives\|rc\|release\|release-gia), valeur = {"env","buildConfiguration","distribution","fullMatrix"} — champs optionnels, appliqués APRÈS les règles par défaut (surcharge partielle). '{}' = désactivé. |
| `enable-applivery` | `true` | Autorise la publication AppLivery (main, rc/*, applivery-archives). Exemple: `true`. |
| `enable-testflight` | `true` | Autorise la publication TestFlight (release/*, release-gia/*). Exemple: `true`. |
| `enable-google-play` | `false` | Autorise la publication Google Play (release/*, release-gia/*). Exemple: `false`. |
| `android-qa-artifact-format` | `apk` | Format d'artefact pour env Qa. Azure: `apk` (fastlane assemble). |
| `android-store-artifact-format` | `aab` | Format d'artefact pour Prod/Beta. Azure: `aab` (fastlane bundle). |
| `android-java-version-qa` | `21` | JDK pour les builds APK/Qa. Doit être >= 21 car le projet inclut `:build-logic:convention` compilé en JVM 21 (sourceCompatibility/ jvmTarget = 21) : tout build, même Qa, requiert un JDK 21. |
| `android-java-version-store` | `21` | JDK pour les builds AAB Prod/Beta. Azure: `21`. |
| `android-apk-lane` | `assemble` | Lane Fastlane APK. Exemple: `assemble`. |
| `android-aab-lane` | `bundle` | Lane Fastlane AAB. Exemple: `bundle`. |
| `android-prod-signing-mode` | `vault-keystore` | Mode de signature pour Prod/Beta: `vault-keystore` (keystore base64 décodé depuis Vault, pattern mobile-smd-android) ou `repo-keystore`. Debug/Qa utilisent toujours `repo-keystore`. |
| `android-env-flavor-map` | `{}` | JSON objet mappant un env logique vers le flavor Gradle réellement déclaré, pour le calcul du buildVariant. Exemple: `{"Beta":"Prod"}` si build.gradle.kts n'a que des flavors *Qa/*Prod (l'env reste Beta pour la publication/nommage, mais la tâche devient assembleDgagProdRelease). |
| `ios-validate-lane` | `validate_build` | Lane de validation PR. Azure: `validate_build`. |
| `ios-build-lane` | `validate_build` | Lane produisant l'IPA enterprise (contextes AppLivery). Exemple: `validate_build`. |
| `ios-store-build-lane` | `validate_build` | Lane produisant l'IPA appstore (release/*, release-gia/*) sans publier. Le publish TestFlight se fait ensuite via altool dans le job publish. Exemple: `validate_build` (avec PROFILE_TYPE=appstore). |
| `arkana-load-mode` | `full` | `full` (V1, tous les ArkanaKeys) ou `profile` (V2, par brand/env). |
| `android-arkana-full-profiles` | `android/arkana` | Profils Vault chargés en mode full pour Android. Exemple: `android/arkana`. |
| `android-arkana-profile-template` | `android/{brandKey}/{env}/arkana` | Template du profil Arkana Android en mode profile. Exemple: `android/{brandKey}/{env}/arkana`. |
| `android-signing-profile-template` | `android/{brandKey}/{env}/signing` | Template du profil Vault de signature Android (mode vault-keystore). Le profil doit exposer: keystoreData (base64), keystorePassword, keyAlias, keyPassword. Exemple: `android/{brandKey}/{env}/signing`. |
| `android-applivery-profile` | `android/applivery` | Profil Vault des tokens AppLivery Android (APP_LIVERY_API_TOKEN_DA/LP). Exemple: `android/applivery`. |
| `ios-arkana-full-profiles` | `ios/arkana` | Profils Vault chargés en mode full pour iOS. Exemple: `ios/arkana`. |
| `ios-arkana-profile-template` | `ios/{brandKey}/{env}/arkana` | Template du profil Arkana iOS en mode profile. Exemple: `ios/{brandKey}/{env}/arkana`. |
| `ios-signing-profile-template` | `ios/{brandKey}/{profileType}/match` | Template du profil Vault de signature iOS (Match), utilisé en FALLBACK si la clé n'est pas dans ios-match-secret-map. Placeholders {brandKey},{profileType}. |
| `ios-match-secret-map` | `{}` | Mapping EXPLICITE (JSON) du secret Vault Match par `{brandKey}-{profileType}`, pour les Vault aux noms irréguliers (où un template ne suffit pas). Prioritaire sur ios-signing-profile-template. Exemple: `{"dgag-enterprise":"match-password-dgag-ent","tpic-appstore":"match-password-lp-public"}`. Vide = on retombe sur le template. |
| `ios-applivery-profile` | `ios/applivery` | Profil Vault des tokens AppLivery iOS. Exemple: `ios/applivery`. |
| `ios-testflight-profile-template` | `ios/{brandKey}/testflight` | Template du profil Vault App Store Connect. Doit exposer: ALTOOL_API_KEY (base64 .p8), ALTOOL_API_KEY_ID, ALTOOL_ISSUER_ID. Exemple: `ios/{brandKey}/testflight`. |
| `manual-platform` | — | Filtre plateforme manuel: `all`, `shared`, `android`, `ios`. |
| `manual-android-brand` | — | BrandKey Android forcé ou `all`. Exemple: `tpic`. |
| `manual-ios-scheme` | — | BrandKey iOS forcé ou `all`. Exemple: `dgag`. |
| `manual-env-name` | — | Environnement forcé: `Qa`, `Prod`, `Beta`. |
| `manual-build-configuration` | — | Build configuration forcée: `Debug`, `Release`. |
| `manual-distribution` | — | Distribution forcée: `none`, `applivery`, `testflight`, `google-play`. |

## Sorties

| Output | Description |
|---|---|
| `branch-type` | pr \| main \| rc \| applivery-archives \| release \| release-gia \| feature \| manual |
| `env-name` | Qa \| Prod \| Beta (ou rc-env-name pour rc/*). |
| `build-configuration` | Debug \| Release. |
| `distribution` | none \| applivery \| testflight \| testflight-beta. |
| `shared-enabled` |  |
| `android-enabled` |  |
| `ios-enabled` |  |
| `android-matrix` | Matrix Android. Format: {"include":[{brandKey, brandName, buildVariant, ...}]}. |
| `ios-matrix` | Matrix iOS. Format: {"include":[{brandKey, scheme, configuration, ...}]}. |
| `android-publish-applivery` |  |
| `android-publish-google-play` |  |
| `ios-publish-applivery` |  |
| `ios-publish-testflight` |  |
| `run-update-version` | true si UpdateBuildVersion doit s'exécuter (parité Azure). |
| `android-applivery-profile` |  |
| `ios-applivery-profile` |  |

## Pièges / notes

JSON strict pour tous les inputs *Config/Map/Rules (sinon échec jq au job 02). La 1ʳᵉ entrée du config = brand/scheme par défaut des PR.

---
*Voir aussi : `workflows/v8.4/GUIDE-COMPLET.md` (vue d'ensemble pédagogique) et le catalogue `.github/actions/README.md`.*
