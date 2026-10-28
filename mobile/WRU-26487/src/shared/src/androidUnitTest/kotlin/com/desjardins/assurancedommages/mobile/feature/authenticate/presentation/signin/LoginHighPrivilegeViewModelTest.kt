package com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.signin

import app.cash.turbine.test
import ca.dgag.ajusto.BaseTest
import ca.dgag.ajusto.kore.domain.state.UiStatesProvider
import ca.dgag.ajusto.kore.domain.state.find
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.LoginUiStateData
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.LoginUiStateError
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.datasource.ServiceUrlsDataSource
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.dto.TokenResponse
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.model.SessionTransferCookie
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.repository.GiaRepository
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.repository.HighPrivilegeTokenRepository
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.repository.LowPrivilegeTokenRepository
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.Screen
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.manager.AuthSessionManager
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.manager.TTLManager
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.model.HighPrivilegeTokenFetchException
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.model.RefreshTokenResult
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginHighPrivilegeViewModel
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginInitState
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginReaction
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginUiState
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginUiStatesProvider
import com.desjardins.assurancedommages.mobile.feature.webview.domain.WebViewEvents
import com.desjardins.assurancedommages.mobile.transverse.domain.accessmanager.AccessManager
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometricsException
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometricsRepository
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryError.HARDWARE_NOT_CONFIGURED
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryPromptContextType
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.unmockkAll
import io.mockk.verify
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Ignore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain

private fun loginRedirect(code: String) =
    WebViewEvents.LoginRedirect(code = code, error = null, errorDescription = null)

private fun loginRedirectError(errorDescription: String?) =
    WebViewEvents.LoginRedirect(code = null, error = "invalid_request", errorDescription = errorDescription)

@OptIn(ExperimentalCoroutinesApi::class)
class LoginHighPrivilegeViewModelTest : BaseTest() {
    // SUT - system under test
    private lateinit var viewModel: LoginHighPrivilegeViewModel

    // mocked
    private val giaRepository = mockk<GiaRepository>(relaxed = true)
    private val lowPrivilegeTokenRepository = mockk<LowPrivilegeTokenRepository>(relaxed = true)
    private val highPrivilegeTokenRepository = mockk<HighPrivilegeTokenRepository>(relaxed = true)
    private val biometricsRepository = mockk<BiometricsRepository>(relaxed = true)
    private val uiStatesProvider =
        mockk<UiStatesProvider<LoginUiState, LoginUiStateData>>(relaxed = true)
    private val securityManager = mockk<AuthSessionManager>(relaxed = true)
    private val serviceUrlsDataSource = mockk<ServiceUrlsDataSource>(relaxed = true)
    private val accessManager = mockk<AccessManager>(relaxed = true)
    private val ttlManager = mockk<TTLManager>(relaxed = true)

    private val testDispatcher = StandardTestDispatcher()

    @BeforeTest
    override fun initTest() {
        super.initTest()
        Dispatchers.setMain(testDispatcher)

        coEvery {
            highPrivilegeTokenRepository.fetchTokens(any(), any(), any(), any())
        } returns Result.success(mockk())

        coEvery {
            lowPrivilegeTokenRepository.forceRefreshAccessToken()
        } returns RefreshTokenResult.SUCCESS
        // Cas nominal: le courriel d'authentification est confirmé
        every { lowPrivilegeTokenRepository.isAuthenticationEmailVerified } returns true
        every { giaRepository.resolveOcsUrl(any()) } answers { firstArg() }

        // SUT
        viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithOcs(OCS_URL),
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )
    }

    @AfterTest
    fun tearDown() {
        unmockkAll()
        Dispatchers.resetMain()
    }

    @Ignore("fix this test when we get back to the STT - session transfer token")
    @Test
    fun `state udt with cookie when RedirectLoaded with ocsUrl and valid auth`() = runTest(testDispatcher) {
        val sessionToken = mockk<SessionTransferCookie> {
            every { isExpired() } returns false
            every { name } returns "cookie"
            every { value } returns "token"
        }
        coEvery { securityManager.authenticate("authCode") } returns null

        viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect("authCode"), ocsUrl = "ocsUrl"))

        advanceUntilIdle()
        assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
        assertEquals("ocsUrl", viewModel.uiStateDataFlow.value.urlToLoad)
        assertEquals("cookie=token", viewModel.uiStateDataFlow.value.sessionCookie)
    }

    @Test
    fun `handle NavToHelp resets error`() {
        viewModel.handleAction(LoginAction.WebviewError("make error == TECHNICAL_ERROR"))
        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
        viewModel.handleAction(LoginAction.NavToHelp)
        assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
    }

    @Test
    fun `handle DismissModal resets error`() {
        viewModel.handleAction(LoginAction.WebviewError("make error == TECHNICAL_ERROR"))
        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
        viewModel.handleAction(LoginAction.DismissModal())
        assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
    }

    @Test
    fun `handle Close does not mutate state`() {
        val before = viewModel.uiStateDataFlow.value
        viewModel.handleAction(LoginAction.Close)
        val after = viewModel.uiStateDataFlow.value
        assertEquals(before, after)
    }

    @Test
    fun `Given Close action Then Close reaction emitted`() = runTest(testDispatcher) {
        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(LoginAction.Close)
            advanceUntilIdle()
            assertEquals(LoginReaction.Close, awaitItem())
        }
    }

    @Test
    fun `Given DismissModal action Then Close reaction emitted`() = runTest(testDispatcher) {
        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(LoginAction.DismissModal())
            advanceUntilIdle()
            assertEquals(LoginReaction.Close, awaitItem())
        }
    }

    @Test
    fun `Given NavToHelp action Then NavTo CallSupport reaction emitted`() = runTest(testDispatcher) {
        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(LoginAction.NavToHelp)
            advanceUntilIdle()
            assertEquals(LoginReaction.NavTo(Screen.CallSupport), awaitItem())
        }
    }

    @Test
    fun `onCreate with HighPrivilegeWithoutOcs emits OpenAuthenticateUrl when low privilege refresh succeeds`() =
        runTest(testDispatcher) {
            coEvery { lowPrivilegeTokenRepository.forceRefreshAccessToken() } returns
                RefreshTokenResult.SUCCESS
            every { securityManager.getAuthorizeUrl(false) } returns TEST_URL

            val viewModel = LoginHighPrivilegeViewModel(
                giaRepository = giaRepository,
                lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
                highPrivilegeTokenRepository = highPrivilegeTokenRepository,
                biometricsRepository = biometricsRepository,
                uiStatesProvider = uiStatesProvider,
                sessionManager = securityManager,
                accessManager = accessManager,
                serviceUrlsDataSource = serviceUrlsDataSource,
                state = LoginInitState.HighPrivilegeWithoutOcs,
                ttlManager = ttlManager,
                dispatcher = testDispatcher
            )

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())
                viewModel.onCreate()
                advanceUntilIdle()
                assertEquals(LoginReaction.OpenLoginUrl(TEST_URL), awaitItem())
                coVerify(exactly = 1) { lowPrivilegeTokenRepository.forceRefreshAccessToken() }
            }
        }

    @Test
    fun `onCreate sets error and stops initialization when low privilege refresh fails`() = runTest(testDispatcher) {
        coEvery { lowPrivilegeTokenRepository.forceRefreshAccessToken() } returns
            RefreshTokenResult.FAILED

        every { securityManager.getAuthorizeUrl(false) } returns TEST_URL

        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithoutOcs,
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        viewModel.onCreate()
        advanceUntilIdle()

        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
        assertEquals("", viewModel.uiStateDataFlow.value.urlToLoad)
        assertEquals(LoginReaction.Nothing, viewModel.reactionStateFlow.value)

        coVerify(exactly = 1) { lowPrivilegeTokenRepository.forceRefreshAccessToken() }
        verify(exactly = 0) { securityManager.getAuthorizeUrl(false) }
    }

    @Test
    fun `onCreate shows AccountNotActivated and invalidates ttl when email is not verified`() = runTest {
        // Auth0 rafraîchit sans erreur, mais le courriel modifié n'est pas encore confirmé
        coEvery { lowPrivilegeTokenRepository.forceRefreshAccessToken() } returns RefreshTokenResult.SUCCESS
        every { lowPrivilegeTokenRepository.isAuthenticationEmailVerified } returns false
        every { ttlManager.isExpired() } returns false

        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithOcs(OCS_URL),
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        viewModel.onCreate()
        advanceUntilIdle()

        assertEquals(LoginUiStateError.AccountNotActivated(), viewModel.uiStateDataFlow.value.error)
        // Le TTL est invalidé pour que la bascule suivante repasse par l'URL d'autorisation
        verify(exactly = 1) { ttlManager.invalidate() }
        // Aucune ouverture des services en ligne tant que le courriel n'est pas confirmé
        assertEquals(LoginReaction.Nothing, viewModel.reactionStateFlow.value)
    }

    @Test
    fun `onCreate invalidates ttl when Auth0 rejects the unverified email`() = runTest {
        coEvery { lowPrivilegeTokenRepository.forceRefreshAccessToken() } returns
            RefreshTokenResult.EMAIL_NOT_VERIFIED

        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithOcs(OCS_URL),
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        viewModel.onCreate()
        advanceUntilIdle()

        assertEquals(LoginUiStateError.AccountNotActivated(), viewModel.uiStateDataFlow.value.error)
        verify(exactly = 1) { ttlManager.invalidate() }
    }

    @Test
    fun `OpenAuthenticateUrl emitted when ttl expired and low privilege refresh succeeds`() = runTest(testDispatcher) {
        coEvery { lowPrivilegeTokenRepository.forceRefreshAccessToken() } returns RefreshTokenResult.SUCCESS
        every { ttlManager.isExpired() } returns true
        every { securityManager.getAuthorizeUrl(false) } returns EXPIRED_URL

        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithOcs(REDIRECT_URL),
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.onCreate()
            advanceUntilIdle()
            assertEquals(LoginReaction.OpenLoginUrl(EXPIRED_URL), awaitItem())
            coVerify(exactly = 1) { lowPrivilegeTokenRepository.forceRefreshAccessToken() }
        }
    }

    @Test
    fun `onCreate with ttl expired and biometrics enabled emits GetRefreshTokenWithBiometrics`() =
        runTest(testDispatcher) {
            coEvery { lowPrivilegeTokenRepository.forceRefreshAccessToken() } returns RefreshTokenResult.SUCCESS
            every { ttlManager.isExpired() } returns true
            every { biometricsRepository.isBiometricsEnabledOnApp() } returns true

            val viewModel = LoginHighPrivilegeViewModel(
                giaRepository = giaRepository,
                lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
                highPrivilegeTokenRepository = highPrivilegeTokenRepository,
                biometricsRepository = biometricsRepository,
                uiStatesProvider = uiStatesProvider,
                sessionManager = securityManager,
                accessManager = accessManager,
                serviceUrlsDataSource = serviceUrlsDataSource,
                state = LoginInitState.HighPrivilegeWithOcs(REDIRECT_URL),
                ttlManager = ttlManager,
                dispatcher = testDispatcher
            )

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())
                viewModel.onCreate()
                advanceUntilIdle()
                assertEquals(
                    LoginReaction.GetRefreshTokenWithBiometrics(url = REDIRECT_URL),
                    awaitItem()
                )
            }
        }

    @Test
    fun `onCreate with HighPrivilegeWithOcs and TTL not expired emits OpenOcs when low privilege refresh succeeds`() =
        runTest(testDispatcher) {
            coEvery { lowPrivilegeTokenRepository.forceRefreshAccessToken() } returns RefreshTokenResult.SUCCESS
            every { ttlManager.isExpired() } returns false

            val viewModel = LoginHighPrivilegeViewModel(
                giaRepository = giaRepository,
                lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
                highPrivilegeTokenRepository = highPrivilegeTokenRepository,
                biometricsRepository = biometricsRepository,
                uiStatesProvider = uiStatesProvider,
                sessionManager = securityManager,
                accessManager = accessManager,
                serviceUrlsDataSource = serviceUrlsDataSource,
                state = LoginInitState.HighPrivilegeWithOcs(REDIRECT_URL),
                ttlManager = ttlManager,
                dispatcher = testDispatcher
            )

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())
                viewModel.onCreate()
                advanceUntilIdle()
                assertEquals(LoginReaction.OpenOcs(REDIRECT_URL), awaitItem())
                coVerify(exactly = 1) { lowPrivilegeTokenRepository.forceRefreshAccessToken() }
            }
        }

    // Le test et le ViewModel partagent le meme ordonnanceur de coroutines.
    @Test
    fun `onCreate resolves firebase id in OCS url`() = runTest(testDispatcher) {
        val unresolvedUrl = "$OCS_URL?firebase_id={firebase_id}"
        val resolvedUrl = "$OCS_URL?firebase_id=test-firebase-id"
        every { giaRepository.resolveOcsUrl(unresolvedUrl) } returns resolvedUrl
        every { ttlManager.isExpired() } returns false

        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithOcs(unresolvedUrl),
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )
        verify(exactly = 0) { giaRepository.resolveOcsUrl(unresolvedUrl) }

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.onCreate()
            advanceUntilIdle()
            assertEquals(LoginReaction.OpenOcs(resolvedUrl), awaitItem())
        }
        verify(exactly = 1) { giaRepository.resolveOcsUrl(unresolvedUrl) }
    }

    @Test
    fun `error when setHighPrivRefreshTokenWithBiometrics fails`() = runTest(testDispatcher) {
        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithoutOcs,
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        coEvery {
            highPrivilegeTokenRepository.setRefreshTokenWithBiometrics(any(), any(), any())
        } returns Result.failure(Exception("Erreur attendue"))

        viewModel.handleAction(
            LoginAction.SaveRefreshTokenWithBiometrics(
                refreshToken = REFRESH_TOKEN,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )
        advanceUntilIdle()
        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
    }

    @Test
    fun `show manual when biometry fails during GetRefreshTokenWithBiometrics`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns
            Result.failure(
                BiometricsException(BiometryProtectedStorage.BiometryError.VERIFICATION_FAILED)
            )

        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )
        advanceUntilIdle()

        assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)
    }

    // WRU-25865 : cle perimee -> on propose la connexion manuelle, qui resauvegardera le jeton en
    // biometrie et regenerera la cle. La preference reste volontairement active.
    @Test
    fun `show manual when key invalidated during GetRefreshTokenWithBiometrics`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns
            Result.failure(
                BiometricsException(BiometryProtectedStorage.BiometryError.KEY_INVALIDATED)
            )

        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )
        advanceUntilIdle()

        assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)
        verify(exactly = 0) { biometricsRepository.setBiometricsEnabledOnApp(false) }
    }

    // WRU-26487 : l'invite de lecture echoue, puis l'utilisateur se connecte avec courriel + mot de passe.
    private fun stubBiometricsFailureThenValidLogin(error: BiometryProtectedStorage.BiometryError) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.failure(BiometricsException(error))
        coEvery {
            highPrivilegeTokenRepository.fetchTokens(authorizationCode = any(), codeVerifier = any())
        } returns Result.success(
            TokenResponse(
                accessToken = ACCESS_TOKEN,
                refreshToken = REFRESH_TOKEN,
                expiresIn = 10,
                issuedTokenType = "issued-token-type"
            )
        )
        every { biometricsRepository.isBiometricsEnabledOnApp() } returns true
    }

    // WRU-26487 : annulation de l'invite -> le login manuel ouvre l'OCS sans reecrire le jeton (pas de 2e invite)
    @Test
    fun `emit OpenOcs when RedirectLoaded after biometrics prompt was canceled`() = runTest(testDispatcher) {
        stubBiometricsFailureThenValidLogin(BiometryProtectedStorage.BiometryError.USER_CANCELED)

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(
                LoginAction.GetRefreshTokenWithBiometrics(
                    OCS_URL,
                    contextType = BiometryPromptContextType.IOS,
                    contextReference = REF
                )
            )
            advanceUntilIdle()
            assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)

            viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))

            assertEquals(LoginReaction.OpenOcs(OCS_URL), awaitItem())
            cancelAndIgnoreRemainingEvents()
            viewModel.onDestroy()
        }
    }

    // WRU-26487 : echec de l'invite (empreinte non reconnue...) -> meme comportement que l'annulation
    @Test
    fun `emit OpenOcs when RedirectLoaded after biometrics prompt failed`() = runTest(testDispatcher) {
        stubBiometricsFailureThenValidLogin(BiometryProtectedStorage.BiometryError.VERIFICATION_FAILED)

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(
                LoginAction.GetRefreshTokenWithBiometrics(
                    OCS_URL,
                    contextType = BiometryPromptContextType.IOS,
                    contextReference = REF
                )
            )
            advanceUntilIdle()
            assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)

            viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))

            assertEquals(LoginReaction.OpenOcs(OCS_URL), awaitItem())
            cancelAndIgnoreRemainingEvents()
            viewModel.onDestroy()
        }
    }

    // WRU-26487 : non-regression -> stockage invalide : le jeton doit etre reecrit apres le login manuel
    @Test
    fun `emit RefreshTokenFetchedWithoutOcs when RedirectLoaded after invalid biometrics storage`() =
        runTest(testDispatcher) {
            stubBiometricsFailureThenValidLogin(BiometryProtectedStorage.BiometryError.INVALID_STORAGE)

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())
                viewModel.handleAction(
                    LoginAction.GetRefreshTokenWithBiometrics(
                        OCS_URL,
                        contextType = BiometryPromptContextType.IOS,
                        contextReference = REF
                    )
                )
                advanceUntilIdle()
                assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)

                viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))

                assertEquals(
                    LoginReaction.RefreshTokenFetchedWithoutOcs(
                        refreshToken = REFRESH_TOKEN,
                        ocsUrlToOpen = OCS_URL
                    ),
                    awaitItem()
                )
                cancelAndIgnoreRemainingEvents()
                viewModel.onDestroy()
            }
        }

    // WRU-26487 : non-regression -> cle perimee : le jeton doit etre reecrit apres le login manuel
    @Test
    fun `emit RefreshTokenFetchedWithoutOcs when RedirectLoaded after biometrics key invalidated`() =
        runTest(testDispatcher) {
            stubBiometricsFailureThenValidLogin(BiometryProtectedStorage.BiometryError.KEY_INVALIDATED)

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())
                viewModel.handleAction(
                    LoginAction.GetRefreshTokenWithBiometrics(
                        OCS_URL,
                        contextType = BiometryPromptContextType.IOS,
                        contextReference = REF
                    )
                )
                advanceUntilIdle()
                assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)

                viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))

                assertEquals(
                    LoginReaction.RefreshTokenFetchedWithoutOcs(
                        refreshToken = REFRESH_TOKEN,
                        ocsUrlToOpen = OCS_URL
                    ),
                    awaitItem()
                )
                cancelAndIgnoreRemainingEvents()
                viewModel.onDestroy()
            }
        }

    // WRU-26487 : un ancien refus ne doit pas empêcher de remplacer un jeton ensuite refusé par le serveur.
    @Test
    fun `save new token after canceled prompt then unauthorized biometric retry in same instance`() =
        runTest(testDispatcher) {
            stubBiometricsFailureThenValidLogin(BiometryProtectedStorage.BiometryError.USER_CANCELED)
            val biometricsAction = LoginAction.GetRefreshTokenWithBiometrics(
                url = OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())

                // Première tentative : l'annulation mémorise le refus.
                viewModel.handleAction(biometricsAction)
                advanceUntilIdle()
                assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)
                viewModel.handleAction(LoginAction.ManualLoginCancel)
                assertEquals(null, viewModel.uiStateDataFlow.value.error)

                // Même instance : la lecture réussit, mais le serveur refuse le jeton stocké.
                coEvery {
                    highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
                } returns Result.success(REFRESH_TOKEN)
                coEvery {
                    highPrivilegeTokenRepository.fetchTokens(
                        authorizationCode = "",
                        codeVerifier = "",
                        isSessionTransferToken = true,
                        refreshToken = REFRESH_TOKEN
                    )
                } returns Result.failure(HighPrivilegeTokenFetchException.Unauthorized())

                viewModel.handleAction(biometricsAction)
                advanceUntilIdle()
                coVerify(exactly = 2) {
                    highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
                }
                coVerify(exactly = 1) {
                    highPrivilegeTokenRepository.fetchTokens("", "", true, REFRESH_TOKEN)
                }
                assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)

                // La connexion manuelle doit demander la sauvegarde, et non ouvrir directement l'OCS.
                viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))
                assertEquals(
                    LoginReaction.RefreshTokenFetchedWithoutOcs(
                        refreshToken = REFRESH_TOKEN,
                        ocsUrlToOpen = OCS_URL
                    ),
                    awaitItem()
                )
                cancelAndIgnoreRemainingEvents()
                viewModel.onDestroy()
            }
        }

    @Test
    fun `set error when biometry returns non recoverable biometrics exception`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.failure(BiometricsException(HARDWARE_NOT_CONFIGURED))

        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )
        advanceUntilIdle()

        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
        assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.ManualConnection())
    }

    @Test
    fun `ensure error when biometry error during GetRefreshTokenWithBiometrics`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.failure(Exception("Erreur attendue"))

        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                "url",
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )
        advanceUntilIdle()

        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
    }

    @Test
    fun `error when read biometry succeeds but refresh token empty`() = runTest(testDispatcher) {
        // arrange
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.success("")

        // act
        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )

        // assert
        advanceUntilIdle()
        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
    }

    @Test
    fun `ensure no error when biometry succeeds during GetRefreshTokenWithBiometrics`() = runTest(testDispatcher) {
        // arrange
        val biometricRefreshToken = REFRESH_TOKEN
        val sessionTransferRefreshToken = STT
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.success(biometricRefreshToken)

        val response = TokenResponse(
            accessToken = ACCESS_TOKEN,
            refreshToken = sessionTransferRefreshToken,
            expiresIn = 10,
            issuedTokenType = SESSION_TX_TYPE
        )
        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = "",
                codeVerifier = "",
                isSessionTransferToken = true,
                refreshToken = biometricRefreshToken
            )
        } returns Result.success(response)

        val sessionTransferCookie = mockk<SessionTransferCookie> {
            every { name } returns COOKIE_NAME
            every { value } returns ACCESS_TOKEN
            every { domain } returns DOMAIN
        }
        every { giaRepository.createSessionTransferCookie(value = ACCESS_TOKEN, expiresIn = 10) } returns
            sessionTransferCookie

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(
                LoginAction.GetRefreshTokenWithBiometrics(
                    OCS_URL,
                    contextType = BiometryPromptContextType.IOS,
                    contextReference = REF
                )
            )

            advanceUntilIdle()
            val reaction = assertIs<LoginReaction.OpenOcsWithSessionTransfer>(awaitItem())
            assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
            assertEquals(OCS_URL, reaction.url)
            assertEquals(sessionTransferRefreshToken, reaction.refreshToken)
            assertTrue(reaction.refreshToken != biometricRefreshToken)
            assertEquals(COOKIE_NAME, reaction.sessionTransferCookie.name)
            assertEquals(ACCESS_TOKEN, reaction.sessionTransferCookie.value)
            assertEquals(DOMAIN, reaction.sessionTransferCookie.domain)
            coVerify {
                highPrivilegeTokenRepository.fetchTokens(
                    any(),
                    any(),
                    isSessionTransferToken = true,
                    any()
                )
            }
            verify { giaRepository.createSessionTransferCookie(value = ACCESS_TOKEN, expiresIn = 10) }
            verify { ttlManager.reset() }
        }
    }

    @Test
    fun `error when session transfer token response refresh token is empty`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.success(REFRESH_TOKEN)

        val response = TokenResponse(
            accessToken = ACCESS_TOKEN,
            refreshToken = "",
            expiresIn = 10,
            issuedTokenType = SESSION_TX_TYPE
        )

        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = "",
                codeVerifier = "",
                isSessionTransferToken = true,
                refreshToken = REFRESH_TOKEN
            )
        } returns Result.success(response)

        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )

        advanceUntilIdle()

        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
        assertEquals(LoginReaction.Nothing, viewModel.reactionStateFlow.value)
        verify(exactly = 0) { ttlManager.reset() }
    }

    @Test
    fun `error when session transfer token response access token is empty`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.success(REFRESH_TOKEN)

        val response = TokenResponse(
            accessToken = "",
            refreshToken = REFRESH_TOKEN,
            expiresIn = 10,
            issuedTokenType = SESSION_TX_TYPE
        )

        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = "",
                codeVerifier = "",
                isSessionTransferToken = true,
                refreshToken = REFRESH_TOKEN
            )
        } returns Result.success(response)

        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )

        advanceUntilIdle()

        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
        assertEquals(LoginReaction.Nothing, viewModel.reactionStateFlow.value)
        verify(exactly = 0) { ttlManager.reset() }
    }

    @Test
    fun `error when session transfer token response issued type is invalid`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.success(REFRESH_TOKEN)

        val response = TokenResponse(
            accessToken = ACCESS_TOKEN,
            refreshToken = REFRESH_TOKEN,
            expiresIn = 10,
            issuedTokenType = "invalid-issued-token-type"
        )

        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = "",
                codeVerifier = "",
                isSessionTransferToken = true,
                refreshToken = REFRESH_TOKEN
            )
        } returns Result.success(response)

        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )

        advanceUntilIdle()

        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
        verify(exactly = 0) { ttlManager.reset() }
    }

    @Test
    fun `show manual connection modal when session transfer token fetch is unauthorized`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
        } returns Result.success(REFRESH_TOKEN)
        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = "",
                codeVerifier = "",
                isSessionTransferToken = true,
                refreshToken = REFRESH_TOKEN
            )
        } returns Result.failure(HighPrivilegeTokenFetchException.Unauthorized())

        viewModel.handleAction(
            LoginAction.GetRefreshTokenWithBiometrics(
                OCS_URL,
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )

        advanceUntilIdle()

        assertEquals(LoginUiStateError.ManualConnection(), viewModel.uiStateDataFlow.value.error)
        assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
        assertEquals(LoginReaction.Nothing, viewModel.reactionStateFlow.value)
        verify(exactly = 0) { ttlManager.reset() }
    }

    @Test
    fun `set error when session transfer token fetch fails with unexpected high privilege exception`() =
        runTest(testDispatcher) {
            // Cette branche vérifie le traitement explicite d'une erreur inattendue.
            coEvery {
                highPrivilegeTokenRepository.getRefreshTokenFromBiometrics(any(), any())
            } returns Result.success(REFRESH_TOKEN)
            coEvery {
                highPrivilegeTokenRepository.fetchTokens(
                    authorizationCode = "",
                    codeVerifier = "",
                    isSessionTransferToken = true,
                    refreshToken = REFRESH_TOKEN
                )
            } returns Result.failure(HighPrivilegeTokenFetchException.UnexpectedFailure("expected failure"))

            viewModel.handleAction(
                LoginAction.GetRefreshTokenWithBiometrics(
                    OCS_URL,
                    contextType = BiometryPromptContextType.IOS,
                    contextReference = REF
                )
            )

            advanceUntilIdle()

            assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
            assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.ManualConnection())
        }

    @Test
    fun `manual login action opens login url`() = runTest(testDispatcher) {
        every { securityManager.getAuthorizeUrl(false) } returns TEST_URL

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(LoginAction.ManualLogin(url = TEST_URL))
            advanceUntilIdle()
            assertEquals(LoginReaction.OpenLoginUrl(TEST_URL), awaitItem())
            assertEquals(TEST_URL, viewModel.uiStateDataFlow.value.urlToLoad)
            assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.ManualConnection())
        }
    }

    @Test
    fun `save refresh token failure still opens ocs when url exists and error is not verification failed`() =
        runTest(testDispatcher) {
            coEvery {
                highPrivilegeTokenRepository.setRefreshTokenWithBiometrics(any(), any(), any())
            } returns Result.failure(BiometricsException(HARDWARE_NOT_CONFIGURED))

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())
                viewModel.handleAction(
                    LoginAction.SaveRefreshTokenWithBiometrics(
                        refreshToken = REFRESH_TOKEN,
                        contextType = BiometryPromptContextType.IOS,
                        contextReference = REF,
                        ocsUrlToOpen = OCS_URL
                    )
                )
                advanceUntilIdle()
                assertEquals(LoginReaction.OpenOcs(OCS_URL), awaitItem())
                assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
            }
        }

    @Test
    fun `emit Close when save refresh token to biometry succeeds`() = runTest(testDispatcher) {
        // arrange
        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithoutOcs,
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        coEvery {
            highPrivilegeTokenRepository.setRefreshTokenWithBiometrics(any(), any(), any())
        } returns Result.success(Unit)

        // act
        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(
                LoginAction.SaveRefreshTokenWithBiometrics(
                    refreshToken = REFRESH_TOKEN,
                    contextType = BiometryPromptContextType.IOS,
                    contextReference = REF
                )
            )
            advanceUntilIdle()
            assertEquals(LoginReaction.Close, awaitItem())
            verify { biometricsRepository.setBiometricsEnabledOnApp(true) }
            assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
        }
    }

    @Test
    fun `handle SaveRefreshTokenWithBiometrics when refreshToken is empty sets error`() = runTest(testDispatcher) {
        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithoutOcs,
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        viewModel.handleAction(
            LoginAction.SaveRefreshTokenWithBiometrics(
                refreshToken = "",
                contextType = BiometryPromptContextType.IOS,
                contextReference = REF
            )
        )
        advanceUntilIdle()
        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
    }

    @Test
    fun `save refresh token then open OCS when state is HighPrivilegeWithOcs and url is provided`() =
        runTest(testDispatcher) {
            coEvery {
                highPrivilegeTokenRepository.setRefreshTokenWithBiometrics(any(), any(), any())
            } returns Result.success(Unit)

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())
                viewModel.handleAction(
                    LoginAction.SaveRefreshTokenWithBiometrics(
                        refreshToken = REFRESH_TOKEN,
                        contextType = BiometryPromptContextType.IOS,
                        contextReference = REF,
                        ocsUrlToOpen = OCS_URL
                    )
                )
                advanceUntilIdle()
                coVerify(exactly = 1) {
                    highPrivilegeTokenRepository.setRefreshTokenWithBiometrics(any(), any(), any())
                }
                verify(exactly = 0) { biometricsRepository.setBiometricsEnabledOnApp(true) }
                assertEquals(LoginReaction.OpenOcs(OCS_URL), awaitItem())
                assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
            }
        }

    @Test
    fun `open OCS when save refresh token fails during HighPrivilegeWithOcs flow`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.setRefreshTokenWithBiometrics(any(), any(), any())
        } returns Result.failure(BiometricsException(BiometryProtectedStorage.BiometryError.VERIFICATION_FAILED))

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            viewModel.handleAction(
                LoginAction.SaveRefreshTokenWithBiometrics(
                    refreshToken = REFRESH_TOKEN,
                    contextType = BiometryPromptContextType.IOS,
                    contextReference = REF,
                    ocsUrlToOpen = OCS_URL
                )
            )
            advanceUntilIdle()
            assertEquals(LoginReaction.OpenOcs(OCS_URL), awaitItem())
            assertNotEquals(viewModel.uiStateDataFlow.value.error, LoginUiStateError.TechnicalError())
        }
    }

    @Ignore("Sporadically fails on CI, but always passes locally")
    @Test
    fun `handle RedirectLoaded when fetchTokens fails sets error`() = runTest(testDispatcher) {
        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = any(),
                codeVerifier = any()
            )
        } returns Result.failure(Exception("Erreur attendue"))

        viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))
        advanceUntilIdle()
        assertEquals(LoginUiStateError.TechnicalError(), viewModel.uiStateDataFlow.value.error)
    }

    @Ignore("fails sporadically on CI - always passes locally")
    @Test
    fun `handle RedirectLoaded when fetchTokens returns empty string sets error`() = runTest(testDispatcher) {
        // assemble
        val response = TokenResponse(
            accessToken = "",
            refreshToken = "",
            expiresIn = 10,
            issuedTokenType = ""
        )
        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = any(),
                codeVerifier = any()
            )
        } returns Result.success(response)

        viewModel.handleAction(
            LoginAction.RedirectLoaded(
                redirect = loginRedirect(AUTH_CODE),
                ocsUrl = OCS_URL
            )
        )

        // assert
        advanceUntilIdle()
        assertEquals(
            LoginUiStateError.TechnicalError(),
            viewModel.uiStateDataFlow.value.error,
            "Expected error to be TECHNICAL_ERROR"
        )
        try {
            verify(exactly = 0) { ttlManager.reset() }
        } catch (e: AssertionError) {
            println("ttlManager.reset() was called")
            throw e
        }
    }

    @Test
    fun `emit OpenOcs when RedirectLoaded received with valid token`() = runTest(testDispatcher) {
        // arrange
        val response = TokenResponse(
            accessToken = ACCESS_TOKEN,
            refreshToken = REFRESH_TOKEN,
            expiresIn = 10,
            issuedTokenType = "issued-token-type"
        )
        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = any(),
                codeVerifier = any()
            )
        } returns Result.success(response)
        every { biometricsRepository.isBiometricsEnabledOnApp() } returns false

        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithOcs(REDIRECT_URL),
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            // act - utilisation de la nouvelle signature RedirectLoaded
            viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), REDIRECT_URL))
            advanceUntilIdle()
            assertEquals(LoginReaction.OpenOcs(REDIRECT_URL), awaitItem())
            verify { ttlManager.reset() }
        }
    }

    @Test
    fun `emit RefreshTokenFetchedWithoutOcs when RedirectLoaded and biometrics enabled`() = runTest(testDispatcher) {
        // arrange
        val response = TokenResponse(
            accessToken = ACCESS_TOKEN,
            refreshToken = REFRESH_TOKEN,
            expiresIn = 10,
            issuedTokenType = "issued-token-type"
        )
        coEvery {
            highPrivilegeTokenRepository.fetchTokens(
                authorizationCode = any(),
                codeVerifier = any()
            )
        } returns Result.success(response)
        every { biometricsRepository.isBiometricsEnabledOnApp() } returns true

        val viewModel = LoginHighPrivilegeViewModel(
            giaRepository = giaRepository,
            lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
            highPrivilegeTokenRepository = highPrivilegeTokenRepository,
            biometricsRepository = biometricsRepository,
            uiStatesProvider = uiStatesProvider,
            sessionManager = securityManager,
            accessManager = accessManager,
            serviceUrlsDataSource = serviceUrlsDataSource,
            state = LoginInitState.HighPrivilegeWithOcs(OCS_URL),
            ttlManager = ttlManager,
            dispatcher = testDispatcher
        )

        viewModel.reactionStateFlow.test {
            assertEquals(LoginReaction.Nothing, awaitItem())
            // act
            viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))
            advanceUntilIdle()
            // assert
            assertEquals(
                LoginReaction.RefreshTokenFetchedWithoutOcs(
                    refreshToken = REFRESH_TOKEN,
                    ocsUrlToOpen = OCS_URL
                ),
                awaitItem()
            )
            verify { ttlManager.reset() }
        }
    }

    @Test
    fun `emit RefreshTokenFetchedWithoutOcs when RedirectLoaded for HighPrivilegeWithoutOcs`() =
        runTest(testDispatcher) {
            val response = TokenResponse(
                accessToken = ACCESS_TOKEN,
                refreshToken = REFRESH_TOKEN,
                expiresIn = 10,
                issuedTokenType = "issued-token-type"
            )
            coEvery {
                highPrivilegeTokenRepository.fetchTokens(
                    authorizationCode = any(),
                    codeVerifier = any()
                )
            } returns Result.success(response)

            val viewModel = LoginHighPrivilegeViewModel(
                giaRepository = giaRepository,
                lowPrivilegeTokenRepository = lowPrivilegeTokenRepository,
                highPrivilegeTokenRepository = highPrivilegeTokenRepository,
                biometricsRepository = biometricsRepository,
                uiStatesProvider = uiStatesProvider,
                sessionManager = securityManager,
                accessManager = accessManager,
                serviceUrlsDataSource = serviceUrlsDataSource,
                state = LoginInitState.HighPrivilegeWithoutOcs,
                ttlManager = ttlManager,
                dispatcher = testDispatcher
            )

            viewModel.reactionStateFlow.test {
                assertEquals(LoginReaction.Nothing, awaitItem())
                viewModel.handleAction(LoginAction.RedirectLoaded(loginRedirect(AUTH_CODE), OCS_URL))
                advanceUntilIdle()
                assertEquals(
                    LoginReaction.RefreshTokenFetchedWithoutOcs(refreshToken = REFRESH_TOKEN),
                    awaitItem()
                )
                verify(exactly = 0) { ttlManager.reset() }
            }
        }

    @Test
    fun `DetailsSection displays manual connection modal when error is MANUAL_CONNECTION_ERROR`() =
        runTest(testDispatcher) {
            val uiStateData = LoginUiStateData(
                error = LoginUiStateError.ManualConnection()
            )
            val uiStates = LoginUiStatesProvider(localizedStringSource)
                .uiStates(uiStateData, CoroutineScope(coroutineContext))
            val details = uiStates.find<LoginUiState.Content>()
            assertNotNull(details?.webview?.errorModal)
        }

    @Test
    fun `show account not activated modal when redirect returns USER_EMAIL_NOT_VERIFIED`() = runTest {
        viewModel.handleAction(
            LoginAction.RedirectLoaded(
                redirect = loginRedirectError(USER_EMAIL_NOT_VERIFIED),
                ocsUrl = OCS_URL
            )
        )
        advanceUntilIdle()

        assertEquals(LoginUiStateError.AccountNotActivated(), viewModel.uiStateDataFlow.value.error)
        assertEquals("", viewModel.uiStateDataFlow.value.urlToLoad)
        coVerify(exactly = 0) {
            highPrivilegeTokenRepository.fetchTokens(any(), any(), any(), any())
        }
    }

    @Test
    fun `show technical error with description when redirect returns another error`() = runTest {
        viewModel.handleAction(
            LoginAction.RedirectLoaded(
                redirect = loginRedirectError(OTHER_ERROR_DESCRIPTION),
                ocsUrl = OCS_URL
            )
        )
        advanceUntilIdle()

        assertEquals(
            LoginUiStateError.TechnicalError(description = OTHER_ERROR_DESCRIPTION),
            viewModel.uiStateDataFlow.value.error
        )
        coVerify(exactly = 0) {
            highPrivilegeTokenRepository.fetchTokens(any(), any(), any(), any())
        }
    }

    @Test
    fun `show technical error when redirect returns an error without description`() = runTest {
        // Auth0 ne retourne pas toujours error_description: l'erreur doit tout de même être détectée
        viewModel.handleAction(
            LoginAction.RedirectLoaded(
                redirect = loginRedirectError(errorDescription = null),
                ocsUrl = OCS_URL
            )
        )
        advanceUntilIdle()

        assertEquals(
            LoginUiStateError.TechnicalError(description = null),
            viewModel.uiStateDataFlow.value.error
        )
        coVerify(exactly = 0) {
            highPrivilegeTokenRepository.fetchTokens(any(), any(), any(), any())
        }
    }

    companion object {
        private const val OCS_URL = "https://ocs-url"
        private const val EXPIRED_URL = "https://expired-url"
        private const val REDIRECT_URL = "redirect-url"
        private const val AUTH_CODE = "authCode"
        private const val TEST_URL = "https://test-url"
        private const val ACCESS_TOKEN = "access-token-value"
        private const val COOKIE_NAME = "session-transfer-cookie"
        private const val DOMAIN = "domain.com"
        private const val REFRESH_TOKEN = "refresh-token-value"
        private const val STT = "session-transfer-refresh-token"
        private const val REF = "ref"
        private const val SESSION_TX_TYPE =
            "urn:auth0:params:oauth:token-type:session_transfer_token"
        private const val USER_EMAIL_NOT_VERIFIED = "USER_EMAIL_NOT_VERIFIED"
        private const val OTHER_ERROR_DESCRIPTION = "ERR_99"
    }
}
