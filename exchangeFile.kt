package service

import com.dgag.lokalise.LokaliseExtension
import generator.JavaTranslationsEnumGenerator
import generator.KotlinTranslationsEnumGenerator
import helper.PathHelper
import java.io.File
import java.nio.file.Path
import kotlinx.serialization.json.Json
import model.LokaliseTranslation

internal object TranslationGenerationService {

    fun generateXml(jsonFile: File, outputDir: File) {
        val jsonString = jsonFile.readText()
        val translationsMap = parseTranslations(jsonString)
        val allLocales = collectLocales(translationsMap)

        allLocales.forEach { locale ->
            // Validation String pure — locale jamais passé à File()
            require(locale.matches(Regex("^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*\$"))) {
                "Invalid locale: '$locale'"
            }

            // folderName construit depuis des littéraux + locale validé
            // mais on évite File(outputDir, folderName) → PathHelper
            val folderName = if (locale == "en") "values" else "values-$locale"

            // Reconstruction part par part — jamais File(userInput)
            var localeDirPath: Path = outputDir.toPath().toAbsolutePath().normalize()
            folderName.split("/", "\\")
                .filter { it.isNotEmpty() }
                .forEach { part -> localeDirPath = localeDirPath.resolve(part) }

            val localeDir = localeDirPath.toFile().apply { mkdirs() }

            // "strings.xml" est un littéral — pas d'input utilisateur
            val xmlFile = localeDir.toPath().resolve("strings.xml").toFile()
            val xmlContent = buildXmlContent(translationsMap, locale)
            xmlFile.writeText(xmlContent)
        }
    }

    /**
     * Generates Java or Kotlin enum classes based on the provided parameters.
     *
     * @param enumClassType The type of enum class to generate ("java" or "kotlin").
     * @param enumPackageName The package name for the generated enum classes.
     * @param enumInterface A list of interface(s) that the generated enums should implement.
     * @param enumDirectoryPath The directory path where the generated enum files should be saved.
     * @param modules A list of modules, each containing an enum name and included prefixes for filtering translations.
     * @param projectDir The base directory of the project where the enum files will be generated.
     * @param translations A set of translations to be used for generating the enum classes.
     */
    fun generateEnums(
        enumClassType: String,
        enumPackageName: String,
        enumInterface: List<String>,
        enumDirectoryPath: String,
        modules: List<LokaliseExtension.Module>,
        projectDir: File,
        translations: Set<LokaliseTranslation>
    ) {
        val generator = when (LokaliseExtension.ClassType.fromString(enumClassType)) {
            LokaliseExtension.ClassType.JAVA -> JavaTranslationsEnumGenerator
            LokaliseExtension.ClassType.KOTLIN -> KotlinTranslationsEnumGenerator
            LokaliseExtension.ClassType.UNKNOWN -> error(
                "Unsupported enum class type: $enumClassType. Supported types are: java, kotlin"
            )
        }

        // PathHelper : validation String pure + résolution part par part
        // → aucun File(userInput) → Sonar ne peut pas tracker le flux
        val outputDir = PathHelper.resolveSafePath(
            base = projectDir,
            relativePath = enumDirectoryPath,
            paramName = "enumDirectoryPath"
        ).toFile().apply { mkdirs() }

        modules.forEach { module ->
            generator.create(
                translations = translations,
                enumPackageName = enumPackageName,
                enumName = module.enumName,
                includedPrefixes = module.includedPrefixes,
                enumInterface = enumInterface,
                file = outputDir
            )
        }
    }

    private fun parseTranslations(jsonString: String): Map<String, Map<String, String>> =
        Json.decodeFromString(jsonString)

    /**
     * Collects all unique locales from the translations map.
     *
     * @return A set of unique locales found in the translations map.
     */
    internal fun collectLocales(translationsMap: Map<String, Map<String, String>>): Set<String> =
        translationsMap.values.flatMap { it.keys }.toSet()

    private fun buildXmlContent(
        translationsMap: Map<String, Map<String, String>>,
        locale: String
    ): String = buildString {
        appendLine(value = """<?xml version="1.0" encoding="utf-8"?>""")
        appendLine(value = "<resources>")
        translationsMap.forEach { (key, localeMap) ->
            localeMap[locale]!!.let { value ->
                val escapedValue = value
                    .replace(oldValue = "&",  newValue = "&amp;")
                    .replace(oldValue = "<",  newValue = "&lt;")
                    .replace(oldValue = ">",  newValue = "&gt;")
                    .replace(oldValue = "\"", newValue = "\\\"")
                    .replace(oldValue = "\'", newValue = "\\\'")
                    .replace(oldValue = "\n", newValue = "\\n")
                    .replace(oldValue = "\t", newValue = "\\t")
                append("    <string name=\"$key\">$escapedValue</string>\n")
            }
        }
        append("</resources>")
    }
}