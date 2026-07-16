# INPUTS — Référence complète (ci-kmp v8.6)

Ce document couvre : (1) les inputs **essentiels** pour démarrer, (2) le **guide des
JSON** (comment écrire des configs valides), (3) les inputs du **consumer**
`mobile-ci-kmp.yml`, (4) la **référence exhaustive** des inputs du workflow,
(5) la **comparaison step-par-step avec Azure** et la justification de l'ordre
qualité → build.

---

## 1. Les inputs ESSENTIELS (à régler pour toute nouvelle app)

| Input | Pourquoi c'est essentiel | Exemple |
|---|---|---|
| `productName` | Préfixe des chemins Vault `concourse/<product>/...`. Vide = custom property `product` du repo, sinon nom du repo. | `ad-digital-mobile` |
| `componentName` | Identité du composant (Sonar, artefacts). | `ui-ad-digital-mobile` |
| `macosRunnerLabel` | Sans lui, les jobs iOS **ne démarrent jamais** (validate-inputs bloque tôt). | `macos-15` |
| `androidBrandsConfig` / `iosSchemesConfig` | Les **matrices** : qui on builde. `androidBrandsConfig` porte désormais `keyAlias` (v8.6, non sensible, sorti de Vault). Voir §2. | — |
| `iosMatchSecretMap` | Noms Vault Match **irréguliers** → mapping explicite obligatoire. Voir §2. | — |
| `androidArkanaSecretsLines` / `iosArkanaSecretsLines` | Les clés Arkana lues de Vault (1 ligne = 1 secret). **Doivent matcher les `.arkana.yml`** de l'app. | — |
| `androidSigningSecretTemplate` | Template du secret **keystore** Prod/Beta (champ `value` = base64). Le password vit séparément dans `keystore-{brandKey}-password` (v8.6). | `keystore-{brandKey}-{env}` |
| `versionCodeOffset` | `versionCode = run_number + offset`. **≥ dernier code publié au store**, sinon rejet. | `'32100'` |
| `enableMacosOfflineWorkaround` | `true` tant que les runners macOS n'atteignent pas Artifactory. | `true` |
| `sharedSonarProjectKey` / `androidSonarProjectKey` / `iosSonarProjectKey` | Liens dashboards Sonar dans le summary (v8.3). | clés des `build.gradle.kts` |
| secrets `ROLEID` / `SECRETID` | Les **deux seuls** secrets GitHub (AppRole Vault). | — |

---

## 2. Guide des JSON — comment écrire des configs valides

⚠️ Règles générales : JSON **strict** (guillemets doubles, pas de virgule finale,
pas de commentaire) ; dans le YAML, encadrer de quotes simples `'{...}'` ou `>-`.
En cas de JSON invalide, `resolve-context` échoue au job 02 (`jq: invalid JSON`).

### 2.1 `androidBrandsConfig` (array) — `keyAlias` ajouté en v8.6

```json
[
  {"brandKey":"dgag","brandName":"Dgag","businessLabel":"DGAG",
   "prodKeystorePath":"androidApp/keystore/ajusto-release-key.keystore",
   "keyAlias":"ajustoreleasekey",
   "packageName":"ca.dgag.ajusto","appliveryTokenEnv":"APP_LIVERY_API_TOKEN_DA"},
  {"brandKey":"tpic","brandName":"Tpic","businessLabel":"LP",
   "prodKeystorePath":"androidApp/keystore/lapersonnelle-release-key.keystore",
   "keyAlias":"lapersonnellereleasekey",
   "packageName":"ca.lapersonnelle.ajusto","appliveryTokenEnv":"APP_LIVERY_API_TOKEN_LP"}
]
```
- `brandKey` : clé technique (filtre `manualAndroidBrand`, templates Vault `{brandKey}`).
- `brandName` : préfixe des variants Gradle (`DgagQaDebug` = brandName+env+config)
  **et** des variables Gradle de signature (`Keystore<brandName>File`, v8.6).
- `prodKeystorePath` : où décoder le keystore Vault en mode `vault-keystore` —
  sert désormais à **nommer** le fichier sous `$RUNNER_TEMP` (chemin absolu,
  v8.6), n'a plus besoin d'égaler exactement le `storeFile` du repo.
- `keyAlias` (**v8.6**) : alias de signature, fourni en clair ici (config des
  marques, pas Vault) — passé à `emerald-android-signing` via `key-alias-literal`.
- La **1ʳᵉ entrée** est le brand par défaut des PR (matrice restreinte).

### 2.2 `iosSchemesConfig` (array)

```json
[
  {"brandKey":"dgag","businessLabel":"DGAG","scheme":"DesjardinsAssurances",
   "ipaNameEnterprise":"com.ent.dgaginno.desjardins.assurances.ipa",
   "ipaNameStore":"com.desjardins.ajusto.ipa",
   "matchRepoEnterprise":"Desjardins/mobile-codesigning-ios-enterprise-dgag",
   "matchRepoStore":"Desjardins/mobile-codesigning-ios-public-desjardins"},
  {"brandKey":"tpic","businessLabel":"LP","scheme":"LaPersonnelle",
   "ipaNameEnterprise":"com.ent.dgaginno.tpic.ipa",
   "ipaNameStore":"com.lapersonnelle.ajusto.ipa",
   "matchRepoEnterprise":"Desjardins/mobile-codesigning-ios-enterprise-dgag",
   "matchRepoStore":"Desjardins/mobile-codesigning-ios-public-lapersonnelle"}
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

`branch_type` alimente aussi le calcul de **`test-run`** (v8.6, non
configurable via JSON) passé à `emerald-mobile-publish-applivery` : `true` si
`manual`/`pr`/`feature`, `false` sinon (voir §4).

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
- ⚠️ Ne pas confondre avec le keystore de signature Prod/Beta (v8.6) : celui-là
  n'est **plus** dans ces lignes Arkana — il est lu directement par
  `emerald-android-signing` via `androidSigningSecretTemplate` (keystore) +
  `keystore-{brandKey}-password` (password), séparément de `androidArkanaSecretsLines`.

---

## 3. Le consumer `mobile-ci-kmp.yml` — ce qu'il fournit

| Bloc consumer | Rôle |
|---|---|
| `on: pull_request` (types + `labeled`) | CI de PR (le mécanisme de label de publication a été retiré en v8.4 — publication de test = dispatch uniquement). |
| `on: push` (main, rc/**, release/**, release-gia/**, applivery-archives) | Déclencheurs publiants selon la branche. |
| `on: workflow_dispatch` (platform, androidBrand, iosScheme, distribution, dryRun) | Run manuel ciblé ; `dryRun` = publication simulée ; classe la branche en `branch_type=manual` → `test-run=true` côté publish AppLivery. |
| `permissions: contents: write, actions: read, checks: write` | Minimum requis (artefacts, checks). |
| `uses: ...v8.6/ci-kmp.yml@v8.6` | Épinglage de version — rollback en 1 ligne. |
| `with:` | Tous les inputs ci-dessus (§1/§2 + référence §4). |
| `secrets: ROLEID / SECRETID` | Credentials AppRole Vault — les seuls secrets GitHub. |
| `manualPlatform/Brand/Scheme/Distribution` | Relais des choix dispatch/label vers resolve-context. |

---

## 4. Référence des inputs du workflow — changements v8.6

Les inputs suivants ont changé de comportement ou de valeur par défaut en v8.6
(le reste de la référence exhaustive est stable depuis v8.3, voir historique
dans `CHANGELOG.md`) :

| Input (workflow) | Type | Défaut | Changement v8.6 |
|---|---|---|---|
| `androidBrandsConfig` | string (JSON) | voir §2.1 | champ **`keyAlias` ajouté** par entrée (config des marques, plus lu depuis Vault) |
| `androidSigningSecretTemplate` | string | `keystore-{brandKey}-{env}` | description mise à jour : ce template ne porte plus que le **keystore** (champ `value` = base64) ; le password est lu séparément (`keystore-{brandKey}-password`, indépendant de l'env) |

Inputs de l'action `emerald-android-signing` (composite, référencée par
`ci-kmp.yml`) — nouveaux en v8.6 :

| Input (action) | Défaut | Rôle |
|---|---|---|
| `key-alias-literal` | `""` | Alias fourni en clair (prioritaire sur `key-alias-env`) — vient de `matrix.keyAlias`. |
| `gradle-keystore-file-env` | `""` | Nom de la variable exportée dans `$GITHUB_ENV` avec le chemin absolu du keystore décodé (ex. `Keystore<Brand>File`). |
| `gradle-store-password-env` | `""` | Idem pour le store password (`KeystoreStorePassword<Brand>`). |
| `gradle-key-alias-env` | `""` | Idem pour l'alias (`KeystoreAlias<Brand>`). |
| `gradle-key-password-env` | `""` | Idem pour le key password (`KeystoreKeyPassword<Brand>`). |

Inputs de l'action `emerald-mobile-publish-applivery` — nouveaux/modifiés en v8.6 :

| Input (action) | Défaut | Rôle |
|---|---|---|
| `test-run` | `"false"` | `true` sur runs de test (PR/manuel/feature, calculé par `ci-kmp.yml` depuis `branch_type`) → ajoute `test:true,run:<n>,ref:<branche>`. `false` (publications réelles) → tags strictement identiques à Azure. |
| `extra-tags` | `""` | **DÉPRÉCIÉ** — remplacé par `test-run`. Conservé pour compat, non alimenté par `ci-kmp.yml`. |

Référence exhaustive complète des ~102+ inputs : voir `INPUTS.md` de la v8.3
(base stable, non reproduite ici pour éviter la duplication) — seuls les
inputs listés ci-dessus ont changé entre v8.3 et v8.6.

---

## 5. Comparaison step-par-step avec Azure — et justification des choix

### 5.1 Correspondance des étapes

| Étape Azure (azure-pipelines.yml + templates) | Équivalent GHA v8.6 | Amélioration |
|---|---|---|
| Variables/paramètres dispersés dans les stages `${{ if }}` | Job 02 `resolve-context` (1 action, table de décision + matrices JSON) | Logique centralisée, testable, surchargée par `branchRulesJson` sans fork |
| Variable group `DGAG-Pipelines` | Vault AppRole (2 secrets GitHub au total) | Coffre unique audité, rotation centralisée |
| `DownloadSecureFile` (keystores) | Keystore base64 dans Vault → décodé sous `$RUNNER_TEMP` (chemin absolu, v8.6) → supprimé `if: always()` ; password et alias désormais séparés | Même garantie sans service propriétaire ; password indépendant de l'env, alias en config versionnée |
| `sudo gem install bundler` + `bundle install` (Ruby système, non gelé) | `ruby/setup-ruby` 3.2.5 + Bundler frozen + `Gemfile.lock` + cache gems (+ `Gemfile.publish` minimal iOS pour la publication, v8.6) | Builds reproductibles + plus rapides (cache) ; Gemfile de publication évite les gems natifs non précompilés Linux |
| Testing template (tests unitaires + Sonar par plateforme, stages séquentiels) | Jobs 10/11/12 **en parallèle** (shared / Android / iOS) | Latence réduite : 3 qualités simultanées |
| Sonar publish + quality gate implicite | Job 13 (scan iOS) + job 20 `gate-policy` (allow_build/allow_publish explicites) | Politique visible, options *skipped* configurables |
| Building templates (1 stage par brand, séquentiel) | Jobs 30/31 **matriciels** (1 job par brand/scheme, parallèles) | 2 brands = 2 builds simultanés ; ajout d'un brand = 1 entrée JSON |
| `UpdateBuildVersion` (incrementVersion + commit `[skip ci]`) | `versionCode = run_number + versionCodeOffset` (injection Gradle) | Plus de push CI, plus de boucle, reproductible |
| Publish AppLivery/TestFlight (relance des templates de build) | Jobs 40/42/43 **sans rebuild** (artefact du build publié tel quel) ; tags de test isolés via `test-run` (v8.6) | Binaire publié = binaire testé ; publication plus rapide ; zéro risque de tag de test sur un canal réel |
| Google Play | **Retiré (v8.2)** — AAB Prod en artefact | Décision produit, parité avec l'usage réel Azure |
| — (impossible sur Azure self-hosted équivalent) | Seal/unseal secrets + mirror Artifactory pour runners macOS isolés | Contrainte réseau absorbée, débranchable (`enableMacosOfflineWorkaround`) |
| Logs de stage bruts | Summary : liens Sonar, icônes, build number, artefacts + tableau des binaires AppLivery publiés (v8.6) | Observabilité du run en un écran |

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
5. **Signing** (keystore décodé + variables Gradle exportées juste avant le
   build, pas avant — v8.6 : chemin absolu `$RUNNER_TEMP`).
6. **Build** (Fastlane — lane `:bundle` pour l'AAB Store, v8.6).
7. **Cleanup `if: always()`** (keystore + .env supprimés même en échec).
