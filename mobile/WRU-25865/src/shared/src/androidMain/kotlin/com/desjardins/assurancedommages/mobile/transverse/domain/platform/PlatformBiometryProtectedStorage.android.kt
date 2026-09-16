package com.desjardins.assurancedommages.mobile.transverse.domain.platform

import android.app.KeyguardManager
import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
// WRU-25865 - AJOUT : couvre le cas d'une cle reellement detruite, en plus du SID perime.
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.UserNotAuthenticatedException
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import ca.dgag.ajusto.localized.LocalizedStringSource
import com.desjardins.assurancedommages.mobile.transverse.domain.biometrics.BiometryProtectedStorage
import com.desjardins.assurancedommages.mobile.transverse.presentation.localized.ProfileLocalizedString
import io.github.aakira.napier.Napier
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.IvParameterSpec
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll

actual class PlatformBiometryProtectedStorage actual constructor(
    localizedStringSource: LocalizedStringSource,
    contextReference: Any
) : BiometryProtectedStorage {
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    private val localizedStringSource = localizedStringSource
    private val context = contextReference as Context
    private val sharedPreferences: SharedPreferences =
        context.getSharedPreferences(SHARED_PREFERENCES_SCOPE, Context.MODE_PRIVATE)
    private val keyStore = KeyStore.getInstance(KEYSTORE_SCOPE)

    init {
        keyStore.load(null)
    }

    actual override suspend fun activate(
        contextType: BiometryProtectedStorage.BiometryPromptContextType,
        contextReference: Any?
    ): BiometryProtectedStorage.BiometryError {
        var error = verifyBasicBiometricError()
        if (error == BiometryProtectedStorage.BiometryError.NONE) {
            val getPair =
                getString(BiometryProtectedStorage.ACTIVATION_TEST_KEY, null, contextType, contextReference)
            error = getPair.second
            if (error == BiometryProtectedStorage.BiometryError.NONE ||
                error == BiometryProtectedStorage.BiometryError.INVALID_STORAGE
            ) {
                error = putString(
                    BiometryProtectedStorage.ACTIVATION_TEST_KEY,
                    BiometryProtectedStorage.ACTIVATION_TEST_KEY,
                    contextType,
                    contextReference
                )
                if (error == BiometryProtectedStorage.BiometryError.NONE) {
                    error = remove(BiometryProtectedStorage.ACTIVATION_TEST_KEY)
                }
            }
        }
        return error
    }

    actual override fun contains(key: String): Pair<Boolean, BiometryProtectedStorage.BiometryError> {
        val encryptedData = sharedPreferences.getString(getKeyForValue(key), null)
        val iv = sharedPreferences.getString(getKeyForIV(key), null)
        return Pair(
            encryptedData != null && iv != null,
            BiometryProtectedStorage.BiometryError.NONE
        )
    }

    actual override suspend fun getString(
        key: String,
        default: String?,
        contextType: BiometryProtectedStorage.BiometryPromptContextType,
        contextReference: Any?
    ): Pair<String?, BiometryProtectedStorage.BiometryError> = try {
        val encryptedData = sharedPreferences.getString(getKeyForValue(key), default)?.let {
            Base64.decode(it, Base64.DEFAULT)
        }

        val ivString = sharedPreferences.getString(getKeyForIV(key), null)
            ?: return Pair(null, BiometryProtectedStorage.BiometryError.INVALID_STORAGE)

        val iv = Base64.decode(ivString, Base64.DEFAULT)

        val securityPair = retrieveSecurityPair()
        val cipher = securityPair.second
        val ivSpec = IvParameterSpec(iv)

        val success = promptBiometry(contextType, contextReference)
        if (success) {
            try {
                cipher.init(Cipher.DECRYPT_MODE, securityPair.first, ivSpec)
                val decrypted = cipher.doFinal(encryptedData)
                val finalValue = decrypted.toString(Charsets.UTF_8)
                Pair(finalValue, BiometryProtectedStorage.BiometryError.NONE)
            } catch (e: Exception) {
                // Dans un cas ou le user est non authentié, on reset l'entry afin de save le nouveau token lors du manual sign in.
                // WRU-25865 - MODIF
                // Le reset existait deja ici (cote lecture) et c'etait le bon reflexe : c'est exactement
                // ce traitement qui manquait cote ecriture (putString). On remonte desormais
                // KEY_INVALIDATED au lieu de INVALID_STORAGE pour que BiometricsRepository puisse
                // remettre le toggle a false : resetStorage() vide le stockage chiffre mais ne touche pas
                // au drapeau "biometrie activee", qui resterait donc vrai a tort.
                Napier.e("$TAG Error decrypting data: $e")
                if (isKeyInvalidated(e)) {
                    resetStorage()
                    Pair(null, BiometryProtectedStorage.BiometryError.KEY_INVALIDATED)
                } else {
                    Pair(null, BiometryProtectedStorage.BiometryError.INVALID_STORAGE)
                }
            }
        } else {
            Napier.d("$TAG Prompt biometry failed while getting $key")
            Pair(null, BiometryProtectedStorage.BiometryError.VERIFICATION_FAILED)
        }
    } catch (e: Exception) {
        Napier.e("$TAG Encrypted data retrieved is invalid or failed: $e")
        Pair(null, BiometryProtectedStorage.BiometryError.INVALID_STORAGE)
    }

    actual override suspend fun putString(
        key: String,
        value: String,
        contextType: BiometryProtectedStorage.BiometryPromptContextType,
        contextReference: Any?
    ): BiometryProtectedStorage.BiometryError {
        val securityPair = retrieveSecurityPair()

        return try {
            encryptData(key, value, securityPair)
            BiometryProtectedStorage.BiometryError.NONE
        } catch (e: Exception) {
            Napier.d("$TAG Encrypting failed while putting $key: $e")

            if (promptBiometry(contextType, contextReference)) {
                // WRU-25865 - MODIF : LE POINT DE CRASH
                // L'appel direct a encryptData() se trouvait ici, hors de tout try/catch. Quand la cle est
                // liee a un SID biometrique perime, ce 2e essai releve la meme exception que le 1er, elle
                // remonte non rattrapee jusqu'a la coroutine et tue le processus complet de l'app
                // (FATAL EXCEPTION relevee en QA). On delegue desormais a une methode qui protege cet
                // essai et regenere la cle si necessaire.
                retryPutStringAfterPrompt(key, value, securityPair)
            } else {
                Napier.e("$TAG Prompt biometry failed while putting $key: $e")
                BiometryProtectedStorage.BiometryError.VERIFICATION_FAILED
            }
        }
    }

    // WRU-25865 - AJOUT : 2e essai protege, avec recuperation sur cle perimee.
    //
    // Pourquoi c'est necessaire : la cle Keystore est liee au SID biometrique existant au moment de sa
    // creation. Supprimer puis reenroler ses empreintes genere un NOUVEAU SID ; la cle reste en place
    // (containsAlias == true, donc generatedKeyIfNeeded() ne la regenere pas) mais plus aucune
    // authentification ne peut l'autoriser. Android remonte UserNotAuthenticatedException - et non
    // KeyPermanentlyInvalidatedException - parce que la cle est a fenetre de validite (60 s) et non en
    // authentification par usage. Reessayer avec la meme cle echouera donc indefiniment : il faut la
    // jeter et en regenerer une, liee au SID courant.
    //
    // Pas de nouveau prompt avant le 3e essai : l'authentification qui vient de reussir est encore dans
    // la fenetre de 60 s et couvre la cle fraichement generee.
    //
    // A noter : resetStorage() vide l'ensemble des SharedPreferences du scope, donc aussi le vrai
    // refresh token. C'est sans consequence ici puisque ce chemin mene de toute facon a une
    // reactivation complete (nouveau login), mais c'est a garder en tete.
    private fun retryPutStringAfterPrompt(
        key: String,
        value: String,
        securityPair: Pair<SecretKey, Cipher>
    ): BiometryProtectedStorage.BiometryError = try {
        encryptData(key, value, securityPair)
        BiometryProtectedStorage.BiometryError.NONE
    } catch (e: Exception) {
        if (isKeyInvalidated(e)) {
            Napier.e("$TAG Key unusable after prompt while putting $key, resetting storage and regenerating key: $e")
            resetStorage()
            try {
                encryptData(key, value, retrieveSecurityPair())
                BiometryProtectedStorage.BiometryError.NONE
            } catch (regeneratedKeyError: Exception) {
                Napier.e("$TAG Still failing after key reset while putting $key: $regeneratedKeyError")
                BiometryProtectedStorage.BiometryError.KEY_INVALIDATED
            }
        } else {
            Napier.e("$TAG Unexpected error while putting $key after biometry retry: $e")
            BiometryProtectedStorage.BiometryError.INVALID_STORAGE
        }
    }

    private fun encryptData(key: String, value: String, securityPair: Pair<SecretKey, Cipher>) {
        val cipher = securityPair.second
        cipher.init(Cipher.ENCRYPT_MODE, securityPair.first)
        val iv = cipher.iv
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        writePair(key, encrypted, iv)
    }

    private fun writePair(key: String, encrypted: ByteArray, iv: ByteArray) {
        sharedPreferences.edit(commit = true) {
            putString(getKeyForValue(key), Base64.encodeToString(encrypted, Base64.DEFAULT))
                .putString(getKeyForIV(key), Base64.encodeToString(iv, Base64.DEFAULT))
        }
    }

    actual override fun remove(key: String): BiometryProtectedStorage.BiometryError {
        sharedPreferences.edit(commit = true) {
            remove(getKeyForValue(key))
                .remove(getKeyForIV(key))
        }
        return BiometryProtectedStorage.BiometryError.NONE
    }

    actual override fun isEligible(): Boolean = isDeviceSecured() && isHardwareEnrolled()

    private fun isDeviceSecured() = hasHardware() &&
        (context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isDeviceSecure

    private fun verifyBasicBiometricError(): BiometryProtectedStorage.BiometryError = when {
        !isDeviceSecured() -> BiometryProtectedStorage.BiometryError.HARDWARE_NOT_AVAILABLE
        !isHardwareEnrolled() -> BiometryProtectedStorage.BiometryError.HARDWARE_NOT_CONFIGURED
        else -> BiometryProtectedStorage.BiometryError.NONE
    }

    private fun isHardwareEnrolled(): Boolean {
        val manager = BiometricManager.from(context)
        return when (
            manager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
            )
        ) {
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> false

            else -> true
        }
    }

    private fun hasHardware(): Boolean {
        val manager = BiometricManager.from(context)
        return when (
            manager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
            )
        ) {
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> false

            else -> true
        }
    }

    private fun retrieveSecurityPair(): Pair<SecretKey, Cipher> {
        generatedKeyIfNeeded()

        val secretKey = keyStore.getKey(SECRET_KEY_NAME, null) as SecretKey
        val cipher =
            Cipher.getInstance(
                "${KeyProperties.KEY_ALGORITHM_AES}/${KeyProperties.BLOCK_MODE_CBC}/${KeyProperties.ENCRYPTION_PADDING_PKCS7}"
            )

        return Pair(secretKey, cipher)
    }

    private fun generatedKeyIfNeeded() {
        // Ne regenere pas la cle si elle existe deja, sinon les donnees chiffrees deviennent indechiffrables.
        if (keyStore.containsAlias(SECRET_KEY_NAME)) return

        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE_SCOPE
        )

        val builder = KeyGenParameterSpec
            .Builder(
                SECRET_KEY_NAME,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            ).apply {
                setBlockModes(KeyProperties.BLOCK_MODE_CBC)
                setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
                setUserAuthenticationRequired(true)
                setUserAuthenticationParameters(
                    BIOMETRY_SESSION_VALIDITY_TIME_SPAN_SECONDS,
                    KeyProperties.AUTH_BIOMETRIC_STRONG
                )
            }

        keyGenerator.init(builder.build())
        keyGenerator.generateKey()
    }

    private fun getKeyForValue(key: String) = key + BiometryProtectedStorage.STORAGE_VALUE_SUFFIX

    private fun getKeyForIV(key: String) = key + STORAGE_IV_SUFFIX

    private fun resetStorage() {
        if (keyStore.containsAlias(SECRET_KEY_NAME)) {
            keyStore.deleteEntry(SECRET_KEY_NAME)
        }
        sharedPreferences.edit(commit = true) {
            clear()
        }
    }

    // WRU-25865 - MODIF : renomme (isUserNotAuthenticated -> isKeyInvalidated) et elargi.
    // UserNotAuthenticatedException : la cle existe mais est liee a un SID biometrique qui n'existe plus
    //   (empreintes supprimees puis reenrolees) - aucune authentification ne pourra plus l'ouvrir.
    // KeyPermanentlyInvalidatedException : la cle a reellement ete detruite.
    // Les deux cas exigent le meme traitement : jeter la cle et en regenerer une neuve.
    private fun isKeyInvalidated(exception: Throwable): Boolean = exception is UserNotAuthenticatedException ||
        exception is KeyPermanentlyInvalidatedException ||
        (exception.cause?.let { isKeyInvalidated(it) } == true)

    @OptIn(ExperimentalCoroutinesApi::class)
    private suspend fun promptBiometry(
        contextType: BiometryProtectedStorage.BiometryPromptContextType,
        contextReference: Any?
    ): Boolean {
        val biometryValidationSuccessTrigger = CompletableDeferred<Boolean>()
        val biometryValidation = coroutineScope.async {
            val executor = ContextCompat.getMainExecutor(context)
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    biometryValidationSuccessTrigger.complete(true)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    biometryValidationSuccessTrigger.complete(false)
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    biometryValidationSuccessTrigger.complete(false)
                }
            }

            var biometricPrompt: BiometricPrompt?
            if (contextReference != null) {
                biometricPrompt =
                    when (contextType) {
                        BiometryProtectedStorage.BiometryPromptContextType.ANDROID_FRAGMENT -> {
                            BiometricPrompt(contextReference as Fragment, executor, callback)
                        }

                        BiometryProtectedStorage.BiometryPromptContextType.ANDROID_FRAGMENT_ACTIVITY -> {
                            BiometricPrompt(
                                contextReference as FragmentActivity,
                                executor,
                                callback
                            )
                        }

                        else -> {
                            biometryValidationSuccessTrigger.complete(false)
                            return@async
                        }
                    }
            } else {
                biometryValidationSuccessTrigger.complete(false)
                return@async
            }

            val promptInfo = BiometricPrompt.PromptInfo
                .Builder()
                .setTitle(localizedStringSource[ProfileLocalizedString.BIOMETRIC_PROMPT_TITLE])
                .setSubtitle(localizedStringSource[ProfileLocalizedString.BIOMETRIC_PROMPT_MESSAGE])
                .setNegativeButtonText(localizedStringSource[ProfileLocalizedString.GLOBAL_CANCEL])
                .build()

            biometricPrompt.authenticate(promptInfo)
        }

        listOf(biometryValidation, biometryValidationSuccessTrigger).awaitAll()

        return biometryValidationSuccessTrigger.getCompleted()
    }

    private companion object {
        private val TAG = PlatformBiometryProtectedStorage::class.java.simpleName
        private const val KEYSTORE_SCOPE = "AndroidKeyStore"
        private const val SHARED_PREFERENCES_SCOPE = "${BiometryProtectedStorage.KEYTAG}_Preferences"
        private const val SECRET_KEY_NAME = "${BiometryProtectedStorage.KEYTAG}_SecretKey"
        private const val BIOMETRY_SESSION_VALIDITY_TIME_SPAN_SECONDS = 60
        private const val STORAGE_IV_SUFFIX = ".${BiometryProtectedStorage.KEYTAG}.iv"
    }
}
