# Emerald Android Signing

> Dossier : `.github/actions/emerald-android-signing` · Version : **non versionnée (legacy)**

**Rôle** : Prépare la signature Android selon le mode : keystores du repo (Qa) ou keystore Vault décodé (Prod/Beta).

## Fonctionnement détaillé

- `repo-keystore` : rien à décoder (keystores commités), les mots de passe viennent de Vault via les ArkanaKeys.
- `vault-keystore` : lit `keystoreData` (base64, multi-champs Vault) → décode vers `keystore-target-path` (doit égaler le `storeFile` de build.gradle.kts) → chmod 600 → expose `decoded-keystore-path` pour le cleanup `if: always()` du job.

## Entrées

| Input | Défaut | Description |
|---|---|---|
| `signing-mode` | **requis** | `repo-keystore` ou `vault-keystore`. |
| `keystore-target-path` | — | Chemin (relatif au repo) où écrire le keystore décodé en mode vault-keystore. Doit correspondre au storeFile du build.gradle.kts. Exemple: `androidApp/keystore/ajusto-release-key.keystore`. |
| `keystore-data-env` | `KeystoreData` | Nom de la variable d'env contenant le keystore base64 (chargée depuis Vault). Exemple: `KeystoreData`. |
| `keystore-password-env` | `KeystorePassword` | Nom de la variable d'env du store password. Exemple: `KeystorePassword`. |
| `key-alias-env` | `KeyAlias` | Nom de la variable d'env de l'alias. Exemple: `KeyAlias`. |
| `key-password-env` | `KeyPassword` | Nom de la variable d'env du key password. Exemple: `KeyPassword`. |

## Sorties

| Output | Description |
|---|---|
| `decoded-keystore-path` | Chemin du keystore décodé (vide en mode repo-keystore). À supprimer en fin de job. |

## Pièges / notes

Le secret Vault Prod est MULTI-CHAMPS (keystoreData/keystorePassword/keyAlias/keyPassword) — différent des secrets plats de mots de passe Qa.

---
*Voir aussi : `workflows/v8.4/GUIDE-COMPLET.md` (vue d'ensemble pédagogique) et le catalogue `.github/actions/README.md`.*
