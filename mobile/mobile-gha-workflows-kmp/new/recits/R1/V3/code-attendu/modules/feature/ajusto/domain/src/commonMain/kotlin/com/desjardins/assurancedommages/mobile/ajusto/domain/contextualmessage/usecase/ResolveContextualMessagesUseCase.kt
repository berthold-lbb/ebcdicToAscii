// WRU-26599-R1 — fichier MODIFIÉ par ce récit
//
// Seule resolveDeviceState() change. Le reste du fichier, livré par R0, est inchangé et reproduit
// ici pour que le résultat attendu soit lisible d'un seul tenant.
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.usecase

import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage.DeviceBrandNotCompatible // WRU-26599-R1
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage.GoodToKnow
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage.LowBattery      // WRU-26599-R1
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage.PowerSaving     // WRU-26599-R1
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualSignals

object ResolveContextualMessagesUseCase {

    fun resolve(
        signals: AjustoContextualSignals,
        tip: GoodToKnow? = null
    ): List<AjustoContextualMessage> = listOfNotNull(
        tip,
        resolveDeviceState(signals),
        resolveEngagement(signals),
        resolveBadge(signals)
    )

    /**
     * Famille appareil — une seule s'affiche.
     *
     * L'ordre des branches EST la règle : il reproduit celui du if/else-if du Java. Deux problèmes
     * simultanés ne donnent qu'un message, le premier de cette liste.
     *
     * Côté Java, ces règles reçoivent le mode du compte en paramètre et ne s'en servent JAMAIS.
     * Ce paramètre mort n'est pas repris.
     */
    private fun resolveDeviceState(signals: AjustoContextualSignals): AjustoContextualMessage? =
        when {                                                                                    // WRU-26599-R1
            !signals.isDeviceBrandCompatible -> DeviceBrandNotCompatible                          // WRU-26599-R1
            // TODO WRU-26599-R2 — « Appareil non compatible » s'insère ICI, entre la marque et la batterie
            signals.isBatteryLow && !signals.isBatteryChargeSustained -> LowBattery                // WRU-26599-R1
            signals.isPowerSavingModeEnabled && !signals.isRecording -> PowerSaving                // WRU-26599-R1
            else -> null                                                                          // WRU-26599-R1
        }                                                                                         // WRU-26599-R1

    private fun resolveEngagement(signals: AjustoContextualSignals): AjustoContextualMessage? =
        null // TODO WRU-26599-R3 et R4

    private fun resolveBadge(signals: AjustoContextualSignals): AjustoContextualMessage? =
        null // TODO WRU-26599-R5
}
