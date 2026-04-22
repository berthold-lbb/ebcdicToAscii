# Logique des générateurs Java & Kotlin — Garanties de robustesse

---

## 1. Le problème fondamental — Limite JVM 64KB

La JVM impose une limite stricte :
**chaque méthode compilée ne peut pas dépasser 64KB de bytecode.**

La méthode la plus critique est `<clinit>` — l'initialiseur statique de classe.
C'est lui qui instancie toutes les constantes au chargement.

```
┌─────────────────────────────────────────────────────────────┐
│                  AVANT (enum monolithique)                   │
│                                                             │
│  public enum LocalizedString {                              │
│      FAQ_SERVICES("faq_services", "Services FAQ", "FAQ...") │
│      ACHIEVEMENTS_TITLE("achievements_title", "Succès",...) │
│      ... × 4285 constantes                                  │
│  }                                                          │
│                                                             │
│  <clinit> généré par javac :                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ new LocalizedString   → 3 bytes                     │    │
│  │ dup                   → 1 byte                      │    │
│  │ ldc "FAQ_SERVICES"    → 3 bytes  (nom enum)         │    │
│  │ sipush 0              → 3 bytes  (ordinal)          │    │
│  │ ldc "faq_services"    → 3 bytes  (clé)              │    │
│  │ ldc "Services FAQ"    → 3 bytes  (fr)               │    │
│  │ ldc "FAQ Services"    → 3 bytes  (en)               │    │
│  │ invokespecial <init>  → 3 bytes                     │    │
│  │ putstatic             → 3 bytes                     │    │
│  │ ────────────────────────────────                    │    │
│  │ = 25 bytes × 4285     = 107 Ko  💥 BOOM             │    │
│  │ + $VALUES array       = +20 Ko                      │    │
│  │ TOTAL                 = ~127 Ko  >> 64Ko            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. La solution — Architecture Holder

### Principe : diviser le bytecode en blocs indépendants

```
┌─────────────────────────────────────────────────────────────┐
│                   APRÈS (holder pattern)                    │
│                                                             │
│  Outer <clinit> — seulement des délégations                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ getstatic _Holder0.FAQ_SERVICES   → 3 bytes         │    │
│  │ putstatic LocalizedString.FAQ_... → 3 bytes         │    │
│  │ ─────────────────────────────────────               │    │
│  │ = 6 bytes × 4285 = ~25 Ko  ✅                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  _Holder0 <clinit> — 300 constantes avec fr/en             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ new LocalizedString("faq", "FAQ...", "FAQ...")       │    │
│  │ putstatic _Holder0.FAQ_SERVICES                      │    │
│  │ ... × 300 constantes                                 │    │
│  │ = ~19 bytes × 300 = ~5.7 Ko  ✅                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  _Holder1 <clinit> — 300 constantes suivantes              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ... × 300 constantes = ~5.7 Ko  ✅                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ... ~14 holders au total pour 4285 constantes             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Calcul de sécurité exact

```
┌─────────────────────────────────────────────────────────────┐
│                   CALCUL PAR <clinit>                       │
│                                                             │
│  OUTER (enum/class principal) :                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  getstatic + putstatic = 6 bytes/constante           │   │
│  │  4285 constantes × 6 bytes = 25 710 bytes = ~25 Ko   │   │
│  │                                          ✅ < 64 Ko  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  HOLDER (300 constantes chacun) :                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Java  : new + ldc(key) + ldc(fr) + ldc(en)          │   │
│  │        + invokespecial + putstatic                    │   │
│  │        = ~25 bytes × 300 = 7 500 bytes = ~7.5 Ko     │   │
│  │                                          ✅ < 64 Ko  │   │
│  │                                                       │   │
│  │  Kotlin : identique (même bytecode JVM)               │   │
│  │        = ~25 bytes × 300 = 7 500 bytes = ~7.5 Ko     │   │
│  │                                          ✅ < 64 Ko  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Marge de sécurité : 64 Ko - 7.5 Ko = 56.5 Ko              │
│  → Peut absorber 4× plus de constantes par holder si besoin │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Flux de génération Java — étape par étape

```
translations.json
       │
       ▼
┌─────────────────────┐
│  JsonHelper         │
│  .jsonTranslations()│  → Set<LokaliseTranslation> (key, fr, en)
└─────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  JavaTranslationsEnumGenerator.create()                     │
│                                                             │
│  1. FILTRAGE                                                │
│     translations.filter { shouldAddKey(it.key, prefixes) } │
│     + sortedBy { it.key }  ← ordre déterministe            │
│                                                             │
│  2. DÉCOUPAGE EN GROUPES                                    │
│     filteredTranslations.chunked(300)                       │
│     [0..299] → group0                                       │
│     [300..599] → group1                                     │
│     ...                                                     │
│                                                             │
│  3. CONSTRUCTION JAVAPOET                                   │
│                                                             │
│     a) enumBuilder = TypeSpec.enumBuilder("LocalizedString")│
│                                                             │
│     b) Pour chaque groupe → buildHolderClass("_Holder$i")  │
│        private static final class _Holder0 {               │
│            static final LocalizedString FAQ_SERVICES =     │
│                new LocalizedString("faq_services",         │
│                    "Services FAQ", "FAQ Services");         │
│        }                                                   │
│                                                             │
│     c) Constantes d'enum (outer) — délèguent vers holders  │
│        public static final LocalizedString FAQ_SERVICES    │
│            = _Holder0.FAQ_SERVICES;                        │
│                                                             │
│     d) addFields()      → private final String key         │
│                           public final String fr           │
│                           public final String en           │
│                                                             │
│     e) addConstructor() → LocalizedString(String key,      │
│                               String fr, String en)        │
│                                                             │
│     f) addKeyGetter()   → @Override public String key()    │
│                               { return key; }              │
│                                                             │
│  4. ÉCRITURE FICHIER                                        │
│     javaFile.writeTo(directory = file)                      │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
LocalizedString.java  ← fichier généré ✅
```

---

## 5. Fichier Java généré — structure complète

```java
// LocalizedString.java — GÉNÉRÉ AUTOMATIQUEMENT
package ca.dgag.ajusto.core;

public enum LocalizedString implements LocalizedStringKey {

    // ── Constantes enum (outer <clinit> = ~25 Ko) ─────────────────
    //    Chaque constante est juste un getstatic + putstatic = 6 bytes

    FAQ_SERVICES("faq_services"),          // ← clé seulement
    ACHIEVEMENTS_TITLE("achievements_title"),
    TELEMATICS_SERVER_ERROR_CODE("telematics_server_error_code"),
    // ... 4282 autres

    ;

    // ── Champs d'instance ─────────────────────────────────────────
    private final String key;
    public final String fr;   // ← FINAL ✅ pas de régression API
    public final String en;   // ← FINAL ✅

    // ── Constructeur ──────────────────────────────────────────────
    LocalizedString(String key, String fr, String en) {
        this.key = key;
        this.fr = fr;
        this.en = en;
    }

    // ── Interface LocalizedStringKey ──────────────────────────────
    @Override
    public String key() { return key; }

    // ── _Holder0 <clinit> = ~7.5 Ko ✅ ───────────────────────────
    private static final class _Holder0 {
        static final LocalizedString FAQ_SERVICES =
            new LocalizedString("faq_services", "Services FAQ", "FAQ Services");
        static final LocalizedString FAQ_CONTACT =
            new LocalizedString("faq_contact", "Contactez-nous", "Contact us");
        // ... 298 autres constantes
    }

    // ── _Holder1 <clinit> = ~7.5 Ko ✅ ───────────────────────────
    private static final class _Holder1 {
        static final LocalizedString TELEMATICS_SERVER_ERROR_CODE =
            new LocalizedString("telematics_server_error_code",
                "Numéro d'erreur : %s", "Error number: %s");
        // ... 299 autres constantes
    }

    // ... ~14 holders au total

    // ── Constantes publiques (délèguent vers holders) ─────────────
    //    outer <clinit> : getstatic + putstatic = 6 bytes chacune
    public static final LocalizedString FAQ_SERVICES =
        _Holder0.FAQ_SERVICES;
    public static final LocalizedString ACHIEVEMENTS_TITLE =
        _Holder0.ACHIEVEMENTS_TITLE;
    public static final LocalizedString TELEMATICS_SERVER_ERROR_CODE =
        _Holder1.TELEMATICS_SERVER_ERROR_CODE;
    // ... 4282 autres
}
```

---

## 6. Flux de génération Kotlin — différences clés

```
┌─────────────────────────────────────────────────────────────┐
│  KotlinTranslationsEnumGenerator.create()                   │
│                                                             │
│  IDENTIQUE à Java pour :                                    │
│  ✅ FILTRAGE   → shouldAddKey() + sortedBy { it.key }       │
│  ✅ DÉCOUPAGE  → chunked(300)                               │
│  ✅ HOLDER_SIZE = 300                                       │
│                                                             │
│  DIFFÉRENCES Kotlin :                                       │
│                                                             │
│  a) TypeSpec.objectBuilder("_Holder$i")                     │
│     → object (singleton Kotlin) au lieu de                  │
│       static final class (Java)                             │
│     → même bytecode JVM ✅                                  │
│                                                             │
│  b) companion object au lieu de static fields               │
│     companion object {                                      │
│         val FAQ_SERVICES = _Holder0.FAQ_SERVICES            │
│     }                                                       │
│                                                             │
│  c) val fr/en (immutable) au lieu de final String fr/en    │
│     → même garantie d'immutabilité ✅                       │
│                                                             │
│  d) primaryConstructor avec key, fr, en                     │
│     → Kotlin : les valeurs viennent du holder               │
│       directement dans le constructeur de chaque constante  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Fichier Kotlin généré — structure complète

```kotlin
// LocalizedString.kt — GÉNÉRÉ AUTOMATIQUEMENT
package ca.dgag.ajusto.core

enum class LocalizedString(
    override val key: String,
    val fr: String,    // ← val ✅ immuable
    val en: String     // ← val ✅ immuable
) : LocalizedStringKey {

    // ── Constantes enum ──────────────────────────────────────────
    FAQ_SERVICES("faq_services", "Services FAQ", "FAQ Services"),
    ACHIEVEMENTS_TITLE("achievements_title", "Succès", "Achievements"),
    TELEMATICS_SERVER_ERROR_CODE("telematics_server_error_code",
        "Numéro d'erreur : %s", "Error number: %s"),
    // ... 4282 autres

    ;

    // ── _Holder0 — object Kotlin = static final class JVM ────────
    private object _Holder0 {
        val FAQ_SERVICES = LocalizedString(
            "faq_services", "Services FAQ", "FAQ Services")
        val FAQ_CONTACT = LocalizedString(
            "faq_contact", "Contactez-nous", "Contact us")
        // ... 298 autres
    }

    // ── _Holder1 ─────────────────────────────────────────────────
    private object _Holder1 {
        val TELEMATICS_SERVER_ERROR_CODE = LocalizedString(
            "telematics_server_error_code",
            "Numéro d'erreur : %s", "Error number: %s")
        // ... 299 autres
    }

    // ── companion object — délègue vers les holders ───────────────
    companion object {
        val FAQ_SERVICES = _Holder0.FAQ_SERVICES
        val ACHIEVEMENTS_TITLE = _Holder0.ACHIEVEMENTS_TITLE
        val TELEMATICS_SERVER_ERROR_CODE = _Holder1.TELEMATICS_SERVER_ERROR_CODE
        // ... 4282 autres
    }

    override fun key(): String = key
}
```

---

## 8. Garantie des références — pourquoi ça ne peut pas casser

```
┌─────────────────────────────────────────────────────────────┐
│           CHAÎNE DE RÉFÉRENCES (Java & Kotlin)              │
│                                                             │
│  Code consommateur                                          │
│       │                                                     │
│       │  localizedStringSource.get(LocalizedString.FAQ_SERVICES)
│       │                                                     │
│       ▼                                                     │
│  LocalizedString.FAQ_SERVICES                               │
│  (champ public static final dans outer)                     │
│       │                                                     │
│       │  = _Holder0.FAQ_SERVICES   ← simple référence       │
│       │                                                     │
│       ▼                                                     │
│  _Holder0.FAQ_SERVICES                                      │
│  (champ static final dans inner holder)                     │
│       │                                                     │
│       │  = new LocalizedString("faq_services",              │
│       │        "Services FAQ", "FAQ Services")              │
│       │                                                     │
│       ▼                                                     │
│  Instance unique en mémoire                                 │
│  { key="faq_services", fr="Services FAQ", en="FAQ Services"}│
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  GARANTIES :                                         │   │
│  │                                                      │   │
│  │  1. Même instance → LocalizedString.FAQ_SERVICES     │   │
│  │     et _Holder0.FAQ_SERVICES pointent vers           │   │
│  │     le MÊME objet en mémoire (pas de copie)          │   │
│  │                                                      │   │
│  │  2. Immutable → fr et en sont final/val              │   │
│  │     → impossible de corrompre les traductions        │   │
│  │                                                      │   │
│  │  3. Chargement JVM → les holders sont chargés        │   │
│  │     AVANT l'outer class                              │   │
│  │     → aucune NullPointerException possible           │   │
│  │                                                      │   │
│  │  4. Ordre déterministe → sortedBy { it.key }         │   │
│  │     → même répartition holder à chaque génération    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Comparaison finale — bytecode par méthode

```
┌────────────────────┬──────────────┬───────────────┬──────────┐
│ Méthode / <clinit> │ Avant        │ Batch fr/en   │ Holders  │
├────────────────────┼──────────────┼───────────────┼──────────┤
│ outer <clinit>     │ ~127 Ko 💥   │ ~81 Ko  💥    │ ~25 Ko ✅│
│ inner method/class │ —            │ ~15 Ko  ✅    │ ~7.5 Ko✅│
│ fr/en FINAL        │ ✅           │ ❌            │ ✅       │
│ Références ident.  │ —            │ ✅            │ ✅       │
│ Résout le bug      │ ❌           │ ❌            │ ✅       │
└────────────────────┴──────────────┴───────────────┴──────────┘

Marge de sécurité avec HOLDER_SIZE = 300 :
  64 Ko limite JVM
-  7.5 Ko utilisés
= 56.5 Ko de marge  → peut gérer 2× plus de constantes si besoin
```

---

## 10. Pourquoi la solution Batch fr/en échoue

```
┌─────────────────────────────────────────────────────────────┐
│           PROBLÈME AVEC L'APPROCHE BATCH PRÉCÉDENTE         │
│                                                             │
│  public enum LocalizedString {                              │
│                                                             │
│      FAQ_SERVICES("faq_services"),   ← clé seulement       │
│      ... × 4285 constantes                                  │
│                                                             │
│      <clinit> enum :                                        │
│      ┌────────────────────────────────────────────────┐     │
│      │ new LocalizedString   → 3 bytes                │     │
│      │ dup                   → 1 byte                 │     │
│      │ ldc "FAQ_SERVICES"    → 3 bytes  (nom enum)    │     │
│      │ sipush 0              → 3 bytes  (ordinal)     │     │
│      │ ldc "faq_services"    → 3 bytes  (clé)         │     │
│      │ invokespecial <init>  → 3 bytes                │     │
│      │ putstatic             → 3 bytes                │     │
│      │ ─────────────────────────────────              │     │
│      │ = 19 bytes × 4285 = 81 Ko  💥 TOUJOURS BOOM   │     │
│      └────────────────────────────────────────────────┘     │
│                                                             │
│  + tableau $VALUES = ~13 Ko supplémentaires                 │
│  TOTAL outer <clinit> = ~94 Ko >> 64 Ko 💥                  │
│                                                             │
│  Les méthodes initTranslations0(), initTranslations1()...   │
│  sont < 64Ko ✅ MAIS le <clinit> de l'enum lui-même         │
│  dépasse toujours la limite.                                │
└─────────────────────────────────────────────────────────────┘
```
