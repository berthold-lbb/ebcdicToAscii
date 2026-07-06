# Emerald Gate Policy

> Dossier : `.github/actions/emerald-gate-policy` · Version : **non versionnée (legacy)**

**Rôle** : Politique centralisée des quality gates : décide `allow_build` / `allow_publish`.

## Fonctionnement détaillé

Agrège les résultats des jobs qualité (shared/android/iOS agrégé). Règles :
- un échec ⇒ build+publish bloqués (`status=failed`) ;
- un skip ⇒ `status=skipped`, puis `allow-build-when-quality-gate-skipped` / `allow-publish-when-quality-gate-skipped` décident ;
- tout vert ⇒ tout autorisé. Écrit aussi un step summary.

## Entrées

| Input | Défaut | Description |
|---|---|---|
| `enable-quality-gates` | `true` | Politique globale. `false` = tous les gates considérés skipped. Exemple: `true`. |
| `enable-shared-quality-gate` | `true` | Gate shared/Kore requis. Exemple: `true`. |
| `enable-android-quality-gate` | `true` | Gate Android requis. Exemple: `true`. |
| `enable-ios-quality-gate` | `true` | Gate iOS requis. Exemple: `true`. |
| `shared-result` | `skipped` | Résultat du job quality-shared: `success`, `failure`, `cancelled`, `skipped`. |
| `android-result` | `skipped` | Résultat du job quality-android. |
| `ios-result` | `skipped` | Résultat agrégé des jobs quality iOS (reports + sonar). |
| `allow-build-when-quality-gate-skipped` | `true` | Autorise le build si un gate requis est skipped. Exemple: `true`. |
| `allow-publish-when-quality-gate-skipped` | `false` | Autorise le publish si un gate requis est skipped. Recommandé: `false`. |

## Sorties

| Output | Description |
|---|---|
| `allow-build` | `true` si les builds peuvent démarrer. |
| `allow-publish` | `true` si les publications peuvent démarrer. |
| `status` | Synthèse: `success`, `skipped`, `failed`. |

## Pièges / notes

Le défaut `allow-publish-when-quality-gate-skipped: false` bloque la publication si un gate requis a été skippé (ex. plateforme désactivée) — c'est la cause n°1 des « pourquoi ça ne publie pas ».

---
*Voir aussi : `workflows/v8.4/GUIDE-COMPLET.md` (vue d'ensemble pédagogique) et le catalogue `.github/actions/README.md`.*
