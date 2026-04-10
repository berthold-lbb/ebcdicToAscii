
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