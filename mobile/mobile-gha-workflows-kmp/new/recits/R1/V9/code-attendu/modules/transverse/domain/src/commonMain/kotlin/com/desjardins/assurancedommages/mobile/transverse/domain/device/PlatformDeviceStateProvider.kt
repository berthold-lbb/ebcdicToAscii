// WRU-26599-R1 — fichier CRÉÉ par ce récit
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   Forme    aio  shared/src/commonMain/.../transverse/domain/platform/
//                 PlatformBiometryProtectedStorage.kt — MÊME PATRON : `expect class` qui
//                 implémente une interface du domaine, `actual` en .android.kt et .ios.kt,
//                 `contextReference: Any` pour ne pas faire entrer le Context Android en common.
//   Contenu  voir les en-têtes des deux `actual`, qui citent leur source ligne par ligne.
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.transverse.domain.device

import kotlinx.coroutines.flow.StateFlow

/**
 * `contextReference` reçoit le Context Android ; iOS l'ignore. C'est le compromis déjà retenu
 * dans ce dépôt pour PlatformBiometryProtectedStorage — on ne l'invente pas ici.
 */
expect class PlatformDeviceStateProvider(contextReference: Any) : DeviceStateProvider {
    override val isBatteryLow: StateFlow<Boolean>
    override val isBatteryChargeSustained: StateFlow<Boolean>
    override val isPowerSavingModeEnabled: StateFlow<Boolean>
    override val isDeviceBrandCompatible: Boolean
    override fun startObserving()
    override fun stopObserving()
}
