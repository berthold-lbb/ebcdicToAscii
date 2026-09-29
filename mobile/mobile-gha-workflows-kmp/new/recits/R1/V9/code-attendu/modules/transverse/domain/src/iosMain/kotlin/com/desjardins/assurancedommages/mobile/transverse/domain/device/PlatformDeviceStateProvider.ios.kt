// WRU-26599-R1 — fichier CRÉÉ par ce récit
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   aio  iosApp/App/Legacy/Domain/Core/DGAGDeviceInfoImpl.m
//     l. 62-64   isBatteryChargeSustained → UIDevice.batteryState == UIDeviceBatteryStateCharging
//     l. 66-72   isBatteryLow             → getBatteryLevel <= 20, et NO SUR SIMULATEUR
//     l. 74-76   isPowerSavingModeEnabled → NSProcessInfo.isLowPowerModeEnabled
//     l. 102-104 getBatteryLevel          → UIDevice.batteryLevel × 100
//     l. 180-182 isAjustoDeviceBrandCompatible → YES, TOUJOURS
//   Le pont existant est iosApp/App/Legacy/Domain/Kore/DGAGKDeviceInfo.swift, qui délègue à ce
//   fichier ObjC membre par membre.
//
//   POURQUOI CE FICHIER EXISTE : le port vit en commonMain d'un module partagé ; sans `actual`
//   iOS, la compilation iOS échoue. Le message contextuel n'est pas encore rendu sur iOS — ce
//   fichier rend le port honorable sur les deux plateformes, il ne livre pas l'écran iOS.
//
//   TODO WRU-26599-R1 — les noms exacts des symboles Kotlin/Native sont donnés d'après l'API
//   Apple ; à valider par une compilation iOS avant fusion, pas à croire sur parole.
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.transverse.domain.device

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import platform.Foundation.NSNotificationCenter
import platform.Foundation.NSOperationQueue
import platform.Foundation.NSProcessInfo
import platform.Foundation.NSProcessInfoPowerStateDidChangeNotification
import platform.UIKit.UIDevice
import platform.UIKit.UIDeviceBatteryLevelDidChangeNotification
import platform.UIKit.UIDeviceBatteryState
import platform.UIKit.UIDeviceBatteryStateDidChangeNotification
import platform.darwin.NSObjectProtocol

@OptIn(ExperimentalForeignApi::class)
actual class PlatformDeviceStateProvider actual constructor(
    @Suppress("UNUSED_PARAMETER") contextReference: Any
) : DeviceStateProvider {

    private val _isBatteryLow = MutableStateFlow(false)
    private val _isBatteryChargeSustained = MutableStateFlow(false)
    private val _isPowerSavingModeEnabled = MutableStateFlow(false)

    actual override val isBatteryLow: StateFlow<Boolean> = _isBatteryLow.asStateFlow()
    actual override val isBatteryChargeSustained: StateFlow<Boolean> = _isBatteryChargeSustained.asStateFlow()
    actual override val isPowerSavingModeEnabled: StateFlow<Boolean> = _isPowerSavingModeEnabled.asStateFlow()

    /** TOUJOURS COMPATIBLE — le veto de marque ne vise qu'un fabricant Android. Le fichier ObjC
     *  rend `YES` en dur (l. 180-182) ; on reproduit exactement. */
    actual override val isDeviceBrandCompatible: Boolean = true

    private val observers = mutableListOf<NSObjectProtocol>()

    actual override fun startObserving() {
        if (observers.isNotEmpty()) return

        // SANS CETTE LIGNE, batteryLevel rend -1 et batteryState rend Unknown. Première cause de
        // « ça marche sur Android mais pas sur iOS » sur ce genre de port.
        UIDevice.currentDevice.batteryMonitoringEnabled = true

        // iOS N'A PAS le défaut d'Android sur l'économie d'énergie : une notification dédiée
        // existe. Le message apparaîtra donc sans attendre un changement de niveau de batterie.
        listOf(
            UIDeviceBatteryLevelDidChangeNotification,
            UIDeviceBatteryStateDidChangeNotification,
            NSProcessInfoPowerStateDidChangeNotification
        ).forEach { name ->
            observers += NSNotificationCenter.defaultCenter.addObserverForName(
                name = name,
                object_ = null,
                queue = NSOperationQueue.mainQueue
            ) { _ -> publish() }
        }

        publish()
    }

    actual override fun stopObserving() {
        observers.forEach { NSNotificationCenter.defaultCenter.removeObserver(it) }
        observers.clear()
        UIDevice.currentDevice.batteryMonitoringEnabled = false
    }

    private fun publish() {
        val device = UIDevice.currentDevice

        // batteryLevel est un Float entre 0 et 1, ou -1 si l'état est inconnu — sur simulateur
        // notamment, ce qui explique le `return NO` du fichier ObjC. Un état inconnu ne doit pas
        // déclencher l'alerte.
        val level = device.batteryLevel
        _isBatteryLow.value = level >= 0f && (level * 100).toInt() <= BATTERY_LOW_THRESHOLD

        _isBatteryChargeSustained.value =
            device.batteryState == UIDeviceBatteryState.UIDeviceBatteryStateCharging

        _isPowerSavingModeEnabled.value = NSProcessInfo.processInfo.lowPowerModeEnabled
    }

    private companion object {
        const val BATTERY_LOW_THRESHOLD = 20
    }
}
