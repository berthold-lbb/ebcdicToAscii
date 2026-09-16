package com.desjardins.assurancedommages.mobile.transverse.domain.biometrics

import com.rickclephas.kmp.nativecoroutines.NativeCoroutines

interface BiometryProtectedStorage {
    @NativeCoroutines
    suspend fun activate(contextType: BiometryPromptContextType, contextReference: Any?): BiometryError

    @NativeCoroutines
    suspend fun putString(
        key: String,
        value: String,
        contextType: BiometryPromptContextType,
        contextReference: Any?
    ): BiometryError

    @NativeCoroutines
    suspend fun getString(
        key: String,
        default: String? = null,
        contextType: BiometryPromptContextType,
        contextReference: Any?
    ): Pair<String?, BiometryError>

    fun isEligible(): Boolean
    fun remove(key: String): BiometryError
    fun contains(key: String): Pair<Boolean, BiometryError>

    enum class BiometryError(val code: Int) {
        NONE(code = 0),
        HARDWARE_NOT_AVAILABLE(code = 1),
        HARDWARE_NOT_CONFIGURED(code = 2),
        PERMISSION_REJECTED(code = 3),
        INVALID_STORAGE(code = 4),
        VERIFICATION_FAILED(code = 5),

        // WRU-25865 - AJOUT
        // La cle Keystore est liee au SID biometrique existant au moment de sa creation. Supprimer puis
        // reenroler ses empreintes genere un NOUVEAU SID : la cle reste presente mais plus aucune
        // authentification ne peut l'autoriser. Ce cas est distinct de INVALID_STORAGE (stockage vide ou
        // illisible) car il exige une action specifique : regenerer la cle et resynchroniser l'etat du
        // toggle "biometrie activee", qui sinon reste vrai alors que le stockage vient d'etre vide.
        KEY_INVALIDATED(code = 6)
    }

    enum class BiometryPromptContextType {
        IOS,
        ANDROID_FRAGMENT,
        ANDROID_FRAGMENT_ACTIVITY
    }

    companion object {
        const val KEYTAG = "BiometryProtectedStorageImpl"
        const val ACTIVATION_TEST_KEY: String = "${KEYTAG}_TestKey"
        const val STORAGE_VALUE_SUFFIX: String = ".$KEYTAG.value"
    }
}
