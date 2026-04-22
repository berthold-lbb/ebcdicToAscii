package generator

import model.LokaliseTranslation
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

class JavaTranslationsEnumGeneratorTest {

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
        JavaTranslationsEnumGenerator.create(
            translations = translations,
            enumPackageName = enumPackageName,
            enumName = enumName,
            includedPrefixes = prefixes,
            enumInterface = enumInterface,
            file = tempDir
        )
    }

    private fun content(): String {
        val file = File(tempDir, "${enumPackageName.replace('.', '/')}/$enumName.java")
        assertTrue(file.exists(), "Fichier non généré : ${file.path}")
        return file.readText()
    }

    // ── Fichier & structure ────────────────────────────────────────────────────

    @Test
    fun `devrait créer le fichier Java dans le bon répertoire`() {
        generate()
        val file = File(tempDir, "${enumPackageName.replace('.', '/')}/$enumName.java")
        assertTrue(file.exists())
    }

    @Test
    fun `devrait générer une enum publique avec le bon nom`() {
        generate()
        assertTrue(content().contains("public enum $enumName"))
    }

    @Test
    fun `devrait implémenter l'interface LocalizedStringKey`() {
        generate()
        assertTrue(content().contains("implements LocalizedStringKey"))
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

    @Test
    fun `devrait mettre les noms de constantes en majuscules`() {
        generate(singleTranslation, listOf("faq"))
        val c = content()
        assertTrue(c.contains("FAQ_SERVICES"))
    }

    // ── Holder Translations ────────────────────────────────────────────────────

    @Test
    fun `devrait générer la classe inner Translations`() {
        generate()
        val c = content()
        assertTrue(c.contains("private static final class Translations"))
    }

    @Test
    fun `devrait générer les Maps FR et EN statiques finales`() {
        generate()
        val c = content()
        assertTrue(c.contains("static final Map<String, String> FR"))
        assertTrue(c.contains("static final Map<String, String> EN"))
    }

    @Test
    fun `devrait générer au moins une méthode d'init`() {
        generate()
        assertTrue(content().contains("private static void init0"))
    }

    @Test
    fun `devrait générer plusieurs méthodes d'init pour plus de 200 traductions`() {
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
    fun `les méthodes init doivent contenir les put pour FR et EN`() {
        generate(singleTranslation, listOf("faq"))
        val c = content()
        assertTrue(c.contains("FR.put(\"faq_services\", \"Services FAQ\")"))
        assertTrue(c.contains("EN.put(\"faq_services\", \"FAQ Services\")"))
    }

    @Test
    fun `le bloc static doit appeler toutes les méthodes init`() {
        val big = (1..350).map { i ->
            LokaliseTranslation(key = "faq_$i", fr = "FR$i", en = "EN$i")
        }.toSet()
        generate(big, listOf("faq"))
        val c = content()
        assertTrue(c.contains("init0()"))
        assertTrue(c.contains("init1()"))
    }

    // ── Champs, constructeur, getter ───────────────────────────────────────────

    @Test
    fun `devrait générer le champ key privé final`() {
        generate()
        assertTrue(content().contains("private final String key"))
    }

    @Test
    fun `devrait générer fr et en publics ET final`() {
        generate()
        val c = content()
        assertTrue(c.contains("public final String fr"))
        assertTrue(c.contains("public final String en"))
    }

    @Test
    fun `devrait générer un constructeur prenant seulement la clé`() {
        generate()
        val c = content()
        assertTrue(c.contains("LocalizedString(String key)"))
    }

    @Test
    fun `le constructeur doit faire les lookups dans les Maps du holder`() {
        generate()
        val c = content()
        assertTrue(c.contains("this.fr = Translations.FR.get(key)"))
        assertTrue(c.contains("this.en = Translations.EN.get(key)"))
    }

    @Test
    fun `devrait générer la méthode key() avec Override`() {
        generate()
        val c = content()
        assertTrue(c.contains("@Override"))
        assertTrue(c.contains("public String key()"))
        assertTrue(c.contains("return key"))
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
}
