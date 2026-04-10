@InputFile
fun getTranslationsFile(): File {
    val basePath = project.projectDir.toPath().toAbsolutePath().normalize()

    require(!Paths.get(translationsFilePath).isAbsolute) {
        "translationsFilePath must be a relative path. Received: '$translationsFilePath'"
    }

    val resolvedPath = basePath.resolve(translationsFilePath).normalize()

    require(resolvedPath.startsWith(basePath)) {
        "translationsFilePath must not escape the project directory."
    }

    return resolvedPath.toFile()
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