// WRU-26599-R1 — fichier CRÉÉ par ce récit
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   aio  androidApp/src/main/java/ca/dgag/ajusto/core/impl/legacy/DeviceInfoImpl.kt
//     l. 41-50   niveau de batterie EN POURCENTAGE  (EXTRA_LEVEL / EXTRA_SCALE × 100)
//     l. 96-108  IntentFilter(ACTION_BATTERY_CHANGED) + BroadcastReceiver
//     l. 117-125 récepteur enregistré en AVANT-PLAN seulement
//     l. 146-149 isBatteryChargeSustained → EXTRA_STATUS == BATTERY_STATUS_CHARGING
//     l. 176-178 isBatteryLow             → pourcentage <= 20
//     l. 180-188 isPowerSavingModeEnabled → PowerManager.isPowerSaveMode
//     l. 198-207 isAjustoDeviceBrandCompatible → !MANUFACTURER.contains("huawei", ignoreCase)
//   Ce fichier CRÉE l'équivalent ; DeviceInfoImpl reste en place et n'est pas déplacé.
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.transverse.domain.device

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

actual class PlatformDeviceStateProvider actual constructor(
    contextReference: Any
) : DeviceStateProvider {

    private val context = contextReference as Context

    private val _isBatteryLow = MutableStateFlow(false)
    private val _isBatteryChargeSustained = MutableStateFlow(false)
    private val _isPowerSavingModeEnabled = MutableStateFlow(false)

    actual override val isBatteryLow: StateFlow<Boolean> = _isBatteryLow.asStateFlow()
    actual override val isBatteryChargeSustained: StateFlow<Boolean> = _isBatteryChargeSustained.asStateFlow()
    actual override val isPowerSavingModeEnabled: StateFlow<Boolean> = _isPowerSavingModeEnabled.asStateFlow()

    /**
     * Veto local, hors ligne, sur le FABRICANT — pas sur le modèle. Insensible à la casse, et un
     * fabricant inconnu est réputé compatible : c'est exactement ce que fait
     * `!isDeviceManufacturerHuawei()` côté Java, où un MANUFACTURER null rend false.
     *
     * TODO WRU-26599-R1 — le code d'origine ne dit pas POURQUOI cette marque est exclue. Question
     * posée au produit et à la télématique ; si le motif a disparu, la règle disparaît avec lui.
     */
    actual override val isDeviceBrandCompatible: Boolean =
        Build.MANUFACTURER?.contains(EXCLUDED_MANUFACTURER, ignoreCase = true)?.not() ?: true

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = publish(intent)
    }

    private var isRegistered = false

    actual override fun startObserving() {
        if (isRegistered) return

        // L'enregistrement rend l'Intent COLLANT de la batterie : on a donc une valeur juste
        // immédiatement, sans attendre la prochaine diffusion. C'est la parade au défaut du Java,
        // où la zone restait vide au premier lancement, et c'est aussi ce qui corrige le retour
        // d'avant-plan — à condition que startObserving() y soit bien rappelé (TODO du port).
        val sticky = context.registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        isRegistered = true
        publish(sticky)
    }

    actual override fun stopObserving() {
        if (!isRegistered) return
        context.unregisterReceiver(receiver)
        isRegistered = false
    }

    private fun publish(batteryIntent: Intent?) {
        _isBatteryLow.value = batteryIntent?.let { isBatteryLow(it) } ?: false
        _isBatteryChargeSustained.value =
            batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) == BatteryManager.BATTERY_STATUS_CHARGING

        // Relu à chaque diffusion de batterie, et PAS AUTREMENT — voir le piège plus bas.
        _isPowerSavingModeEnabled.value = readPowerSavingMode()
    }

    /**
     * EXTRA_LEVEL N'EST PAS UN POURCENTAGE : il se rapporte à EXTRA_SCALE, qui vaut 100 sur la
     * plupart des appareils mais pas sur tous. Le Java fait bien la division (l. 44-50) ; comparer
     * EXTRA_LEVEL directement au seuil est faux dès que l'échelle diffère.
     *
     * Seuil repris tel quel : inférieur OU ÉGAL à 20 %. Échelle absente ou nulle = état inconnu,
     * qui ne doit pas déclencher l'alerte.
     */
    private fun isBatteryLow(batteryIntent: Intent): Boolean {
        val level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        if (level < 0 || scale <= 0) return false

        return (level * 100 / scale) <= BATTERY_LOW_THRESHOLD
    }

    /**
     * PIÈGE HÉRITÉ, PROPRE À ANDROID — le système ne prévient pas quand ce mode bascule, et le Java
     * s'appuie sur la diffusion de batterie comme réveil. Quelqu'un qui active le mode économie
     * sans que son niveau bouge ne voit donc jamais le message apparaître. Reproduit tel quel.
     * À noter : iOS N'A PAS ce défaut, il publie une notification dédiée.
     *
     * TODO WRU-26599-R1 — décider si on corrige côté Android, et écrire la décision dans le ticket.
     */
    private fun readPowerSavingMode(): Boolean =
        (context.getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isPowerSaveMode ?: false

    private companion object {
        const val BATTERY_LOW_THRESHOLD = 20
        const val EXCLUDED_MANUFACTURER = "huawei"
    }
}
