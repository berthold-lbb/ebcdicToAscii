
@InputFile
    public fun getTranslationsFile(): File =
        PathHelper.resolveSafePath(
            base = project.projectDir,
            relativePath = translationsFilePath,
            paramName = "translationsFilePath"
        ).toFile()
 
@OutputDirectory
  public fun getTranslationsJsonFile(): File =
      PathHelper.resolveSafePath(
          base = project.projectDir,
          relativePath = enumDirectoryPath,
          paramName = "enumDirectoryPath"
      ).toFile()


vulnerabilite 1 

require(locale.matches(Regex("^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$"))) {
    "Invalid locale: '$locale'"
}
val folderName = if (locale == "en") "values" else "values-$locale"


val localeDir = File(outputDir, folderName)
require(localeDir.canonicalPath.startsWith(outputDir.canonicalPath)) {
    "Path traversal detected for locale: '$locale'"
}

Vulnérabilité 2 

require(!enumDirectoryPath.contains("..") && 
        !File(enumDirectoryPath).isAbsolute) {
    "Invalid enumDirectoryPath: '$enumDirectoryPath'"
}
val outputDir = File(projectDir, enumDirectoryPath).apply { mkdirs() }


val outputDir = File(projectDir, enumDirectoryPath)
require(outputDir.canonicalPath.startsWith(projectDir.canonicalPath)) {
    "Path traversal detected in enumDirectoryPath"
}
outputDir.mkdirs()









///////////////////
package helper

import java.io.File
import java.nio.file.Path

object PathHelper {

    fun resolveSafePath(
        base: File,
        relativePath: String,
        paramName: String
    ): Path {
        val basePath = base.toPath().toAbsolutePath().normalize()

        // Validation pure String — aucune API Path/File avec l'input
        require(
            !relativePath.startsWith("/") &&
            !relativePath.startsWith("\\")
        ) {
            "$paramName must be a relative path. Received: '$relativePath'"
        }
        require(!relativePath.contains("..")) {
            "$paramName must not escape the project directory. Received: '$relativePath'"
        }

        // Reconstruction part par part — input jamais passé directement
        var resolvedPath = basePath
        relativePath.split("/", "\\")
            .filter { it.isNotEmpty() }
            .forEach { part -> resolvedPath = resolvedPath.resolve(part) }

        return resolvedPath.normalize()
    }
}


Le problème : la JVM impose une limite de 64 Ko par méthode compilée. L'enum généré par Lokalise atteignait ~4 285 constantes, ce qui forçait javac à générer un <clinit> de ~127 Ko rien que pour les instanciations → error: code too large.
La tentative intermédiaire (batch fr/en dans des initN()) ne suffisait pas : elle réduisait bien ces méthodes à ~6 Ko chacune, mais le <clinit> de l'enum lui-même instanciait encore 4 285 objets avec un seul argument → ~81 Ko → toujours au-dessus de 64 Ko.
La solution retenue : pattern Map lookup dans une inner class Translations. Le constructeur de l'enum ne prend que la clé, et délègue à Translations.FR.get(key) pour récupérer fr/en. Les Maps sont peuplées par des méthodes init0(), init1(), ... de ~200 paires chacune (~6 Ko), appelées depuis le <clinit> de Translations qui est totalement distinct de celui de l'enum. Les champs fr et en restent public final — aucune régression d'API. Le code consommateur n'est pas touché.