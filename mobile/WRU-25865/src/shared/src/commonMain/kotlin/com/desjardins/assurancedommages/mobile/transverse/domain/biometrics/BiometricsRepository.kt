package com.desjardins.assurancedommages.mobile.transverse.domain.biometrics

import ca.dgag.ajusto.kore.data.repository.BaseRepository
import com.desjardins.assurancedommages.mobile.transverse.data.biometrics.BiometricsDataSource
import com.desjardins.assurancedommages.mobile.transverse.data.biometrics.BiometricsStatus.DISABLED
import com.desjardins.assurancedommages.mobile.transverse.data.biometrics.BiometricsStatus.ENABLED
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryError
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.BiometryPromptContextType
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage.Companion.ACTIVATION_TEST_KEY
import com.desjardins.assurancedommages.mobile.transverse.domain.uistatedata.EmptyUiStateData
import kotlinx.coroutines.flow.map

class BiometricsException(val error: BiometryError) : Exception("Biometry error: $error")

internal class BiometricsRepository(
    private val biometricsProtectedStorage: BiometryProtectedStorage,
    private val biometricsDataSource: BiometricsDataSource
) : BaseRepository<EmptyUiStateData>() {
    val biometricsEnabledFlow = biometricsDataSource.dataStateFlow.map { status ->
        status == ENABLED && isEligible()
    }

    suspend fun activate(contextType: BiometryPromptContextType, contextReference: Any?): BiometryError =
        biometricsProtectedStorage.activate(contextType, contextReference)

    fun isEligible(): Boolean = biometricsProtectedStorage.isEligible()

    fun isBiometricsEnabledOnApp(): Boolean = biometricsDataSource.data == ENABLED

    fun setBiometricsEnabledOnApp(isEnabled: Boolean) {
        biometricsDataSource.data = if (isEnabled) ENABLED else DISABLED

        if (!isEnabled) {
            val key = ACTIVATION_TEST_KEY
            if (biometricsProtectedStorage.contains(key).first) {
                biometricsProtectedStorage.remove(key)
            }
        }
    }

    suspend fun putHighPrivRefreshToken(
        value: String,
        contextType: BiometryPromptContextType,
        contextReference: Any?
    ): BiometryError = biometricsProtectedStorage.putString(
        HIGH_PRIV_REFRESH_TOKEN_KEY,
        value,
        contextType,
        contextReference
    )

    suspend fun getHighPrivRefreshToken(
        contextType: BiometryPromptContextType,
        contextReference: Any?
    ): Result<String> {
        val (refreshToken, error) = biometricsProtectedStorage.getString(
            HIGH_PRIV_REFRESH_TOKEN_KEY,
            null,
            contextType,
            contextReference
        )

        // WRU-25865 - AJOUT
        // Chemin silencieux : au demarrage, l'app tente une reconnexion biometrique sans action de
        // l'utilisateur. Si la cle est perimee, getString() a deja vide le stockage chiffre - mais le
        // drapeau "biometrie activee" vit dans BiometricsDataSource, que resetStorage() ne touche pas.
        // Sans cette ligne, le toggle continuerait d'afficher "active" alors que la biometrie ne
        // fonctionne plus, et l'utilisateur devrait la desactiver puis la reactiver a la main pour s'en
        // sortir. biometricsEnabledFlow etant un Flow collecte par ProfileAuthenticationViewModel, le
        // toggle se met a jour tout seul.
        if (error == BiometryError.KEY_INVALIDATED) {
            setBiometricsEnabledOnApp(false)
        }

        return if (error == BiometryError.NONE && refreshToken != null) {
            Result.success(refreshToken)
        } else {
            Result.failure(BiometricsException(error))
        }
    }

    fun removeHighPrivRefreshToken() = biometricsProtectedStorage.remove(HIGH_PRIV_REFRESH_TOKEN_KEY)
    override fun initialData(): EmptyUiStateData = EmptyUiStateData

    companion object {
        private const val HIGH_PRIV_REFRESH_TOKEN_KEY: String = "HIGH_PRIV_REFRESH_TOKEN_KEY"
    }
}
