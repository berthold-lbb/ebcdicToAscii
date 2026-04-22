package generator

import model.LokaliseTranslation
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

class KotlinTranslationsEnumGeneratorTest {

    @TempDir
    lateinit var tempDir: File

    private val enumPackageName = "ca.dgag.ajusto.core"
    private val enumName = "LocalizedString"
    private val enumInterface = listOf("com.mirego.circumflex.LocalizedStringKey")
    private val includedPrefixes = listOf("faq", "achievements", "telematics")

    // ── Données de test ────────────────────────────────────────────────────────

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

    private val translationsWithSpecialChars = setOf(
        LokaliseTranslation(
            key = "faq_special",
            fr = "Numéro d'erreur : \"test\" \$valeur",
            en = "Error number: \"test\" \$value"
        )
    )

    // ── Helpers ────────────────────────────────────────────────────────────────

    private fun generate(
        translations: Set<LokaliseTranslation> = multipleTranslations,
        prefixes: List<String> = includedPrefixes
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

    private fun generatedFileContent(): String {
        val file = File(
            tempDir,
            "${enumPackageName.replace('.', '/')}/$enumName.kt"
        )
        assertTrue(file.exists(), "Fichier généré introuvable : ${file.path}")
        return file.readText()
    }

    // ── Tests de génération de fichier ─────────────────────────────────────────

    @Test
    fun `devrait créer le fichier Kotlin dans le bon répertoire`() {
        generate()
        val expectedFile = File(
            tempDir,
            "${enumPackageName.replace('.', '/')}/$enumName.kt"
        )
        assertTrue(expectedFile.exists())
    }

    @Test
    fun `devrait générer une enum avec le bon nom`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("enum class $enumName"))
    }

    @Test
    fun `devrait implémenter l'interface LocalizedStringKey`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("LocalizedStringKey"))
    }

    @Test
    fun `devrait générer le bon package`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("package $enumPackageName"))
    }

    // ── Tests des constantes d'enum ────────────────────────────────────────────

    @Test
    fun `devrait générer les constantes d'enum filtrées par préfixe`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("FAQ_SERVICES"))
        assertTrue(content.contains("FAQ_CONTACT"))
        assertTrue(content.contains("ACHIEVEMENTS_TITLE"))
        assertTrue(content.contains("TELEMATICS_ERROR"))
    }

    @Test
    fun `devrait exclure les clés ne correspondant pas aux préfixes`() {
        val translations = setOf(
            LokaliseTranslation(key = "faq_services", fr = "FAQ", en = "FAQ"),
            LokaliseTranslation(key = "other_key",    fr = "Autre", en = "Other")
        )
        generate(translations = translations, prefixes = listOf("faq"))
        val content = generatedFileContent()
        assertTrue(content.contains("FAQ_SERVICES"))
        assertFalse(content.contains("OTHER_KEY"))
    }

    @Test
    fun `devrait remplacer les points par des underscores dans les clés`() {
        generate()
        val content = generatedFileContent()
        // "telematics.details" → TELEMATICS_DETAILS
        assertTrue(content.contains("TELEMATICS_DETAILS"))
        assertFalse(content.contains("TELEMATICS.DETAILS"))
    }

    @Test
    fun `devrait mettre les constantes en majuscules`() {
        generate(translations = singleTranslation)
        val content = generatedFileContent()
        assertTrue(content.contains("FAQ_SERVICES"))
        assertFalse(content.contains("faq_services("))
    }

    // ── Tests des inner holder objects ────────────────────────────────────────

    @Test
    fun `devrait générer des inner holder objects privés`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("private object _Holder0"))
    }

    @Test
    fun `devrait générer un seul holder pour moins de HOLDER_SIZE constantes`() {
        generate() // 5 traductions → 1 holder
        val content = generatedFileContent()
        assertTrue(content.contains("_Holder0"))
        assertFalse(content.contains("_Holder1"))
    }

    @Test
    fun `devrait générer plusieurs holders pour plus de 300 constantes`() {
        val bigSet = (1..350).map { i ->
            LokaliseTranslation(
                key = "faq_key_$i",
                fr = "Traduction FR $i",
                en = "Translation EN $i"
            )
        }.toSet()

        generate(translations = bigSet, prefixes = listOf("faq"))
        val content = generatedFileContent()
        assertTrue(content.contains("_Holder0"))
        assertTrue(content.contains("_Holder1"))
        assertFalse(content.contains("_Holder2"))
    }

    @Test
    fun `les holders doivent contenir les traductions fr et en`() {
        generate(translations = singleTranslation, prefixes = listOf("faq"))
        val content = generatedFileContent()
        assertTrue(content.contains("Services FAQ"))
        assertTrue(content.contains("FAQ Services"))
    }

    // ── Tests du companion object ──────────────────────────────────────────────

    @Test
    fun `devrait générer un companion object`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("companion object"))
    }

    @Test
    fun `le companion object doit déléguer vers les holders`() {
        generate(translations = singleTranslation, prefixes = listOf("faq"))
        val content = generatedFileContent()
        assertTrue(content.contains("_Holder0.FAQ_SERVICES"))
    }

    @Test
    fun `chaque constante publique doit référencer son holder correct`() {
        // 350 constantes → Holder0 (0-299) et Holder1 (300-349)
        val bigSet = (1..350).map { i ->
            LokaliseTranslation(
                key = "faq_key_${i.toString().padStart(3, '0')}",
                fr = "FR $i",
                en = "EN $i"
            )
        }.toSet()

        generate(translations = bigSet, prefixes = listOf("faq"))
        val content = generatedFileContent()
        // Les 300 premières dans Holder0, les 50 suivantes dans Holder1
        assertTrue(content.contains("_Holder0."))
        assertTrue(content.contains("_Holder1."))
    }

    // ── Tests des propriétés et constructeur ──────────────────────────────────

    @Test
    fun `devrait générer un constructeur avec key, fr et en`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("key: String"))
        assertTrue(content.contains("fr: String"))
        assertTrue(content.contains("en: String"))
    }

    @Test
    fun `devrait générer les propriétés key, fr et en publiques`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("val key"))
        assertTrue(content.contains("val fr"))
        assertTrue(content.contains("val en"))
    }

    @Test
    fun `devrait générer la fonction key() avec override`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("override"))
        assertTrue(content.contains("fun key()"))
        assertTrue(content.contains("return key"))
    }

    // ── Tests des caractères spéciaux ─────────────────────────────────────────

    @Test
    fun `devrait échapper les guillemets dans les traductions`() {
        generate(
            translations = translationsWithSpecialChars,
            prefixes = listOf("faq")
        )
        val content = generatedFileContent()
        assertTrue(content.contains("\\\"test\\\""))
    }

    @Test
    fun `devrait échapper le signe dollar dans les traductions`() {
        generate(
            translations = translationsWithSpecialChars,
            prefixes = listOf("faq")
        )
        val content = generatedFileContent()
        assertTrue(content.contains("\$valeur") || content.contains("\$value"))
    }

    // ── Tests du filtrage ──────────────────────────────────────────────────────

    @Test
    fun `ne devrait rien générer si aucune clé ne correspond aux préfixes`() {
        val noMatchTranslations = setOf(
            LokaliseTranslation(key = "other_key", fr = "Autre", en = "Other")
        )
        generate(translations = noMatchTranslations, prefixes = listOf("faq"))
        val content = generatedFileContent()
        assertFalse(content.contains("OTHER_KEY"))
        assertFalse(content.contains("_Holder0"))
    }

    @Test
    fun `devrait inclure les clés correspondant à n'importe quel préfixe de la liste`() {
        generate(
            translations = multipleTranslations,
            prefixes = listOf("faq", "telematics")
        )
        val content = generatedFileContent()
        assertTrue(content.contains("FAQ_SERVICES"))
        assertTrue(content.contains("TELEMATICS_ERROR"))
        assertFalse(content.contains("ACHIEVEMENTS_TITLE"))
    }

    @Test
    fun `le filtrage devrait être insensible à la casse`() {
        val mixedCaseTranslations = setOf(
            LokaliseTranslation(key = "FAQ_UPPERCASE", fr = "FAQ", en = "FAQ")
        )
        generate(
            translations = mixedCaseTranslations,
            prefixes = listOf("faq")
        )
        val content = generatedFileContent()
        assertTrue(content.contains("FAQ_UPPERCASE"))
    }

    // ── Tests de robustesse ────────────────────────────────────────────────────

    @Test
    fun `devrait générer un fichier avec une seule traduction`() {
        generate(
            translations = singleTranslation,
            prefixes = listOf("faq")
        )
        val content = generatedFileContent()
        assertTrue(content.contains("FAQ_SERVICES"))
    }

    @Test
    fun `devrait produire un ordre déterministe (trié par clé)`() {
        generate()
        val content = generatedFileContent()
        val faqServicesPos  = content.indexOf("FAQ_SERVICES")
        val achievementsPos = content.indexOf("ACHIEVEMENTS_TITLE")
        // trié alphabétiquement : ACHIEVEMENTS avant FAQ
        assertTrue(achievementsPos < faqServicesPos)
    }

    // ── Tests de parité Java/Kotlin ────────────────────────────────────────────

    @Test
    fun `devrait générer les mêmes constantes que le générateur Java pour les mêmes entrées`() {
        val javaTempDir = createTempDir()
        try {
            JavaTranslationsEnumGenerator.create(
                translations = multipleTranslations,
                enumPackageName = enumPackageName,
                enumName = enumName,
                includedPrefixes = includedPrefixes,
                enumInterface = enumInterface,
                file = javaTempDir
            )
            KotlinTranslationsEnumGenerator.create(
                translations = multipleTranslations,
                enumPackageName = enumPackageName,
                enumName = enumName,
                includedPrefixes = includedPrefixes,
                enumInterface = enumInterface,
                file = tempDir
            )

            val javaContent   = File(javaTempDir, "${enumPackageName.replace('.', '/')}/$enumName.java").readText()
            val kotlinContent = generatedFileContent()

            // Les mêmes noms de constantes doivent apparaître dans les deux fichiers
            listOf("FAQ_SERVICES", "FAQ_CONTACT", "ACHIEVEMENTS_TITLE",
                   "TELEMATICS_ERROR", "TELEMATICS_DETAILS").forEach { constantName ->
                assertTrue(javaContent.contains(constantName),
                    "Constante $constantName manquante dans le fichier Java")
                assertTrue(kotlinContent.contains(constantName),
                    "Constante $constantName manquante dans le fichier Kotlin")
            }
        } finally {
            javaTempDir.deleteRecursively()
        }
    }
}
