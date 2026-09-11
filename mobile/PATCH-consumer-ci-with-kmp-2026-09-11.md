# Patch consumer — `ad-digital-mobile-aio/.github/workflows/ci-with-kmp.yml`

> Rédigé le 2026-09-11. La copie de ce fichier présente dans le dossier connecté
> diverge de celle de l'IDE (décalage de numéros de ligne constaté) : **appliquer
> les blocs ci-dessous un par un**, ne pas remplacer le fichier entier.
>
> Côté dépôt de workflows, tout est déjà écrit :
> `emerald-kmp-resolve-context` 1.7.0 (+ snapshot `v1.7.0/`) et `v8.8/ci-kmp.yml`
> (+ `.local.yml`).

---

## Bloc 1 — Marquage Beta TestFlight (`x.y.9999`)

**Où** : juste après `enableCocoaPodsCache: false`, avant `# Transition Azure Artifacts`.

```yaml
            # [2026-09-11] Lane de build du canal store (TestFlight — Prod ET Beta).
            # Pourquoi testflight_deploy et non le défaut validate_build : seule
            # testflight_deploy applique le marquage attendu sur les builds Beta —
            # CFBundleShortVersionString x.y.9999 + ConfigurationType=BETA — et force
            # le bundle id via update_app_identifier. Depuis le correctif
            # match_profile_prefix du Fastfile, les deux lanes signent de façon
            # identique en appstore : le marquage est la seule différence restante.
            # testflight_deploy ne fait QUE builder (aucun upload_to_testflight),
            # donc iosTestflightPublishMode: altool reste bien le publieur.
            iosStoreBuildLane: testflight_deploy
```

---

## Bloc 2 — Signature Android Beta = signature Prod

**Où** : à côté des autres réglages Android (près de `androidJdkVersionQuality`).

```yaml
            # [2026-09-11] La Beta n'a pas de keystore propre en Vault : le job 30
            # Beta échouait sur `concourse/ad-digital-mobile/keystore-dgag-beta-file
            # … not found`. Elle est donc signée avec le keystore de Prod. Une seule
            # source de vérité en Vault (keystore-<brand>-prod-*) : pas de copie à
            # maintenir, donc pas de dérive à la prochaine rotation de la signature.
            # N'affecte QUE le profil de signature — envName reste Beta et le
            # buildVariant reste DgagBetaRelease.
            androidSigningEnvMap: '{"Beta":"Prod"}'
```

---

## Bloc 3 — Prod / Beta déclenchables en `workflow_dispatch`

### 3a — le menu

**Remplacer** le bloc `distribution:` de `workflow_dispatch.inputs` :

```yaml
            distribution:
                description: 'Canal de distribution (none = build seul, sans publication).'
                type: choice
                default: none
                # [2026-09-11] 'testflight' scindé en Prod / Beta. GitHub n'a pas de
                # couple libellé/valeur pour les `choice` : l'option affichée EST la
                # valeur, d'où le remappage dans manualDistribution ci-dessous.
                options: [ none, applivery, 'Prod (TestFlight)', 'Beta (TestFlight-beta)' ]
```

### 3b — le remappage

**Remplacer** la ligne `manualDistribution:` du bloc `with:` :

```yaml
            # [2026-09-11] Remappage libellé du menu -> valeur attendue par
            # resolve-context 1.7.0. Une valeur non reconnue y fait désormais
            # échouer l'action (avant : ignorée en silence, aucune publication).
            manualDistribution: >-
                ${{ github.event_name != 'workflow_dispatch' && ''
                 || inputs.distribution == 'Prod (TestFlight)' && 'testflight'
                 || inputs.distribution == 'Beta (TestFlight-beta)' && 'testflight-beta'
                 || inputs.distribution }}
```

---

## Bloc 4 — Pointer sur la nouvelle version

Le consumer appelle aujourd'hui :

```yaml
        uses: Desjardins/mobile-dgag-gha-workflows-kmp/.github/workflows/ci-kmp.yml@main
```

Les blocs 2 et 3 **exigent** `resolve-context >= 1.7.0` et le `ci-kmp.yml` 8.8.0.
Deux options selon la convention retenue :

| Convention | `uses:` |
|---|---|
| Racine vivante (actuelle) | inchangé — mais il faut porter les modifs de `v8.8/ci-kmp.yml` dans le `ci-kmp.yml` de la racine de `main`, et celles de `emerald-kmp-resolve-context/action.yml` (déjà faites à la racine du dossier connecté) |
| Version épinglée | `…/.github/workflows/v8.8/ci-kmp.yml@v8.8` (+ tag `v8.8` sur le dépôt de workflows) |

⚠️ Sans cette étape, les blocs 2 et 3 sont inertes : `ci-kmp.yml@main` ne connaît
ni l'input `androidSigningEnvMap`, ni la valeur `testflight-beta`.

---

## Ordre de déploiement conseillé

1. **Bloc 1 seul** → relancer `release-gia/*` → vérifier `fastlane testflight_deploy`
   dans le job 31, puis la build `x.y.9999` dans App Store Connect.
   (Ce bloc ne dépend d'aucune modif du dépôt de workflows.)
2. **Blocs 4 + 2** → le job 30 Beta doit passer l'étape « Import secrets from Vault ».
   Le step summary de `02 - Resolve context` affiche désormais
   `keystore env: Prod` — c'est la confirmation que le remappage a pris.
   Si l'erreur devient `keystore-dgag-**prod**-file … not found`, la convention de
   nommage Vault est différente : on bascule sur une map explicite
   `{brandKey}-{env}` (variante B), l'input est prêt à être doublé.
3. **Bloc 3** → tester un `workflow_dispatch` avec « Beta (TestFlight-beta) ».
