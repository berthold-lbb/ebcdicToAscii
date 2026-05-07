package generator

import com.squareup.kotlinpoet.ClassName
import com.squareup.kotlinpoet.CodeBlock
import com.squareup.kotlinpoet.FileSpec
import com.squareup.kotlinpoet.FunSpec
import com.squareup.kotlinpoet.KModifier
import com.squareup.kotlinpoet.ParameterizedTypeName.Companion.parameterizedBy
import com.squareup.kotlinpoet.PropertySpec
import com.squareup.kotlinpoet.TypeSpec
import com.squareup.kotlinpoet.asTypeName
import model.LokaliseTranslation
import java.io.File

/**
 * Génère une classe enum Kotlin pour les clés de traduction, en utilisant KotlinPoet.
 *
 * ARCHITECTURE (pattern Map lookup) :
 *   - L'enum contient uniquement la clé dans son constructeur primaire.
 *   - Les propriétés fr/en sont initialisées via un lookup dans un inner object
 *     [Translations] contenant deux Maps peuplées par des fonctions init0(), init1(), ...
 *   - val key est une propriété SIMPLE (sans KModifier.OVERRIDE) car l'interface
 *     déclare fun key(): String?, pas val key.
 *   - override fun key(): String? implémente correctement l'interface.
 *
 * COMPATIBILITÉ INTERFACE :
 *   Conçu pour les interfaces de la forme :
 *       interface LocalizedStringKey { fun key(): String? }
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

        val enumBuilder = TypeSpec.enumBuilder(enumName)
            .primaryConstructor(
                FunSpec.constructorBuilder()
                    .addParameter(key, String::class)
                    .build()
            )
            .addSuperinterfaces(interfacesName)
            // ── val key : SIMPLE, PAS de KModifier.OVERRIDE ──────────────────
            // L'interface déclare fun key(): String?, pas val key.
            // Ajouter OVERRIDE ici causait : 'key' overrides nothing.
            .addProperty(
                PropertySpec.builder(key, String::class, KModifier.PUBLIC)
                    .initializer(key)
                    .build()
            )
            // ── fr et en : initialisés via Map lookup, val immuable ✅ ────────
            .addProperty(
                PropertySpec.builder(frAttribute, String::class, KModifier.PUBLIC)
                    .initializer("$HOLDER_NAME.$FR_MAP[$key] ?: %S", "")
                    .build()
            )
            .addProperty(
                PropertySpec.builder(enAttribute, String::class, KModifier.PUBLIC)
                    .initializer("$HOLDER_NAME.$EN_MAP[$key] ?: %S", "")
                    .build()
            )

        // ── Constantes d'enum (clé seulement) ────────────────────────────────
        filtered.forEach { t ->
            enumBuilder.addEnumConstant(
                t.key.cleanKey().uppercase(),
                TypeSpec.anonymousClassBuilder()
                    .addSuperclassConstructorParameter("%S", t.key.cleanKey())
                    .build()
            )
        }

        // ── Inner object Translations ─────────────────────────────────────────
        enumBuilder.addType(buildTranslationsHolder(filtered))

        // ── override fun key(): String? ──────────────────────────────────────
        // Retour nullable pour matcher exactement l'interface : fun key(): String?
        enumBuilder.addFunction(
            FunSpec.builder(key)
                .addModifiers(KModifier.OVERRIDE, KModifier.PUBLIC)
                .returns(String::class.asTypeName().copy(nullable = true))
                .addStatement("return $key")
                .build()
        )

        FileSpec.builder(enumPackageName, enumName)
            .addType(enumBuilder.build())
            .build()
            .writeTo(file)
    }

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

        val initBlock = CodeBlock.builder()
        initFunctionNames.forEach { name -> initBlock.addStatement("$name()") }
        holderBuilder.addInitializerBlock(initBlock.build())

        return holderBuilder.build()
    }
}

private fun String.escapeText(): String = this
    .replace(oldValue = "\\", newValue = "\\\\")
    .replace(oldValue = "\"", newValue = "\\\"")
    .replace(oldValue = "\\\\n", newValue = "\\n")
    .replace(oldValue = "\\\\\$", newValue = "\$")