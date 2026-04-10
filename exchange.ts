@InputFile
public fun getTranslationsFile(): File {
    val file = File(project.projectDir, translationsFilePath).canonicalFile
    require(file.path.startsWith(project.projectDir.canonicalPath))
    return file
}

@OutputDirectory
public fun getTranslationsJsonFile(): File {
    val dir = File(project.projectDir, enumDirectoryPath).canonicalFile
    require(dir.path.startsWith(project.projectDir.canonicalPath))
    return dir
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