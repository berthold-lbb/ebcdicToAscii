# Analyse critique — ci-kmp v8.3

Analyse honnête : taille réelle vs Azure, pertinence de chaque step, pistes
d'amélioration, bilan avantages/inconvénients.

---

## 1. « 371 lignes Azure vs 1754 lignes GHA » — la comparaison corrigée

Le 371 ne compte que `azure-pipelines.yml`. Or Azure déportait sa logique dans
des **templates**, exactement comme nous la déportons dans des **actions** :

| | Azure (mesuré) | GHA v8.3 (mesuré) |
|---|---|---|
| Orchestrateur | `azure-pipelines.yml` : **373** | `ci-kmp.yml` : **1 754** |
| Logique déportée | templates : **1 451** | actions `emerald-*` : **2 918** (dont ~350 mortes à `git rm`) |
| **Total** | **1 824** | **≈ 4 300** (après git rm) |

Le vrai écart est donc ~×2,3 — pas ×4,7. Et il s'explique poste par poste :

| Poste de « surplus » GHA | ≈ lignes | Azure l'avait-il ? |
|---|---|---|
| **Isolement réseau macOS** (seal job + unseal + mirror + setup-mirror + câblage) | ~450 | **Non nécessaire** : les agents Azure étaient sur le réseau interne. C'est un coût d'infra, pas de design. |
| **Bootstrap SDK Android en shell** (setup-android-env) | ~200 | **Non nécessaire** : images d'agents avec SDK préinstallé. Idem. |
| **102 inputs documentés** (descriptions = doc embarquée) | ~600 | Azure : ~25 paramètres quasi non documentés. C'est de la **doc**, pas de la logique. |
| **Commentaires** (209 dans ci-kmp.yml) | ~210 | Azure : ~40. Choix délibéré (maintenabilité). |
| Généricité (brands/schemes JSON, branchRulesJson, flags) | ~150 | Non : templates mono-app, valeurs en dur. |

**Conclusion** : à périmètre équivalent (mêmes contraintes d'infra, sans doc
inline), la logique « utile » est de taille comparable à Azure. Le surplus est
à ~60 % du **contournement d'infra** (macOS isolé + runners nus) et à ~40 % de
la **documentation embarquée et de la généricité** — deux choses qu'Azure n'offrait pas.

### Le bash embarqué : 217 lignes seulement dans le workflow

Mesuré : **217 lignes de `run:`** dans `ci-kmp.yml` (12 % du fichier), concentrées
dans : seal (61 — imposé par l'isolement macOS), summary (41 — observabilité),
compose-arkana (~20×4 jobs), validate (25), versionCode (7). Le reste du bash vit
dans les **actions versionnées** — l'équivalent exact des `script:` des templates
Azure (qui en avait autant : voir `update-version-template.yml`, 198 lignes dont
~120 de bash).

---

## 2. Pertinence de chaque job/step (revue complète)

| Job / step | Pertinence | Verdict |
|---|---|---|
| 01 `evaluate` | Résout productName/component/branch (3 fallbacks). Sans lui, chaque job redéclarerait la logique. | ✅ garder |
| 02 `resolve-context` | Cerveau branche→env/dist + matrices. Remplace ~15 blocs `${{ if }}` Azure. | ✅ garder |
| 03 `validate-inputs` | Échec **tôt et lisible** (vaultUrl, macosRunnerLabel…) au lieu d'échecs silencieux (jobs iOS qui ne partent jamais). 25 lignes de bash rentables. | ✅ garder |
| 04 `seal-ios-secrets` | Imposé par l'isolement macOS. Bash le plus gros (61 l.) mais testé et borné. | ✅ tant que l'infra n'ouvre pas ; visé par `enableMacosOfflineWorkaround` (déjà débranchable en partie — voir §3.1) |
| 05 `mirror-internal-deps` | Idem — débranchable par flag. | ✅ idem |
| 10/11 quality shared/android | Parité Azure testing-templates, en parallèle. | ✅ ; fusion possible en matrix (§3.3) |
| 12 quality-iOS + 13 sonar-iOS | Split imposé : tests sur macOS, scan Sonar sur Linux (le scanner a besoin d'Artifactory → injoignable de macOS). Azure avait le même split (templates testing vs sonar). | ✅ garder |
| 20 `gates` | Politique explicite allow_build/allow_publish. Azure : implicite/éparpillé. | ✅ garder |
| 30/31 builds matriciels | 1 job/brand en parallèle ; versionCode injecté (7 l. bash, remplace 198 l. du template Azure UpdateBuildVersion). | ✅ garder |
| 40/42/43 publish sans rebuild | Le binaire publié = le binaire testé. Azure **rebuildait** pour publier. | ✅ garder |
| 60 `summary` | 41 l. pour un tableau de bord avec liens Sonar/artefacts. | ✅ garder |
| `Compose flat ArkanaKeys map` (×4 jobs) | Duplication réelle (~80 l. au total). | ⚠️ candidat n°1 à extraction (§3.2) |
| Imports `vault-action` (×8 blocs similaires) | Verbeux mais **déclaratifs et visibles** (on voit quel job lit quel secret — atout d'audit). | ⚠️ extraction possible, au prix de l'auditabilité |

---

## 3. Pistes d'amélioration (backlog v9, par retour/effort)

1. **`git rm` des 3 actions mortes** (diag-network, update-build-version,
   publish-google-play) : −~350 lignes, zéro risque. *(commande dans CHANGELOG v8.2)*
2. **Extraire `emerald-mobile-compose-arkana`** (le bash dupliqué ×4) :
   −~60 lignes nettes, +cohérence. Risque faible.
3. **Fusionner quality-shared/quality-android en un job matriciel** (2 entrées) :
   −~100 lignes. Coût : noms de jobs moins parlants dans l'UI. À débattre.
4. **Retirer `ci-kmp.local.yml`** une fois la recette stabilisée sur tags :
   −1 726 lignes (le plus gros poste !). C'était un outil de mise au point ;
   sa duplication est une dette assumée mais temporaire.
5. **Alléger les descriptions d'inputs** en pointant `INPUTS.md` : −~300 lignes.
   Coût : perte de l'autodocumentation dans l'UI GitHub. Non recommandé.
6. **Le jour où l'infra ouvre macOS→réseau interne** : `enableMacosOfflineWorkaround:
   false`, puis suppression physique de seal/unseal/mirror en v10 : −~450 lignes.

Recommandation : faire 1+2 (sans risque) dans une v8.4 quand tu veux ; 3/4 à
décider en équipe ; 6 dépend de l'infra.

---

## 4. Bilan — avantages / inconvénients

### Avantages (mesurables)
1. **Parallélisme** : 3 qualités simultanées, builds matriciels simultanés ;
   Azure séquençait les stages par brand.
2. **Publication sans rebuild** (binaire publié = binaire testé) ; Azure rebuildait.
3. **2 secrets GitHub** (AppRole) vs variable group + secure files + tokens implicites.
4. **Plus de commit de version** (run_number+offset) : −1 job, −risques push/boucle.
5. **Versionné/multi-apps** : consumer ~15 lignes minimales, rollback `@vX.Y`.
6. **Portable** : branchRulesJson + flags — réutilisable sans fork.
7. **Testable** : publication d'essai depuis PR (label/dispatch+dryRun), variante locale.
8. **Observable** : summary avec liens Sonar, gates explicites, versions/changelogs partout.

### Inconvénients (assumés, avec mitigation)
1. **Volume** : ~×2,3 vs Azure à périmètre réel — dû à l'infra (60 %) et à la doc
   (40 %). Mitigation : backlog §3 (−~2 200 lignes possibles à terme).
2. **Mirror à entretenir** : nouvelle lib interne (ou « publique » republiée en
   interne) = 1 ligne dans `paths`. Disparaît si l'infra ouvre l'accès.
3. **Gate global unique** : le build Android attend la qualité iOS. Mitigation
   possible : gates par plateforme (complexité ++).
4. **Coupling aux conventions Vault Desjardins** (noms de secrets plats,
   iosMatchSecretMap) — paramétré, mais la config par défaut est maison.
5. **bash 3.2 macOS** : contrainte permanente sur tout script côté iOS (pas de
   `declare -A`, etc.) — documentée dans les actions.
6. **Duplication `.local`** : dette temporaire de mise au point (§3.4).

---

## 5. Parité du principe de branches : preuve exécutable

Le fichier `consumer-example/v8.3/test-branch-rules.yml` est un **workflow de
test** (workflow_dispatch) qui exécute `emerald-kmp-resolve-context` sur chaque
type de branche et **asserte** la parité avec Azure :

| Branche simulée | Attendu (= comportement Azure) |
|---|---|
| `feature/xyz` (push) | env `Qa` · `Debug` · distribution `none` (CI seule) |
| PR vers main | env `Qa` · `Debug` · `none` (CI seule) |
| `main` | env `Qa` · `Release` · `applivery` |
| `applivery-archives` | env `Qa` · `Release` · `applivery` |
| `rc/4.12` | env `Qa` (rcEnvName) · `Release` · `applivery` |
| `release/4.12` | env `Prod` · `Release` · `testflight` |
| `release-gia/4.12` | env `Beta` · `Release` · `testflight-beta` |

Chaque écart fait échouer le job → toute régression du principe de branches est
détectée avant de tagger une nouvelle version.
