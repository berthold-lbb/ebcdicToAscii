// WRU-26599-R1 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.data.contextualmessage.datasource

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource.AjustoDeviceState
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource.DeviceStateDataSource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Lit l'état du téléphone. Reprend le comportement de DeviceInfoImpl (androidApp), qui reste en
 * place : on en crée l'équivalent ici, on ne le déplace pas.
 *
 * TROIS MÉCANISMES DIFFÉRENTS, ET C'EST CE QUI EXPLIQUE LES PIÈGES.
 *
 *   · La batterie arrive par une DIFFUSION SYSTÈME qu'Android pousse vers l'application.
 *   · Le mode économie d'énergie se LIT À LA DEMANDE sur un service système. Android ne prévient
 *     jamais quand il bascule — voir le piège ci-dessous.
 *   · Le fabricant est une CONSTANTE inscrite dans le système. Rien à écouter.
 */
internal class AndroidDeviceStateDataSource(
    private val context: Context
) : DeviceStateDataSource {

    override fun observe(): Flow<AjustoDeviceState> = callbackFlow {
        // Émission immédiate : aucune règle ne doit attendre une diffusion système pour se
        // prononcer. C'est la parade au défaut du Java, où la zone restait vide au premier
        // lancement tant que toutes les sources n'avaient pas répondu.
        trySend(readState(lastBatteryIntent = null))

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                trySend(readState(lastBatteryIntent = intent))
            }
        }

        // ATTENTION : DeviceInfoImpl n'enregistre le récepteur qu'en AVANT-PLAN et le retire en
        // arrière-plan. Au retour, la valeur connue date donc du dernier passage au premier plan.
        // Ici l'enregistrement suit le cycle de vie du flux, ce qui provoque une relecture à
        // chaque nouvel abonnement — donc à chaque retour sur l'écran.
        context.registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        awaitClose { context.unregisterReceiver(receiver) }
    }.distinctUntilChanged()

    private fun readState(lastBatteryIntent: Intent?): AjustoDeviceState {
        val level = lastBatteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val status = lastBatteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1

        return AjustoDeviceState(
            // Seuil repris tel quel de DeviceInfoImpl : inférieur OU ÉGAL à 20 %.
            // Un niveau inconnu (-1) ne doit pas déclencher l'alerte.
            isBatteryLow = level in 0..BATTERY_LOW_THRESHOLD,
            isBatteryChargeSustained = status == BatteryManager.BATTERY_STATUS_CHARGING,
            isPowerSavingModeEnabled = isPowerSavingModeEnabled(),
            isBrandCompatible = isBrandCompatible()
        )
    }

    /**
     * PIÈGE HÉRITÉ — aucun signal de changement n'existe pour ce mode. Android ne prévient pas
     * quand il bascule, et le Java s'appuie sur l'observable de batterie comme réveil : quelqu'un
     * qui active le mode économie sans que son niveau de batterie bouge ne voit jamais le message
     * apparaître.
     *
     * Le comportement est reproduit tel quel ici. TODO WRU-26599-R1 — décider s'il est corrigé par
     * une relecture périodique, et écrire la décision dans le ticket.
     */
    private fun isPowerSavingModeEnabled(): Boolean {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        return powerManager?.isPowerSaveMode ?: false
    }

    /**
     * Veto local, hors ligne, sur le FABRICANT — pas sur le modèle. Comparaison insensible à la
     * casse, et un fabricant inconnu est réputé compatible.
     *
     * TODO WRU-26599-R1 — personne ne sait plus pourquoi cette marque est exclue : le code
     * d'origine ne porte aucun commentaire. Question posée au produit et à la télématique. Si le
     * motif a disparu, la règle disparaît avec lui.
     */
    private fun isBrandCompatible(): Boolean =
        Build.MANUFACTURER?.contains(EXCLUDED_MANUFACTURER, ignoreCase = true)?.not() ?: true

    private companion object {
        const val BATTERY_LOW_THRESHOLD = 20
        const val EXCLUDED_MANUFACTURER = "huawei"
    }
}
