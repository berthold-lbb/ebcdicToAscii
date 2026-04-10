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