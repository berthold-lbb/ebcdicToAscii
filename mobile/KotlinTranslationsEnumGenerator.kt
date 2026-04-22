package generator

import com.squareup.kotlinpoet.ClassName
import com.squareup.kotlinpoet.CodeBlock
import com.squareup.kotlinpoet.FileSpec
import com.squareup.kotlinpoet.FunSpec
import com.squareup.kotlinpoet.KModifier
import com.squareup.kotlinpoet.ParameterizedTypeName.Companion.parameterizedBy
import com.squareup.kotlinpoet.PropertySpec
import com.squareup.kotlinpoet.TypeSpec
import model.LokaliseTranslation
import java.io.File

/**
 * Génère une classe enum Kotlin pour les clés de traduction, en utilisant KotlinPoet.
 *
 * ARCHITECTURE (pattern Map lookup — identique à la version Java) :
 *   - L'enum contient uniquement la clé dans son constructeur primaire.
 *   - Les traductions fr/en sont stockées dans un inner `object Translations`
 *     avec deux Maps, peuplées par des fonctions `init0()`, `init1()`, ...
 *     chaque fonction traitant INIT_BATCH_SIZE paires.
 *   - Les propriétés fr/en sont initialisées via lookup dans les Maps.
 *   - Les propriétés fr/en restent `val` → immuables, aucune régression d'API.
 */
internal object KotlinTranslationsEnumGenerator : BaseTranslationsEnumGenerator() {

    private const val INIT_BATCH_SIZE = 200
    private const val HOLDER_NAME = "Translations"
    private const val FR_MAP = "FR"
    private const val EN_MAP = "EN"

    override fun create(
        translations: Set<LokaliseTranslation>,
        enumPackageName: String,
        enumName: String,
        includedPrefixes: List<String>,
        enumInterface: List<String>,
        file: File
    ) {
        val filtered = translations
            .filter { shouldAddKey(it.key, includedPrefixes) }
            .sortedBy { it.key }

        val interfacesName = enumInterface.map { ClassName.bestGuess(it) }

        // ── Enum avec constructeur primaire prenant SEULEMENT la clé ──────────
        val enumBuilder = TypeSpec.enumBuilder(enumName)
            .primaryConstructor(
                FunSpec.constructorBuilder()
                    .addParameter(key, String::class)
                    .build()
            )
            .addSuperinterfaces(interfacesName)
            .addProperty(
                PropertySpec.builder(key, String::class, KModifier.PUBLIC, KModifier.OVERRIDE)
                    .initializer(key)
                    .build()
            )
            // fr — initialisé via lookup Map ; reste val (immuable) ✅
            .addProperty(
                PropertySpec.builder(frAttribute, String::class, KModifier.PUBLIC)
                    .initializer("$HOLDER_NAME.$FR_MAP[$key] ?: %S", "")
                    .build()
            )
            // en — initialisé via lookup Map ; reste val (immuable) ✅
            .addProperty(
                PropertySpec.builder(enAttribute, String::class, KModifier.PUBLIC)
                    .initializer("$HOLDER_NAME.$EN_MAP[$key] ?: %S", "")
                    .build()
            )

        // ── Constantes enum (clé uniquement) ─────────────────────────────────
        filtered.forEach { t ->
            enumBuilder.addEnumConstant(
                t.key.cleanKey().uppercase(),
                TypeSpec.anonymousClassBuilder()
                    .addSuperclassConstructorParameter("%S", t.key.cleanKey())
                    .build()
            )
        }

        // ── Inner object Translations avec Maps FR/EN ─────────────────────────
        enumBuilder.addType(buildTranslationsHolder(filtered))

        // ── Override key() ────────────────────────────────────────────────────
        enumBuilder.addFunction(
            FunSpec.builder(key)
                .addModifiers(KModifier.OVERRIDE, KModifier.PUBLIC)
                .returns(String::class)
                .addStatement("return $key")
                .build()
        )

        FileSpec.builder(enumPackageName, enumName)
            .addType(enumBuilder.build())
            .build()
            .writeTo(file)
    }

    /**
     * Construit l'inner `object Translations` (équivalent d'une inner static final
     * class en JVM) avec les Maps FR et EN, peuplées par des fonctions en lots.
     */
    private fun buildTranslationsHolder(filtered: List<LokaliseTranslation>): TypeSpec {
        val hashMapType = ClassName("kotlin.collections", "HashMap")
            .parameterizedBy(
                ClassName("kotlin", "String"),
                ClassName("kotlin", "String")
            )

        val holderBuilder = TypeSpec.objectBuilder(HOLDER_NAME)
            .addModifiers(KModifier.PRIVATE)
            .addProperty(
                PropertySpec.builder(FR_MAP, hashMapType)
                    .initializer("HashMap()")
                    .build()
            )
            .addProperty(
                PropertySpec.builder(EN_MAP, hashMapType)
                    .initializer("HashMap()")
                    .build()
            )

        // Fonctions d'init par lots
        val initFunctionNames = mutableListOf<String>()
        filtered.chunked(INIT_BATCH_SIZE).forEachIndexed { index, batch ->
            val funcName = "init$index"
            initFunctionNames.add(funcName)
            val func = FunSpec.builder(funcName).addModifiers(KModifier.PRIVATE)
            batch.forEach { t ->
                func.addStatement(
                    "$FR_MAP[%S] = %S",
                    t.key.cleanKey(), t.fr.escapeText()
                )
                func.addStatement(
                    "$EN_MAP[%S] = %S",
                    t.key.cleanKey(), t.en.escapeText()
                )
            }
            holderBuilder.addFunction(func.build())
        }

        // init block (équivalent <clinit>) qui appelle toutes les fonctions d'init
        val initBlock = CodeBlock.builder()
        initFunctionNames.forEach { name -> initBlock.addStatement("$name()") }
        holderBuilder.addInitializerBlock(initBlock.build())

        return holderBuilder.build()
    }
}

/**
 * Nettoie une chaîne de caractères en échappant les caractères spéciaux.
 */
private fun String.escapeText(): String = this
    .replace(oldValue = "\\", newValue = "\\\\")
    .replace(oldValue = "\"", newValue = "\\\"")
    .replace(oldValue = "\\\\n", newValue = "\\n")
    .replace(oldValue = "\\\\\$", newValue = "\$")
