package generator

import model.LokaliseTranslation
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.nio.file.Files

class JavaTranslationsEnumGeneratorTest {

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
        JavaTranslationsEnumGenerator.create(
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
            "${enumPackageName.replace('.', '/')}/$enumName.java"
        )
        assertTrue(file.exists(), "Fichier généré introuvable : ${file.path}")
        return file.readText()
    }

    // ── Tests de génération de fichier ─────────────────────────────────────────

    @Test
    fun `devrait créer le fichier Java dans le bon répertoire`() {
        generate()
        val expectedFile = File(
            tempDir,
            "${enumPackageName.replace('.', '/')}/$enumName.java"
        )
        assertTrue(expectedFile.exists())
    }

    @Test
    fun `devrait générer une enum publique avec le bon nom`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("public enum $enumName"))
    }

    @Test
    fun `devrait implémenter l'interface LocalizedStringKey`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("implements LocalizedStringKey"))
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

    // ── Tests des inner holder classes ─────────────────────────────────────────

    @Test
    fun `devrait générer des inner holder classes privées statiques finales`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("private static final class _Holder0"))
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
        // Génère 350 traductions avec le préfixe "faq"
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
        generate(translations = singleTranslation)
        val content = generatedFileContent()
        assertTrue(content.contains("Services FAQ"))
        assertTrue(content.contains("FAQ Services"))
    }

    // ── Tests des champs et constructeur ──────────────────────────────────────

    @Test
    fun `devrait générer un champ key privé final`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("private final String key"))
    }

    @Test
    fun `devrait générer les champs fr et en publics finaux`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("public final String fr"))
        assertTrue(content.contains("public final String en"))
    }

    @Test
    fun `devrait générer un constructeur prenant uniquement la clé`() {
        generate()
        val content = generatedFileContent()
        // Constructeur avec 1 seul paramètre String key
        assertTrue(content.contains("LocalizedString(String key)"))
    }

    @Test
    fun `devrait générer la méthode key() avec Override`() {
        generate()
        val content = generatedFileContent()
        assertTrue(content.contains("@Override"))
        assertTrue(content.contains("public String key()"))
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
        // Le $ doit être présent (non supprimé) mais échappé
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
        // Enum vide — pas de constantes
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
        val faqServicesPos   = content.indexOf("FAQ_SERVICES")
        val achievementsPos  = content.indexOf("ACHIEVEMENTS_TITLE")
        // trié alphabétiquement : ACHIEVEMENTS avant FAQ
        assertTrue(achievementsPos < faqServicesPos)
    }
}
