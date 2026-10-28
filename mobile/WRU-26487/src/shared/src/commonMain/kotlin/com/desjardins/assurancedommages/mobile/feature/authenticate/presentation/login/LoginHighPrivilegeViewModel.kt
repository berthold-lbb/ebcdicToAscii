package com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login

import ca.dgag.ajusto.kore.domain.state.UiStatesProvider
import ca.dgag.ajusto.kore.extension.isNotNullOrEmpty
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.LoginUiStateData
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.LoginUiStateError
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.datasource.ServiceUrlsDataSource
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.repository.GiaRepository
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.repository.HighPrivilegeTokenRepository
import com.desjardins.assurancedommages.mobile.feature.authenticate.data.repository.LowPrivilegeTokenRepository
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.manager.AuthSessionManager
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.manager.TTLManager
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.model.HighPrivilegeTokenFetchException
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.model.RefreshTokenResult
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction.DismissModal
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction.GetRefreshTokenWithBiometrics
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction.ManualLogin
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction.ManualLoginCancel
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction.NavToHelp
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction.RedirectLoaded
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction.SaveRefreshTokenWithBiometrics
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.login.LoginAction.WebviewError
import com.desjardins.assurancedommages.mobile.transverse.domain.accessmanager.AccessManager
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometricsException
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometricsRepository
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryError.INVALID_STORAGE
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryError.KEY_INVALIDATED
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryError.USER_CANCELED
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryError.VERIFICATION_FAILED
import io.github.aakira.napier.Napier
import kotlinx.atomicfu.atomic
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.launch

/**
 *  Class diagram at uml/ViewModel.puml (must install 'PlantUML Integration' Android Studio plugin)
 */
class LoginHighPrivilegeViewModel internal constructor(
    internal val giaRepository: GiaRepository,
    internal val lowPrivilegeTokenRepository: LowPrivilegeTokenRepository,
    internal val highPrivilegeTokenRepository: HighPrivilegeTokenRepository,
    internal val biometricsRepository: BiometricsRepository,
    uiStatesProvider: UiStatesProvider<LoginUiState, LoginUiStateData>,
    sessionManager: AuthSessionManager,
    accessManager: AccessManager,
    serviceUrlsDataSource: ServiceUrlsDataSource,
    internal val state: LoginInitState,
    internal val ttlManager: TTLManager,
    dispatcher: CoroutineDispatcher
) : LoginViewModel(
    repository = giaRepository,
    uiStatesProvider = uiStatesProvider,
    sessionManager = sessionManager,
    accessManager = accessManager,
    serviceUrlsDataSource = serviceUrlsDataSource,
    dispatcher = dispatcher
) {
    // L'URL OCS est résolue à la première utilisation, après l'initialisation potentielle de Firebase.
    private val resolvedOcsUrl: String by lazy {
        when (val currentState = state) {
            is LoginInitState.HighPrivilegeWithOcs -> giaRepository.resolveOcsUrl(currentState.url)
            LoginInitState.HighPrivilegeWithoutOcs -> error("OCS URL requested without an OCS state")
        }
    }

    // WRU-26487 : après une annulation ou un échec de vérification, conserver le jeton
    // stocké sans nouvelle invite après la connexion manuelle. Les accès traversent des dispatchers.
    private val biometricsDeclinedDuringThisLogin = atomic(false)

    init {
        observeRepositoryData()
    }

    override fun onCreate() {
        super.onCreate()

        viewModelScope.launch(dispatcher) {
            // refresh low-priv access token to obtain latest user email
            when (lowPrivilegeTokenRepository.forceRefreshAccessToken()) {
                RefreshTokenResult.SUCCESS -> {
                    // Auth0 rafraîchit sans erreur même si le nouveau courriel n'est pas confirmé:
                    // l'état doit être lu sur le claim `email_verified` de l'id token.
                    if (lowPrivilegeTokenRepository.isAuthenticationEmailVerified) {
                        resolveAuthenticationFlow()
                    } else {
                        handleUnverifiedAuthenticationEmail()
                    }
                }

                // Le courriel d'authentification n'a pas été confirmé: on informe l'utilisateur
                // que son compte est inactif plutôt que d'afficher une erreur technique
                RefreshTokenResult.EMAIL_NOT_VERIFIED -> {
                    handleUnverifiedAuthenticationEmail()
                }

                else -> {
                    updateError(LoginUiStateError.TechnicalError())
                }
            }
        }
    }

    /**
     * Les services en ligne refusent l'accès et ferment la session Auth0 (/v2/logout) tant que le
     * courriel d'authentification n'est pas confirmé. Le TTL est invalidé pour que la bascule
     * suivante repasse par l'URL d'autorisation, seule porteuse du courriel (login_hint).
     */
    private fun handleUnverifiedAuthenticationEmail() {
        ttlManager.invalidate()
        updateError(LoginUiStateError.AccountNotActivated())
    }

    // external events (from ui/user): LoginAction -> LoginReaction
    override fun handleAction(action: LoginAction) {
        Napier.d("$TAG Handle ${action::class.simpleName} LoginAction")

        processExternalEvents(action)

        when (action) {
            is RedirectLoaded -> {
                if (isRedirectError(action.redirect)) {
                    updateUrlToLoad("")
                    updateRedirectError(action.redirect)
                    return
                }

                viewModelScope.launch {
                    handleRedirectLoadedAuthentication(action)
                }
            }

            NavToHelp, is DismissModal -> {
                updateError(null)
            }

            is ManualLogin -> {
                val loginURL = if (action.url.isNotNullOrEmpty()) {
                    action.url
                } else {
                    retrieveAuthorizeUrl()
                }

                updateUrlToLoad(loginURL)
                handleReaction(LoginReaction.OpenLoginUrl(loginURL))
                updateManualConnectionModal(false)
            }

            is GetRefreshTokenWithBiometrics -> {
                handleWithBiometrics(action)
            }

            is SaveRefreshTokenWithBiometrics -> {
                saveRefreshTokenWithBiometrics(action)
            }

            is WebviewError -> {
                updateError(LoginUiStateError.TechnicalError())
            }

            ManualLoginCancel -> {
                updateManualConnectionModal(false)
            }

            else -> {
                Unit
            }
        }
    }

    fun retrieveAuthorizeUrl(isLow: Boolean = false) = sessionManager.getAuthorizeUrl(isLow = isLow)

    private fun resolveAuthenticationFlow() {
        val loginUrl = retrieveAuthorizeUrl()
        val reaction = when (state) {
            // enable biometrics - login high-priv, but don't nav to ocs after
            is LoginInitState.HighPrivilegeWithoutOcs -> {
                updateUrlToLoad(loginUrl)
                LoginReaction.OpenLoginUrl(loginUrl)
            }

            is LoginInitState.HighPrivilegeWithOcs -> {
                if (ttlManager.isExpired()) {
                    // TTL expired
                    if (biometricsRepository.isBiometricsEnabledOnApp()) {
                        // biometrics enabled ->
                        //    - fetch refresh token from biometrics
                        //    - fetch high-priv access token == session transfer token, stt
                        //    - write stt cookie to auth0 issuer domain
                        LoginReaction.GetRefreshTokenWithBiometrics(resolvedOcsUrl)
                    } else {
                        // biometrics disabled -> nav to login
                        updateUrlToLoad(loginUrl)
                        LoginReaction.OpenLoginUrl(loginUrl)
                    }
                } else {
                    // TTL not expired, nav straight to ocs
                    updateUrlToLoad(resolvedOcsUrl)
                    LoginReaction.OpenOcs(resolvedOcsUrl)
                }
            }
        }
        handleReaction(reaction)
    }

    private fun handleWithBiometrics(action: GetRefreshTokenWithBiometrics) = viewModelScope.launch(dispatcher) {
        // WRU-26487 : chaque tentative repart sans le refus de la tentative précédente.
        biometricsDeclinedDuringThisLogin.value = false
        highPrivilegeTokenRepository
            .getRefreshTokenFromBiometrics(
                action.contextType,
                action.contextReference
            ).fold(
                onSuccess = { refreshToken ->
                    if (refreshToken.isNotEmpty()) {
                        fetchSessionTransferToken(refreshToken, action.url)
                    } else {
                        setCompoundError("Empty refresh token")
                    }
                },
                onFailure = { exc ->
                    if (exc is BiometricsException && exc.error in MANUAL_LOGIN_RECOVERABLE_ERRORS) {
                        // WRU-26487 : memoriser le refus de l'utilisateur (voir le champ plus haut).
                        biometricsDeclinedDuringThisLogin.value =
                            exc.error == USER_CANCELED || exc.error == VERIFICATION_FAILED
                        updateManualConnectionModal(true)
                    } else {
                        setCompoundError("Can't fetch refresh token with biometrics: $exc")
                    }
                }
            )
    }

    private suspend fun fetchSessionTransferToken(refreshToken: String, url: String) = highPrivilegeTokenRepository
        .fetchTokens(
            authorizationCode = "",
            codeVerifier = "",
            isSessionTransferToken = true,
            refreshToken = refreshToken
        ).fold(
            onSuccess = { response ->
                if (
                    response?.accessToken.isNotNullOrEmpty() &&
                    response.refreshToken.isNotNullOrEmpty() &&
                    response.issuedTokenType == SESSION_TX_TYPE
                ) {
                    ttlManager.reset()

                    handleReaction(
                        LoginReaction.OpenOcsWithSessionTransfer(
                            url = url,
                            sessionTransferCookie = giaRepository.createSessionTransferCookie(
                                value = response.accessToken,
                                expiresIn = response.expiresIn
                            ),
                            refreshToken = response.refreshToken
                        )
                    )
                } else {
                    setCompoundError("Invalid session transfer token response")
                }
            },
            onFailure = { error -> handleFetchTokenFailure(error) }
        )

    private fun handleFetchTokenFailure(error: Throwable) {
        when (error) {
            is HighPrivilegeTokenFetchException.Unauthorized -> {
                updateManualConnectionModal(true)
                Napier.e("$TAG ${error.message}")
            }

            is HighPrivilegeTokenFetchException.FetchFailed,
            is HighPrivilegeTokenFetchException.UnexpectedFailure -> {
                setCompoundError("Can't fetch session transfer token: ${error.message}")
            }

            else -> {
                setCompoundError("Can't fetch session transfer token: $error")
            }
        }
    }

    private fun setCompoundError(error: String) {
        updateError(LoginUiStateError.TechnicalError())
        Napier.e("$TAG $error")
    }

    private fun saveRefreshTokenWithBiometrics(action: SaveRefreshTokenWithBiometrics) =
        viewModelScope.launch(dispatcher) {
            if (action.refreshToken.isEmpty()) {
                setCompoundError("Can't save empty refresh token with biometrics")
                return@launch
            }
            highPrivilegeTokenRepository
                .setRefreshTokenWithBiometrics(
                    refreshToken = action.refreshToken,
                    contextType = action.contextType,
                    contextReference = action.contextReference
                ).fold(
                    onSuccess = { onRefreshTokenSavedSuccess(action.ocsUrlToOpen) },
                    onFailure = { error -> onRefreshTokenSavedFailure(error, action.ocsUrlToOpen) }
                )
        }

    private fun onRefreshTokenSavedSuccess(ocsUrlToOpen: String?) {
        if (state is LoginInitState.HighPrivilegeWithoutOcs) {
            biometricsRepository.setBiometricsEnabledOnApp(true)
            Napier.d("$TAG Refresh token saved with biometrics")
            handleReaction(LoginReaction.Close)
        } else if (ocsUrlToOpen.isNotNullOrEmpty()) {
            // On poursuit vers OCS seulement après la tentative de sauvegarde biométrie
            handleReaction(LoginReaction.OpenOcs(ocsUrlToOpen))
        }
    }

    private fun onRefreshTokenSavedFailure(error: Throwable, ocsUrlToOpen: String?) {
        if (ocsUrlToOpen.isNotNullOrEmpty()) {
            if (error is BiometricsException && error.error == VERIFICATION_FAILED) {
                Napier.d("$TAG Biometrics prompt cancelled while saving refresh token")
            } else {
                Napier.w("$TAG Error saving refresh token with biometrics before OCS open: $error")
            }
            handleReaction(LoginReaction.OpenOcs(ocsUrlToOpen))
        } else {
            setCompoundError("Error saving refresh token with biometrics: $error")
        }
    }

    private suspend fun handleRedirectLoadedAuthentication(action: RedirectLoaded) = highPrivilegeTokenRepository
        .fetchTokens(
            authorizationCode = action.redirect?.code.orEmpty(),
            codeVerifier = sessionManager.getCodeVerifier
        ).fold(
            onSuccess = { response ->
                if (response?.refreshToken.isNotNullOrEmpty()) {
                    handleRedirectLoadedAuthWithRefreshToken(response.refreshToken)
                } else {
                    setCompoundError("Refresh token is null or empty")
                }
            },
            onFailure = { error -> handleFetchTokenFailure(error) }
        )

    // Gestion du jeton de rafraîchissement après redirection selon l'état courant
    private fun handleRedirectLoadedAuthWithRefreshToken(refreshToken: String) {
        when (state) {
            is LoginInitState.HighPrivilegeWithOcs -> {
                // On reset le TTL seulement lorsqu'on ouvre un OCS et non lorsque la biométrie est en activation (HighPrivilegeWithoutOcs)
                ttlManager.reset()
                // WRU-26487 : pas de reecriture du jeton (donc pas de 2e invite) si l'utilisateur a refuse.
                if (biometricsRepository.isBiometricsEnabledOnApp() && !biometricsDeclinedDuringThisLogin.value) {
                    refreshTokenFetchedReaction(refreshToken = refreshToken, url = resolvedOcsUrl)
                } else {
                    handleReaction(LoginReaction.OpenOcs(resolvedOcsUrl))
                }
            }

            is LoginInitState.HighPrivilegeWithoutOcs -> {
                refreshTokenFetchedReaction(refreshToken = refreshToken)
            }
        }
    }

    private fun refreshTokenFetchedReaction(refreshToken: String, url: String? = null) {
        handleReaction(
            LoginReaction.RefreshTokenFetchedWithoutOcs(
                refreshToken = refreshToken,
                ocsUrlToOpen = url
            )
        )
    }

    private companion object {
        private val TAG = LoginHighPrivilegeViewModel::class.simpleName
        private const val SESSION_TX_TYPE =
            "urn:auth0:params:oauth:token-type:session_transfer_token"

        // Erreurs récupérables par connexion manuelle. Le jeton est ensuite sauvegardé sauf
        // après une annulation ou un échec de vérification de cette tentative.
        private val MANUAL_LOGIN_RECOVERABLE_ERRORS =
            setOf(USER_CANCELED, VERIFICATION_FAILED, INVALID_STORAGE, KEY_INVALIDATED)
    }
}
