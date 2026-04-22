package generator

import model.LokaliseTranslation
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

class KotlinTranslationsEnumGeneratorTest {

    @TempDir
    lateinit var tempDir: File

    private val enumPackageName = "ca.dgag.ajusto.core"
    private val enumName = "LocalizedString"
    private val enumInterface = listOf("com.mirego.circumflex.LocalizedStringKey")
    private val defaultPrefixes = listOf("faq", "achievements", "telematics")

    private val singleTranslation = setOf(
        LokaliseTranslation(
            key = "faq_services",
            fr = "Services FAQ",
            en = "FAQ Services"
        )
    )

    private val multipleTranslations = setOf(
        LokaliseTranslation(key = "faq_services",        fr = "Services FAQ",       en = "FAQ Services"),
        LokaliseTranslation(key = "faq_contact",         fr = "Contactez-nous",     en = "Contact us"),
        LokaliseTranslation(key = "achievements_title",  fr = "Succès",             en = "Achievements"),
        LokaliseTranslation(key = "telematics_error",    fr = "Erreur télématique", en = "Telematics error"),
        LokaliseTranslation(key = "telematics.details",  fr = "Détails",            en = "Details")
    )

    private val specialCharTranslations = setOf(
        LokaliseTranslation(
            key = "faq_special",
            fr = "Erreur : \"test\" \$valeur",
            en = "Error: \"test\" \$value"
        )
    )

    private fun generate(
        translations: Set<LokaliseTranslation> = multipleTranslations,
        prefixes: List<String> = defaultPrefixes
    ) {
        KotlinTranslationsEnumGenerator.create(
            translations = translations,
            enumPackageName = enumPackageName,
            enumName = enumName,
            includedPrefixes = prefixes,
            enumInterface = enumInterface,
            file = tempDir
        )
    }

    private fun content(): String {
        val file = File(tempDir, "${enumPackageName.replace('.', '/')}/$enumName.kt")
        assertTrue(file.exists(), "Fichier non généré : ${file.path}")
        return file.readText()
    }

    // ── Fichier & structure ────────────────────────────────────────────────────

    @Test
    fun `devrait créer le fichier Kotlin dans le bon répertoire`() {
        generate()
        val file = File(tempDir, "${enumPackageName.replace('.', '/')}/$enumName.kt")
        assertTrue(file.exists())
    }

    @Test
    fun `devrait générer une enum avec le bon nom`() {
        generate()
        assertTrue(content().contains("enum class $enumName"))
    }

    @Test
    fun `devrait implémenter l'interface LocalizedStringKey`() {
        generate()
        assertTrue(content().contains("LocalizedStringKey"))
    }

    @Test
    fun `devrait générer le bon package`() {
        generate()
        assertTrue(content().contains("package $enumPackageName"))
    }

    // ── Constantes enum ────────────────────────────────────────────────────────

    @Test
    fun `devrait générer les constantes filtrées par préfixe`() {
        generate()
        val c = content()
        assertTrue(c.contains("FAQ_SERVICES"))
        assertTrue(c.contains("FAQ_CONTACT"))
        assertTrue(c.contains("ACHIEVEMENTS_TITLE"))
        assertTrue(c.contains("TELEMATICS_ERROR"))
    }

    @Test
    fun `devrait exclure les clés ne correspondant à aucun préfixe`() {
        val translations = setOf(
            LokaliseTranslation(key = "faq_services", fr = "FAQ", en = "FAQ"),
            LokaliseTranslation(key = "other_key", fr = "Autre", en = "Other")
        )
        generate(translations, listOf("faq"))
        val c = content()
        assertTrue(c.contains("FAQ_SERVICES"))
        assertFalse(c.contains("OTHER_KEY"))
    }

    @Test
    fun `devrait remplacer les points par des underscores dans les clés`() {
        generate()
        val c = content()
        assertTrue(c.contains("TELEMATICS_DETAILS"))
        assertFalse(c.contains("TELEMATICS.DETAILS"))
    }

    // ── Constructeur primaire (1 seul paramètre clé) ──────────────────────────

    @Test
    fun `devrait générer un constructeur primaire ne prenant que la clé`() {
        generate()
        val c = content()
        // Le constructeur primaire de l'enum ne doit avoir que key
        assertTrue(c.contains("key: String"))
    }

    @Test
    fun `les constantes d'enum doivent appeler le constructeur avec la clé seulement`() {
        generate(singleTranslation, listOf("faq"))
        val c = content()
        // FAQ_SERVICES("faq_services") sans fr/en
        assertTrue(c.contains("FAQ_SERVICES(\"faq_services\")") ||
                   c.contains("FAQ_SERVICES(\n    \"faq_services\"\n  )") ||
                   Regex("FAQ_SERVICES\\(\\s*\"faq_services\"\\s*\\)").containsMatchIn(c))
    }

    // ── Propriétés key, fr, en ─────────────────────────────────────────────────

    @Test
    fun `devrait générer les propriétés key, fr, en publiques`() {
        generate()
        val c = content()
        assertTrue(c.contains("val key"))
        assertTrue(c.contains("val fr"))
        assertTrue(c.contains("val en"))
    }

    @Test
    fun `key doit être override`() {
        generate()
        assertTrue(content().contains("override"))
    }

    @Test
    fun `fr et en doivent être initialisés via lookup Map`() {
        generate()
        val c = content()
        assertTrue(c.contains("Translations.FR[key]"))
        assertTrue(c.contains("Translations.EN[key]"))
    }

    @Test
    fun `devrait générer la fonction key() avec override`() {
        generate()
        val c = content()
        assertTrue(c.contains("fun key()"))
        assertTrue(c.contains("return key"))
    }

    // ── Holder object Translations ────────────────────────────────────────────

    @Test
    fun `devrait générer l'object Translations privé`() {
        generate()
        val c = content()
        assertTrue(c.contains("private object Translations"))
    }

    @Test
    fun `devrait générer les propriétés FR et EN dans le holder`() {
        generate()
        val c = content()
        assertTrue(c.contains("val FR"))
        assertTrue(c.contains("val EN"))
    }

    @Test
    fun `devrait générer au moins une fonction init`() {
        generate()
        assertTrue(content().contains("private fun init0"))
    }

    @Test
    fun `devrait générer plusieurs fonctions init pour plus de 200 traductions`() {
        val big = (1..250).map { i ->
            LokaliseTranslation(key = "faq_$i", fr = "FR$i", en = "EN$i")
        }.toSet()
        generate(big, listOf("faq"))
        val c = content()
        assertTrue(c.contains("init0"))
        assertTrue(c.contains("init1"))
        assertFalse(c.contains("init2"))
    }

    @Test
    fun `les fonctions init doivent peupler FR et EN`() {
        generate(singleTranslation, listOf("faq"))
        val c = content()
        assertTrue(c.contains("FR[\"faq_services\"] = \"Services FAQ\""))
        assertTrue(c.contains("EN[\"faq_services\"] = \"FAQ Services\""))
    }

    @Test
    fun `le bloc init doit appeler toutes les fonctions init`() {
        val big = (1..350).map { i ->
            LokaliseTranslation(key = "faq_$i", fr = "FR$i", en = "EN$i")
        }.toSet()
        generate(big, listOf("faq"))
        val c = content()
        assertTrue(c.contains("init0()"))
        assertTrue(c.contains("init1()"))
    }

    // ── Caractères spéciaux ────────────────────────────────────────────────────

    @Test
    fun `devrait échapper les guillemets dans les traductions`() {
        generate(specialCharTranslations, listOf("faq"))
        assertTrue(content().contains("\\\"test\\\""))
    }

    @Test
    fun `devrait préserver le signe dollar dans les traductions`() {
        generate(specialCharTranslations, listOf("faq"))
        val c = content()
        assertTrue(c.contains("\$valeur") || c.contains("\$value"))
    }

    // ── Ordre & déterminisme ───────────────────────────────────────────────────

    @Test
    fun `devrait trier les constantes par clé (ordre déterministe)`() {
        generate()
        val c = content()
        val achievementsPos = c.indexOf("ACHIEVEMENTS_TITLE")
        val faqPos = c.indexOf("FAQ_CONTACT")
        assertTrue(achievementsPos in 0 until faqPos)
    }

    @Test
    fun `devrait produire le même fichier pour les mêmes entrées`() {
        generate()
        val first = content()
        tempDir.deleteRecursively()
        tempDir.mkdirs()
        generate()
        assertTrue(first == content())
    }

    // ── Robustesse ─────────────────────────────────────────────────────────────

    @Test
    fun `devrait fonctionner avec une seule traduction`() {
        generate(singleTranslation, listOf("faq"))
        assertTrue(content().contains("FAQ_SERVICES"))
    }

    @Test
    fun `ne devrait générer aucune constante si aucune clé ne correspond`() {
        val none = setOf(LokaliseTranslation(key = "other", fr = "x", en = "x"))
        generate(none, listOf("faq"))
        val c = content()
        assertFalse(c.contains("OTHER"))
    }

    @Test
    fun `le filtrage devrait être insensible à la casse`() {
        val mixed = setOf(LokaliseTranslation(key = "FAQ_UPPER", fr = "x", en = "x"))
        generate(mixed, listOf("faq"))
        assertTrue(content().contains("FAQ_UPPER"))
    }

    // ── Parité Java/Kotlin ─────────────────────────────────────────────────────

    @Test
    fun `devrait générer les mêmes noms de constantes que le générateur Java`() {
        val javaDir = createTempDir()
        try {
            JavaTranslationsEnumGenerator.create(
                translations = multipleTranslations,
                enumPackageName = enumPackageName,
                enumName = enumName,
                includedPrefixes = defaultPrefixes,
                enumInterface = enumInterface,
                file = javaDir
            )
            generate()

            val javaContent = File(javaDir, "${enumPackageName.replace('.', '/')}/$enumName.java").readText()
            val kotlinContent = content()

            listOf("FAQ_SERVICES", "FAQ_CONTACT", "ACHIEVEMENTS_TITLE",
                   "TELEMATICS_ERROR", "TELEMATICS_DETAILS").forEach { name ->
                assertTrue(javaContent.contains(name), "Constante $name manquante dans Java")
                assertTrue(kotlinContent.contains(name), "Constante $name manquante dans Kotlin")
            }
        } finally {
            javaDir.deleteRecursively()
        }
    }
}
