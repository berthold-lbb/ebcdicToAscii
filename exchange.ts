
@InputFile
fun getTranslationsFile(): File {
    val basePath = project.projectDir.toPath()
        .toAbsolutePath()
        .normalize()

    // Validation pure String — aucune API Path/File avec l'input
    require(!translationsFilePath.startsWith("/") &&
            !translationsFilePath.startsWith("\\")) {
        "translationsFilePath must be a relative path."
    }
    require(!translationsFilePath.contains("..")) {
        "translationsFilePath must not escape the project directory."
    }

    // Reconstruction part par part — input jamais passé directement
    var resolvedPath = basePath
    translationsFilePath.split("/", "\\")
        .filter { it.isNotEmpty() }
        .forEach { part -> resolvedPath = resolvedPath.resolve(part) }

    return resolvedPath.normalize().toFile()
}

@OutputDirectory
fun getTranslationsJsonFile(): File {
    val basePath = project.projectDir.toPath().toAbsolutePath().normalize()

    require(!Paths.get(enumDirectoryPath).isAbsolute) {
        "enumDirectoryPath must be a relative path. Received: '$enumDirectoryPath'"
    }

    val resolvedPath = basePath.resolve(enumDirectoryPath).normalize()

    require(resolvedPath.startsWith(basePath)) {
        "enumDirectoryPath must not escape the project directory."
    }

    return resolvedPath.toFile()
}


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