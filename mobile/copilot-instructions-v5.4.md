# Copilot Instructions

## Repository Scope

Kotlin Multiplatform project targeting **Android** and **iOS** only.

**Modules:**
- `shared/` (**Kore**) — KMP shared business logic, Kotlin DSL
- `androidApp/` — Android UI shell, Kotlin DSL
- `iosApp/` — Xcode app (not Gradle)
- `iosApp/DGAG-Ajusto-Core/` (**Core**) — Git submodule, read-only. Legacy Java + J2objc bridge. Do not suggest modifications to it.

⚠️ **Core ≠ Kore.** Never confuse them. Core is legacy Java being retired. Kore is the active KMP module.

**Packages:**
- Legacy active: `ca.dgag.ajusto` (coupled to manifest, deep links, IDs)
- Target for new code: `com.desjardins.assurancedommages.mobile`
- Do not mass-rename existing packages — it is not a trivial change.

**Stack:** Kotlin Coroutines/Flow · Kodein-DI · Ktor · kotlinx.serialization · Napier (shared) · Timber (Android) · Compose (Android) · SwiftUI/UIKit (iOS).

Prefer **small, local changes** over broad rewrites.

---

## Global Priorities

- Follow the **existing conventions, architecture, and UI stack** of the module you are editing.
- Do not trigger opportunistic migrations unless explicitly requested.
- When ambiguous, prefer: **KMP-safe** → **shared logic in `commonMain`** → **minimal testable change**.
- No TODO comments. Follow the existing package conventions of the area modified.

---

## Shared Architecture and KMP Rules

Follow the architecture already in place:
- **Clean Architecture** + **MVVM**
- **ViewState / Action / Reaction** pattern where applicable
- Data flow: `UI → ViewModel → Repository → Data Source`

When working in shared features, align with:
- `BaseViewModel<ViewState, Action, Reaction>`
- `BaseViewStatesProvider<ViewState, CompoundData>`
- `BaseRepository<CompoundData>`

Architecture rules:
- `CompoundData` = ViewModel-level state · `ViewState` = UI-facing state
- Repositories expose interfaces when appropriate
- Use mappers between layers when crossing boundaries
- Do not hardcode dependencies; use DI

**Dependency injection:** Kodein-DI via `by di.instance()` / `di.direct.instance()`. Shared modules in `shared/`, Android bindings in `androidApp/`. **Koin is NOT installed — do not suggest it.**

**KMP-critical:**
- `shared/src/commonMain/` must be platform-agnostic
- Never import `android.*`, `java.*`, `javax.*` in `commonMain`
- Use `expect`/`actual` only when necessary; keep APIs minimal and stable
- Do not branch on platform inside shared logic unless an existing pattern does

**Concurrency:**
- Kotlin Coroutines with structured concurrency
- `StateFlow` for observable state · `SharedFlow` for one-shot events
- `@NativeCoroutinesState` for iOS interop where the existing pattern uses it
- Never `GlobalScope` · Never thread-blocking APIs in shared code

---

## Kotlin and Shared Code Style

- Prefer Kotlin for new code; no new Java unless integrating existing Java areas
- Prefer `val` over `var` · Prefer immutable collections and models where practical
- Avoid nullable types unless modeling a real absence or required by an API boundary
- Use `data class`, `sealed class`, `sealed interface`, and `value class` when they improve clarity
- Use sealed hierarchies for `Action`, `Reaction`, and `ViewState`
- Prefer expression bodies for simple functions and concise, expression-oriented Kotlin
- Use named arguments for constructors or functions with 3 or more parameters when it improves readability
- No reflection or platform-specific hacks in shared code

---

## Android Rules

- New UI: **Jetpack Compose**. Legacy XML/Fragment areas: follow the existing stack, do not force a migration.
- No business logic in composables · State hoisting + UDF
- Shared ViewModels must not depend on Android
- When a feature already uses `BaseKoreActivity<...>`, align with it instead of introducing parallel patterns

**Legacy Android reality — do not suggest removing or replacing:**
- Glide (legacy/kapt) and Coil (Compose) coexist — both are intentional
- RxJava2 is a direct dependency used by Core bridges

---

## iOS Rules

- New UI: **SwiftUI** in `iosApp/App/Modern/`. Legacy UIKit/coordinator flows: integrate, do not force a migration.
- Views must be stateless and driven by observable state
- No business logic, networking, or persistence in the iOS UI layer
- iOS platform implementations belong in iOS-specific code, not in shared modules
- iOS code adapts shared (Kore) APIs — do not reimplement shared business logic
- Do not manage coroutines directly inside SwiftUI views
- Do not place Swift code in shared modules

**iOS nuance:** `Legacy/` iOS code imports **both** `DGAG_Kore` (20+ files) and `DGAG-Ajusto-Core`. `Modern/` iOS does **not** import `DGAG_Kore` directly — it uses Domain abstractions.

⚠️ Changes to `shared/` public APIs affect **both Legacy and Modern** iOS — call out the impact.

---

## Networking, Serialization and Generated Code

- Shared networking: **Ktor** · Serialization: **kotlinx.serialization**
- Do not introduce Retrofit, Gson, or Moshi as new shared defaults
- **Retrofit** is declared in `libs.versions.toml` but has zero imports in source — it is a residual entry, do not use it
- Local database is encrypted with **SQLCipher** — do not suggest plain Room/SQLite
- **Chucker** is a debug-only HTTP inspector (release = noop) — do not activate it outside debug builds
- Keep DTOs and transport models separate from domain models
- **Lokalise pipeline** owns all translation strings — it generates Kotlin enums in `shared/src/commonMain/kotlin/generated-src/`
- **Never** manually edit files in generated folders (`generated-src/`, `generated-objc/`, `src-generated/`); follow the Lokalise pipeline for string changes

---

## Testing and Error Handling

**Testing priorities:**
- Prefer tests in the most shared layer: `shared/src/commonTest/` for shared business logic
- Use platform-specific tests only when platform behavior must be validated

**Testing conventions:**
- Kotlin test names with backticks: `` `descriptive test name`() ``
- `kotlinx-coroutines-test` + `runTest` for coroutine-based tests
- `MockK` for Android tests where mocking is needed
- Test ViewModels by validating `StateFlow` state evolution and emitted reactions

**Error handling:**
- Prefer `Result`, sealed error types, or domain-specific failure models
- Avoid throwing exceptions for control flow

**Logging:**
- Use `Napier` in shared code (`commonMain`) — never `Timber` in shared code
- Use `Timber` in Android-only code
- Never use `println()` or `System.out`

---

## Safety

- Never commit secrets or keystores (`androidApp/keystore/` is sensitive)
- Do not edit `AndroidManifest.xml` without explicitly considering manifest and package coupling impact
- Do not edit generated folders — they will be overwritten by the pipeline

---

## Expected Output

Generated code should be:
- Idiomatic for the language and layer being edited
- Consistent with the existing module conventions
- Multiplatform-safe when written in shared code
- Testable · Production-ready
- Minimal in scope unless a broader change is explicitly requested
