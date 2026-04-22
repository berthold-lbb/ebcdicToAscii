package generator

import com.squareup.javapoet.ClassName
import com.squareup.javapoet.CodeBlock
import com.squareup.javapoet.FieldSpec
import com.squareup.javapoet.JavaFile
import com.squareup.javapoet.MethodSpec
import com.squareup.javapoet.ParameterizedTypeName
import com.squareup.javapoet.TypeSpec
import model.LokaliseTranslation
import java.io.File
import java.util.HashMap
import javax.lang.model.element.Modifier

/**
 * Génère une classe enum Java pour les clés de traduction, en utilisant JavaPoet.
 *
 * ARCHITECTURE (pattern Map lookup) :
 *   - L'enum contient uniquement la clé dans chaque constante (constructeur à 1 arg).
 *   - Les traductions fr/en sont stockées dans des Maps dans une inner class
 *     [Translations], peuplées par des méthodes statiques `init0()`, `init1()`, ...
 *     chaque méthode traitant INIT_BATCH_SIZE paires (~6 Ko de bytecode).
 *   - Le constructeur de l'enum fait un lookup dans les Maps pour initialiser fr/en.
 *   - Les champs fr/en restent `public final` → aucune régression d'API.
 *
 * POURQUOI ÇA RÉSOUT "code too large" :
 *   - <clinit> de Translations   = seulement N appels init0(), init1(), ... (~quelques bytes)
 *   - <clinit> de chaque initN() = ~200 paires × ~30 bytes = ~6 Ko  ✅
 *   - <clinit> de l'enum         = instanciation de chaque constante avec 1 seul arg (key)
 *                                  + $VALUES array → reste sous 64 Ko pour ~2500 constantes
 */
internal object JavaTranslationsEnumGenerator : BaseTranslationsEnumGenerator() {

    /**
     * Nombre de paires (fr/en) par méthode d'init statique.
     * Chaque paire génère 2 appels Map.put() (~30 bytes) → 200 paires ≈ 6 Ko par init.
     */
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
        val interfacesName = enumInterface.map { ClassName.bestGuess(it) }
        val filtered = translations
            .filter { shouldAddKey(it.key, includedPrefixes) }
            .sortedBy { it.key }

        val enumBuilder = TypeSpec.enumBuilder(enumName)
            .addSuperinterfaces(interfacesName)
            .addModifiers(Modifier.PUBLIC)

        // ── Constantes enum (clé uniquement dans le constructeur) ─────────────
        filtered.forEach { t ->
            enumBuilder.addEnumConstant(
                t.key.cleanKey().uppercase(),
                TypeSpec.anonymousClassBuilder("\$S", t.key.cleanKey()).build()
            )
        }

        // ── Inner holder class avec Maps FR/EN ────────────────────────────────
        enumBuilder.addType(buildTranslationsHolder(filtered))

        // ── Champs, constructeur, getter ──────────────────────────────────────
        enumBuilder
            .addFields()
            .addConstructor()
            .addKeyGetter()

        JavaFile.builder(enumPackageName, enumBuilder.build())
            .build()
            .writeTo(file)
    }

    /**
     * Construit l'inner static class `Translations` contenant les Maps FR et EN.
     * Les Maps sont remplies par des méthodes statiques en lots pour rester sous
     * la limite de 64 Ko par méthode.
     */
    private fun buildTranslationsHolder(filtered: List<LokaliseTranslation>): TypeSpec {
        val mapType = ParameterizedTypeName.get(
            ClassName.get(java.util.Map::class.java),
            ClassName.get(String::class.java),
            ClassName.get(String::class.java)
        )

        val holderBuilder = TypeSpec.classBuilder(HOLDER_NAME)
            .addModifiers(Modifier.PRIVATE, Modifier.STATIC, Modifier.FINAL)
            .addField(
                FieldSpec.builder(mapType, FR_MAP, Modifier.STATIC, Modifier.FINAL)
                    .initializer("new \$T<>()", HashMap::class.java)
                    .build()
            )
            .addField(
                FieldSpec.builder(mapType, EN_MAP, Modifier.STATIC, Modifier.FINAL)
                    .initializer("new \$T<>()", HashMap::class.java)
                    .build()
            )

        // Méthodes d'init par lots
        val initMethodNames = mutableListOf<String>()
        filtered.chunked(INIT_BATCH_SIZE).forEachIndexed { index, batch ->
            val methodName = "init$index"
            initMethodNames.add(methodName)
            val method = MethodSpec.methodBuilder(methodName)
                .addModifiers(Modifier.PRIVATE, Modifier.STATIC)
            batch.forEach { t ->
                method.addStatement(
                    "\$N.put(\$S, \$S)",
                    FR_MAP, t.key.cleanKey(), t.fr.escapeText()
                )
                method.addStatement(
                    "\$N.put(\$S, \$S)",
                    EN_MAP, t.key.cleanKey(), t.en.escapeText()
                )
            }
            holderBuilder.addMethod(method.build())
        }

        // Bloc static qui appelle toutes les méthodes d'init
        val staticBlock = CodeBlock.builder()
        initMethodNames.forEach { name -> staticBlock.addStatement("\$N()", name) }
        holderBuilder.addStaticBlock(staticBlock.build())

        return holderBuilder.build()
    }

    // ── Champs d'instance — fr et en restent PUBLIC FINAL ✅ ──────────────────
    private fun TypeSpec.Builder.addFields(): TypeSpec.Builder = this.apply {
        addField(String::class.java, key, Modifier.PRIVATE, Modifier.FINAL)
        addField(String::class.java, frAttribute, Modifier.PUBLIC, Modifier.FINAL)
        addField(String::class.java, enAttribute, Modifier.PUBLIC, Modifier.FINAL)
    }

    /**
     * Constructeur qui prend uniquement la clé et initialise fr/en via lookup
     * dans les Maps du holder. Le premier accès à `Translations.FR` déclenche
     * le chargement de la classe Translations et l'exécution de son <clinit>,
     * qui peuple les deux Maps avant les lookups.
     */
    private fun TypeSpec.Builder.addConstructor(): TypeSpec.Builder = this.apply {
        addMethod(
            MethodSpec.constructorBuilder()
                .addParameter(String::class.java, key)
                .addStatement("this.\$N = \$N", key, key)
                .addStatement(
                    "this.\$N = \$N.\$N.get(\$N)",
                    frAttribute, HOLDER_NAME, FR_MAP, key
                )
                .addStatement(
                    "this.\$N = \$N.\$N.get(\$N)",
                    enAttribute, HOLDER_NAME, EN_MAP, key
                )
                .build()
        )
    }

    private fun TypeSpec.Builder.addKeyGetter(): TypeSpec.Builder = this.addMethod(
        MethodSpec.methodBuilder(key)
            .addAnnotation(Override::class.java)
            .addModifiers(Modifier.PUBLIC)
            .returns(String::class.java)
            .addStatement("return \$N", key)
            .build()
    )
}

private fun String.escapeText(): String = this
    .replace(oldValue = "\\", newValue = "\\\\")
    .replace(oldValue = "\"", newValue = "\\\"")
    .replace(oldValue = "\\\\n", newValue = "\\n")
    .replace(oldValue = "\\\\\$", newValue = "\$")
