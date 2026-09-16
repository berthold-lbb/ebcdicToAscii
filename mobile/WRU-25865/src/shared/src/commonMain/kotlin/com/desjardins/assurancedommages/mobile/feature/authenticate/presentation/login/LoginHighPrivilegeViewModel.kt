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
// WRU-25865 - AJOUT
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryError.KEY_INVALIDATED
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryError.VERIFICATION_FAILED
import io.github.aakira.napier.Napier
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.launch

/**
 * Class diagram at uml/ViewModel.puml (must install 'PlantUML Integration' Android Studio plugin)
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
    val state: LoginInitState,
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
    init {
        observeRepositoryData()
    }

    override fun onCreate() {
        super.onCreate()

        viewModelScope.launch(context = dispatcher) {
            // refresh low-priv access token to obtain latest user email
            val result = lowPrivilegeTokenRepository.refreshAccessToken()

            if (result == RefreshTokenResult.SUCCESS) {
                resolveAuthenticationFlow()
            } else {
                updateError(LoginUiStateError.TechnicalError())
            }
        }
    }

    // external events (from ui/user): LoginAction -> LoginReaction
    override fun handleAction(action: LoginAction) {
        Napier.d(message = "$TAG Handle ${action::class.simpleName} LoginAction")

        processExternalEvents(action)

        when (action) {
            is RedirectLoaded -> {
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
                updateManualConnectionModal(isVisible = false)
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
                updateManualConnectionModal(isVisible = false)
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
                        //   - fetch refresh token from biometrics
                        //   - fetch high-priv access token == session transfer token, stt
                        //   - write stt cookie to auth0 issuer domain
                        LoginReaction.GetRefreshTokenWithBiometrics(state.url)
                    } else {
                        // biometrics disabled -> nav to login
                        updateUrlToLoad(loginUrl)
                        LoginReaction.OpenLoginUrl(loginUrl)
                    }

                } else {
                    // TTL not expired, nav straight to ocs
                    updateUrlToLoad(state.url)
                    LoginReaction.OpenOcs(state.url)
                }
            }
        }

        handleReaction(reaction)
    }

    private fun handleWithBiometrics(action: GetRefreshTokenWithBiometrics) = viewModelScope.launch(context = dispatcher) {
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
                    // WRU-25865 - MODIF : KEY_INVALIDATED ajoute a la condition.
                    // Sans lui, une cle perimee tomberait dans le else et afficherait une erreur
                    // technique generique, au lieu du modal de connexion manuelle qui est la bonne
                    // sortie : le refresh token est irrecuperable, l'utilisateur doit se reconnecter.
                    if (exc is BiometricsException &&
                        (exc.error == VERIFICATION_FAILED || exc.error == INVALID_STORAGE || exc.error == KEY_INVALIDATED)
                    ) {
                        updateManualConnectionModal(isVisible = true)
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
                updateManualConnectionModal(isVisible = true)
                Napier.e(message = "$TAG ${error.message}")
            }

            is HighPrivilegeTokenFetchException.Generic -> {
                setCompoundError("Can't fetch session transfer token: ${error.message}")
            }

            else -> {
                setCompoundError("Can't fetch session transfer token: $error")
            }
        }
    }

    private fun setCompoundError(error: String) {
        updateError(LoginUiStateError.TechnicalError())
        Napier.e(message = "$TAG $error")
    }

    private fun saveRefreshTokenWithBiometrics(action: SaveRefreshTokenWithBiometrics) =
        viewModelScope.launch(context = dispatcher) {
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
            Napier.d(message = "$TAG Refresh token saved with biometrics")
            handleReaction(LoginReaction.Close)
        } else if (ocsUrlToOpen.isNotNullOrEmpty()) {
            // On poursuit vers OCS seulement après la tentative de sauvegarde biométrie
            handleReaction(LoginReaction.OpenOcs(url = ocsUrlToOpen))
        }
    }

    private fun onRefreshTokenSavedFailure(error: Throwable, ocsUrlToOpen: String?) {
        if (ocsUrlToOpen.isNotNullOrEmpty()) {
            if (error is BiometricsException && error.error == VERIFICATION_FAILED) {
                Napier.d(message = "$TAG Biometrics prompt cancelled while saving refresh token")
            } else {
                Napier.w(message = "$TAG Error saving refresh token with biometrics before OCS open: $error")
            }
            handleReaction(LoginReaction.OpenOcs(url = ocsUrlToOpen))
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
                if (biometricsRepository.isBiometricsEnabledOnApp()) {
                    refreshTokenFetchedReaction(refreshToken = refreshToken, url = state.url)
                } else {
                    handleReaction(LoginReaction.OpenOcs(state.url))
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
    }
}
