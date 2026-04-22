package generator

import com.squareup.kotlinpoet.ClassName
import com.squareup.kotlinpoet.CodeBlock
import com.squareup.kotlinpoet.FileSpec
import com.squareup.kotlinpoet.FunSpec
import com.squareup.kotlinpoet.KModifier
import com.squareup.kotlinpoet.PropertySpec
import com.squareup.kotlinpoet.TypeSpec
import model.LokaliseTranslation
import java.io.File

/**
 * Génère une classe enum Kotlin pour les clés de traduction,
 * en utilisant KotlinPoet pour construire la classe de manière programmatique.
 *
 * Chaque clé de traduction est représentée comme une constante d'énumération,
 * avec des propriétés pour les traductions en français et en anglais.
 * La classe enum implémente une interface spécifiée, qui peut être utilisée
 * pour accéder aux clés de traduction de manière générique dans le code.
 *
 */
internal object KotlinTranslationsEnumGenerator : BaseTranslationsEnumGenerator() {

    /**
     * Nombre de constantes par inner holder object.
     * Chaque constante génère ~19 bytes de bytecode dans le <clinit> du holder ;
     * 300 par lot donne ~5.7 Ko, bien sous la limite de 64 Ko.
     */
    private const val HOLDER_SIZE = 300

    override fun create(
        translations: Set<LokaliseTranslation>,
        enumPackageName: String,
        enumName: String,
        includedPrefixes: List<String>,
        enumInterface: List<String>,
        file: File
    ) {
        val filteredTranslations = translations
            .filter { shouldAddKey(it.key, includedPrefixes) }
            .sortedBy { it.key } // ordre déterministe pour les tests

        // ── Enum principal ─────────────────────────────────────────────────────
        val enumBuilder = TypeSpec.enumBuilder(enumName)
            .addConstructor(enumInterface)
            .addEnumValues(filteredTranslations)

        // ── Inner holder objects ───────────────────────────────────────────────
        // Chaque holder a son propre <clinit> distinct de l'enum outer.
        val groups = filteredTranslations.chunked(HOLDER_SIZE)
        groups.forEachIndexed { index, group ->
            enumBuilder.addType(
                buildHolderObject(
                    holderName = "_Holder$index",
                    group = group,
                    enumName = enumName,
                    enumPackageName = enumPackageName
                )
            )
        }

        // ── Companion object : délègue vers les holders ────────────────────────
        // outer <clinit> : ~6 bytes/constante × 4285 = ~25 Ko ✅
        val companionBuilder = TypeSpec.companionObjectBuilder()
        groups.forEachIndexed { groupIndex, group ->
            group.forEach { translation ->
                val constantName = translation.key.cleanKey().uppercase()
                companionBuilder.addProperty(
                    PropertySpec.builder(
                        constantName,
                        ClassName(enumPackageName, enumName)
                    )
                        .initializer("_Holder$groupIndex.$constantName")
                        .build()
                )
            }
        }
        enumBuilder.addType(companionBuilder.build())

        enumBuilder.addGetter()

        // ── Fichier Kotlin final ───────────────────────────────────────────────
        val kotlinFile = FileSpec.builder(enumPackageName, enumName)
            .addType(enumBuilder.build())
            .build()

        kotlinFile.writeTo(file)
    }

    // ── Inner holder object ────────────────────────────────────────────────────
    // Contient HOLDER_SIZE constantes val.
    // Son <clinit> est distinct de celui de l'enum → résout "code too large".
    private fun buildHolderObject(
        holderName: String,
        group: List<LokaliseTranslation>,
        enumName: String,
        enumPackageName: String
    ): TypeSpec {
        val holderBuilder = TypeSpec.objectBuilder(holderName)
            .addModifiers(KModifier.PRIVATE)

        group.forEach { translation ->
            val constantName = translation.key.cleanKey().uppercase()
            holderBuilder.addProperty(
                PropertySpec.builder(
                    constantName,
                    ClassName(enumPackageName, enumName)
                )
                    .initializer(
                        "%L(%S, %S, %S)",
                        enumName,
                        translation.key.cleanKey(),
                        translation.fr.escapeText(),
                        translation.en.escapeText()
                    )
                    .build()
            )
        }
        return holderBuilder.build()
    }

    // ── Constructeur primaire avec interface ──────────────────────────────────
    private fun TypeSpec.Builder.addConstructor(enumInterface: List<String>): TypeSpec.Builder {
        val interfacesName = enumInterface.map { ClassName.bestGuess(it) }
        return this.primaryConstructor(
            FunSpec.constructorBuilder()
                .addParameter(key, String::class)
                .addParameter(frAttribute, String::class)
                .addParameter(enAttribute, String::class)
                .build()
        )
            .addSuperinterfaces(interfacesName)
            .addProperty(
                PropertySpec.builder(key, String::class, KModifier.PUBLIC, KModifier.OVERRIDE)
                    .initializer(key)
                    .build()
            )
            .addProperty(
                PropertySpec.builder(frAttribute, String::class, KModifier.PUBLIC)
                    .initializer(frAttribute)
                    .build()
            )
            .addProperty(
                PropertySpec.builder(enAttribute, String::class, KModifier.PUBLIC)
                    .initializer(enAttribute)
                    .build()
            )
    }

    // ── Constantes d'enum (key, fr, en dans le constructeur) ─────────────────
    private fun TypeSpec.Builder.addEnumValues(
        filteredTranslations: List<LokaliseTranslation>
    ): TypeSpec.Builder = filteredTranslations.fold(this) { builder, translation ->
        builder.addEnumConstant(
            translation.key.cleanKey().uppercase(),
            TypeSpec.anonymousClassBuilder()
                .addSuperclassConstructorParameter("%S", translation.key.cleanKey())
                .addSuperclassConstructorParameter("%S", translation.fr.escapeText())
                .addSuperclassConstructorParameter("%S", translation.en.escapeText())
                .build()
        )
    }

    // ── Override key() de LocalizedStringKey ──────────────────────────────────
    private fun TypeSpec.Builder.addGetter(): TypeSpec.Builder = this.addFunction(
        FunSpec.builder(key)
            .addModifiers(KModifier.OVERRIDE, KModifier.PUBLIC)
            .addStatement("return $key")
            .returns(String::class)
            .build()
    )
}

/**
 * Nettoie une chaîne de caractères en échappant les caractères spéciaux
 * qui pourraient poser problème dans le code généré.
 *
 * @return La chaîne de caractères nettoyée, avec les caractères spéciaux échappés.
 */
private fun String.escapeText(): String = this
    .replace(oldValue = "\\", newValue = "\\\\")
    .replace(oldValue = "\"", newValue = "\\\"")
    .replace(oldValue = "\\\\n", newValue = "\\n")
    .replace(oldValue = "\\\\\$", newValue = "\$")
