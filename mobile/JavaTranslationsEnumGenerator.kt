package generator

import com.squareup.javapoet.ClassName
import com.squareup.javapoet.FieldSpec
import com.squareup.javapoet.JavaFile
import com.squareup.javapoet.MethodSpec
import com.squareup.javapoet.TypeSpec
import model.LokaliseTranslation
import java.io.File
import javax.lang.model.element.Modifier

/**
 * Génère une classe Java (non-enum) pour les clés de traduction,
 * en utilisant JavaPoet pour construire la classe de manière programmatique.
 *
 * Chaque clé de traduction est représentée comme une constante d'énumération,
 * avec des propriétés pour les traductions en français et en anglais.
 * La classe enum implémente une interface spécifiée, qui peut être utilisée
 * pour accéder aux clés de traduction de manière générique dans le code.
 *
 */
internal object JavaTranslationsEnumGenerator : BaseTranslationsEnumGenerator() {

    /**
     * Nombre de constantes par inner holder class.
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
        val interfacesName = enumInterface.map { ClassName.bestGuess(classNameString = it) }
        val filteredTranslations = translations
            .filter { shouldAddKey(it.key, includedPrefixes) }
            .sortedBy { it.key } // ordre déterministe pour les tests

        val classType = ClassName.get(enumPackageName, enumName)

        // ── Classe principale ──────────────────────────────────────────────────
        val classBuilder = TypeSpec.enumBuilder(enumName)
            .addSuperinterfaces(interfacesName)
            .addModifiers(Modifier.PUBLIC)

        // Constantes enum avec seulement la clé (pas de fr/en dans le constructeur)
        classBuilder.addEnumValues(filteredTranslations)

        // Inner holder classes — chaque holder a son propre <clinit> < 64 Ko
        val groups = filteredTranslations.chunked(HOLDER_SIZE)
        groups.forEachIndexed { index, group ->
            classBuilder.addType(
                buildHolderClass(
                    holderName = "_Holder$index",
                    group = group,
                    classType = classType
                )
            )
        }

        // ── Fichier Java final ─────────────────────────────────────────────────
        val javaFile = JavaFile.builder(
            enumPackageName,
            classBuilder
                .addFields()
                .addConstructor()
                .addKeyGetter()
                .build()
        ).build()

        javaFile.writeTo(directory = file)
    }

    // ── Inner holder class ─────────────────────────────────────────────────────
    // Chaque holder contient HOLDER_SIZE constantes statiques finales.
    // Son <clinit> est distinct de celui de l'enum outer → résout "code too large".
    private fun buildHolderClass(
        holderName: String,
        group: List<LokaliseTranslation>,
        classType: ClassName
    ): TypeSpec {
        val holderBuilder = TypeSpec.classBuilder(holderName)
            .addModifiers(Modifier.PRIVATE, Modifier.STATIC, Modifier.FINAL)

        group.forEach { translation ->
            val constantName = translation.key.cleanKey().uppercase()
            holderBuilder.addField(
                FieldSpec.builder(classType, constantName)
                    .addModifiers(Modifier.STATIC, Modifier.FINAL)
                    .initializer(
                        "new \$T(\$S, \$S, \$S)",
                        classType,
                        translation.key.cleanKey(),
                        translation.fr.escapeText(),
                        translation.en.escapeText()
                    )
                    .build()
            )
        }
        return holderBuilder.build()
    }

    // ── Constantes d'enum avec seulement la clé ───────────────────────────────
    private fun TypeSpec.Builder.addEnumValues(
        filteredTranslations: List<LokaliseTranslation>
    ): TypeSpec.Builder = filteredTranslations.fold(this) { builder, translation ->
        builder.addEnumConstant(
            translation.key.cleanKey().uppercase(),
            TypeSpec.anonymousClassBuilder(
                "\$S",
                translation.key.cleanKey()
            ).build()
        )
    }

    // ── Constructeur (key only) ────────────────────────────────────────────────
    private fun TypeSpec.Builder.addConstructor(): TypeSpec.Builder = this.apply {
        addMethod(
            MethodSpec.constructorBuilder()
                .addParameter(String::class.java, key)
                .addStatement("this.\$N = \$N", key, key)
                .build()
        )
    }

    // ── Implémentation de LocalizedStringKey ──────────────────────────────────
    private fun TypeSpec.Builder.addKeyGetter(): TypeSpec.Builder = this.addMethod(
        MethodSpec.methodBuilder(key)
            .addAnnotation(Override::class.java)
            .addModifiers(Modifier.PUBLIC)
            .returns(String::class.java)
            .addStatement("return \$N", key)
            .build()
    )

    // ── Champs d'instance ─────────────────────────────────────────────────────
    // fr et en restent PUBLIC FINAL — aucune régression d'API
    private fun TypeSpec.Builder.addFields(): TypeSpec.Builder = this.apply {
        addField(String::class.java, key, Modifier.PRIVATE, Modifier.FINAL)
        addField(String::class.java, frAttribute, Modifier.PUBLIC, Modifier.FINAL)
        addField(String::class.java, enAttribute, Modifier.PUBLIC, Modifier.FINAL)
    }
}

private fun String.escapeText(): String = this
    .replace(oldValue = "\\", newValue = "\\\\")
    .replace(oldValue = "\"", newValue = "\\\"")
    .replace(oldValue = "\\\\n", newValue = "\\n")
    .replace(oldValue = "\\\\\$", newValue = "\$")
