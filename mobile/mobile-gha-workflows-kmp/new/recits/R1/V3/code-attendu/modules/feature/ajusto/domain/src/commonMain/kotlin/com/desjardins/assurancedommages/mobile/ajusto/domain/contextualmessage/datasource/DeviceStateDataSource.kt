// WRU-26599-R1 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource

import kotlinx.coroutines.flow.Flow

/**
 * Le port de l'état du téléphone. Quatre booléens, rien d'autre : aucun type Android, aucun type du
 * SDK, aucun type du Core ne traverse cette frontière.
 */
fun interface DeviceStateDataSource {
    fun observe(): Flow<AjustoDeviceState>
}

/**
 * Les quatre signaux que l'OS fournit, avec leurs valeurs par défaut — celles qui ne déclenchent
 * aucune alerte. Le flux doit émettre une première valeur sans attendre : une règle ne doit jamais
 * être bloquée par une source encore silencieuse.
 */
data class AjustoDeviceState(
    /** Niveau inférieur ou égal au seuil, d'après la dernière diffusion système reçue. */
    val isBatteryLow: Boolean = false,
    /** L'appareil est en charge. */
    val isBatteryChargeSustained: Boolean = false,
    /** Mode économie d'énergie actif. */
    val isPowerSavingModeEnabled: Boolean = false,
    /** Faux si le fabricant est sur liste d'exclusion. */
    val isBrandCompatible: Boolean = true
)
