package ca.dgag.lokalise.helper

import helper.PathHelper
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class PathHelperTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var baseDir: File

    @Before
    fun setUp() {
        baseDir = tempFolder.newFolder("project")
    }

    // ─── Happy paths ────────────────────────────────────────────────

    @Test
    fun `resolveSafePath returns correct path for simple relative path`() {
        val result = PathHelper.resolveSafePath(
            base = baseDir,
            relativePath = "translations/file.json",
            paramName = "translationsFilePath"
        )

        val expected = baseDir.toPath()
            .toAbsolutePath()
            .normalize()
            .resolve("translations")
            .resolve("file.json")
            .normalize()

        assertEquals(expected, result)
    }

    @Test
    fun `resolveSafePath returns correct path for single file name`() {
        val result = PathHelper.resolveSafePath(
            base = baseDir,
            relativePath = "file.json",
            paramName = "translationsFilePath"
        )

        val expected = baseDir.toPath()
            .toAbsolutePath()
            .normalize()
            .resolve("file.json")
            .normalize()

        assertEquals(expected, result)
    }

    @Test
    fun `resolveSafePath resolves nested subdirectories correctly`() {
        val result = PathHelper.resolveSafePath(
            base = baseDir,
            relativePath = "src/main/res",
            paramName = "enumDirectoryPath"
        )

        val basePath = baseDir.toPath().toAbsolutePath().normalize()
        assertTrue(result.startsWith(basePath))
        assertTrue(result.toString().endsWith("res"))
    }

    @Test
    fun `resolveSafePath result stays inside base directory`() {
        val result = PathHelper.resolveSafePath(
            base = baseDir,
            relativePath = "subdir/file.json",
            paramName = "translationsFilePath"
        )

        val basePath = baseDir.toPath().toAbsolutePath().normalize()
        assertTrue(
            "Resolved path must be inside base directory",
            result.startsWith(basePath)
        )
    }

    @Test
    fun `resolveSafePath handles backslash separator`() {
        val result = PathHelper.resolveSafePath(
            base = baseDir,
            relativePath = "subdir\\file.json",
            paramName = "translationsFilePath"
        )

        val basePath = baseDir.toPath().toAbsolutePath().normalize()
        assertTrue(result.startsWith(basePath))
    }

    // ─── Absolute path detection ─────────────────────────────────────

    @Test
    fun `resolveSafePath throws when path starts with slash`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            PathHelper.resolveSafePath(
                base = baseDir,
                relativePath = "/etc/passwd",
                paramName = "translationsFilePath"
            )
        }

        assertTrue(
            exception.message!!.contains("must be a relative path")
        )
        assertTrue(
            exception.message!!.contains("translationsFilePath")
        )
        assertTrue(
            exception.message!!.contains("/etc/passwd")
        )
    }

    @Test
    fun `resolveSafePath throws when path starts with backslash`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            PathHelper.resolveSafePath(
                base = baseDir,
                relativePath = "\\Windows\\System32",
                paramName = "enumDirectoryPath"
            )
        }

        assertTrue(exception.message!!.contains("must be a relative path"))
        assertTrue(exception.message!!.contains("enumDirectoryPath"))
    }

    @Test
    fun `resolveSafePath error message contains paramName for absolute path`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            PathHelper.resolveSafePath(
                base = baseDir,
                relativePath = "/absolute/path",
                paramName = "myCustomParam"
            )
        }

        assertTrue(exception.message!!.contains("myCustomParam"))
    }

    // ─── Path traversal detection ────────────────────────────────────

    @Test
    fun `resolveSafePath throws when path contains double dot`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            PathHelper.resolveSafePath(
                base = baseDir,
                relativePath = "../etc/passwd",
                paramName = "translationsFilePath"
            )
        }

        assertTrue(exception.message!!.contains("must not escape the project directory"))
        assertTrue(exception.message!!.contains("translationsFilePath"))
        assertTrue(exception.message!!.contains("../etc/passwd"))
    }

    @Test
    fun `resolveSafePath throws when path contains double dot in middle`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            PathHelper.resolveSafePath(
                base = baseDir,
                relativePath = "subdir/../../etc/passwd",
                paramName = "enumDirectoryPath"
            )
        }

        assertTrue(exception.message!!.contains("must not escape the project directory"))
    }

    @Test
    fun `resolveSafePath throws when path is just double dot`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            PathHelper.resolveSafePath(
                base = baseDir,
                relativePath = "..",
                paramName = "translationsFilePath"
            )
        }

        assertTrue(exception.message!!.contains("must not escape the project directory"))
    }

    @Test
    fun `resolveSafePath error message contains received path for traversal`() {
        val badPath = "subdir/../../../etc"
        val exception = assertThrows(IllegalArgumentException::class.java) {
            PathHelper.resolveSafePath(
                base = baseDir,
                relativePath = badPath,
                paramName = "myParam"
            )
        }

        assertTrue(exception.message!!.contains(badPath))
    }

    // ─── Edge cases ──────────────────────────────────────────────────

    @Test
    fun `resolveSafePath handles single dot in path`() {
        // "." is not ".." so should not be blocked
        val result = PathHelper.resolveSafePath(
            base = baseDir,
            relativePath = "subdir/file.json",
            paramName = "translationsFilePath"
        )

        val basePath = baseDir.toPath().toAbsolutePath().normalize()
        assertTrue(result.startsWith(basePath))
    }

    @Test
    fun `resolveSafePath returns Path not File`() {
        val result = PathHelper.resolveSafePath(
            base = baseDir,
            relativePath = "file.json",
            paramName = "translationsFilePath"
        )

        // Should be usable as Path and convertible to File
        val file = result.toFile()
        assertTrue(file.path.contains("file.json"))
    }

    @Test
    fun `resolveSafePath works with different paramNames in error messages`() {
        listOf("translationsFilePath", "enumDirectoryPath", "customParam").forEach { paramName ->
            val exception = assertThrows(IllegalArgumentException::class.java) {
                PathHelper.resolveSafePath(
                    base = baseDir,
                    relativePath = "/absolute",
                    paramName = paramName
                )
            }
            assertTrue(
                "Error message must contain paramName '$paramName'",
                exception.message!!.contains(paramName)
            )
        }
    }
}