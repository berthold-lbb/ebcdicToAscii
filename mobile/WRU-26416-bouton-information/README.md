# WRU-26416 — Bouton d'information flottant sur l'accueil de connexion (Android)

Analyse du 23 octobre 2026, à partir de la copie locale reconstituée du dépôt et des captures des PR p1, p2 et p3. **Les sources applicatives ne sont pas modifiées.** Le code proposé est dans [src/](./src/), rangé dans l'arborescence réelle des packages ; il n'a été ni compilé ni exécuté.

**Lire dans cet ordre :**

1. [EXPLICATION-SIMPLE.md](./EXPLICATION-SIMPLE.md) : ce qui se passe, les diagrammes de séquence, comment le bouton arrive et s'anime.
2. [EXPLICATION-DU-CODE.md](./EXPLICATION-DU-CODE.md) : le code proposé expliqué bloc par bloc, avec ses numéros de ligne.
3. [PROPOSITION-FINALE.md](./PROPOSITION-FINALE.md) : la solution, le tableau de tous les fichiers, le code par fichier, les tests et les points ouverts.

Le fichier `WRU-26416-proposition-android-bouton-information.md`, à la racine du dépôt de travail, est une première version. Ce dossier la remplace.

## Le ticket en bref

Sur l'écran d'accueil déconnecté, un bouton d'information flottant :

- arrive en glissant depuis la droite après 1 s ;
- affiche d'abord « La connexion évolue / En savoir plus », puis se réduit à l'icône après 5 s, avec une transition douce ;
- au tap, ouvre la modale « Redirection vers un site Web » ;
- « Continuer vers le site » ouvre l'URL dans le navigateur externe ; « Annuler » revient à l'accueil, bouton toujours visible.

Analytics : `login_115` (clic sur le bouton), `login_047` (vue de la modale), `login_117` (continuer), `login_118` (annuler). Les deux marques (Desjardins et La Personnelle) et le FR/EN sont concernés.

## Décisions de Ken

| Sujet | Décision |
| --- | --- |
| Source de l'URL | La clé de messages dynamiques `faq_gia_new_connexion`, pas les 4 URL du ticket. |
| Libellé | « La connexion évolue » (clé `gia_login_information_title`). |
| Plateforme | Android seulement : le shared et iOS sont déjà faits dans les PR p1, p2 et p3. |
| Écran visé | `WelcomeActivity` (Login V2). `WelcomeLegacyActivity` est hors périmètre. |
| Icône | `ico_learn_more` laissée de côté pour l'instant : une icône provisoire est utilisée. |

## État

| Couche | État | Source |
| --- | --- | --- |
| Chargement et validation de l'URL, état, actions, réaction, analytics, Koin | Fait | Captures des PR p1 → p2 |
| Clés de texte `gia_login_information_*` (EN et FR) | Faites | Capture de `translations-kore.json`, branche p3 |
| Interface iOS | Faite | PR p3, non disponible sur le disque |
| Bouton, animation et modale sur Android | **À faire : objet de ce dossier** | Fichiers lus sur le disque |

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `EXPLICATION-SIMPLE.md` | Explication, diagrammes de séquence, animation pas à pas |
| `EXPLICATION-DU-CODE.md` | Explication du code, bloc par bloc, ligne par ligne |
| `PROPOSITION-FINALE.md` | Solution, fichiers concernés, code, tests, risques |
| `src/androidApp/src/main/java/ca/dgag/ajusto/gia/WelcomeView.kt` | `WelcomeView.kt` complet, version proposée (package `ca.dgag.ajusto.gia`) |
| `src/androidApp/src/main/java/ca/dgag/ajusto/authentification/welcome/WelcomeActivity.kt` | `WelcomeActivity.kt` complet, version proposée (package `ca.dgag.ajusto.authentification.welcome`) |
| `src/androidApp/src/main/java/ca/dgag/ajusto/views/modal/ShowExternalDSDDialogComposable.kt` | `ShowExternalDSDDialogComposable.kt` complet, version proposée (package `ca.dgag.ajusto.views.modal`) |
| `proposition/android.patch` | Diff des trois fichiers, à appliquer depuis la racine de `ad-digital-mobile-aio` |

Le diff a été vérifié en simulation sur la copie locale : `patch -p1 --dry-run < proposition/android.patch`.
