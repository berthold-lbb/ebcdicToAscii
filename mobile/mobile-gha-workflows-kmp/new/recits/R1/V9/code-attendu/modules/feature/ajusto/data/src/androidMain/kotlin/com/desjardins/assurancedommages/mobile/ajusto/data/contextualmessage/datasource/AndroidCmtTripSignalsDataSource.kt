// WRU-26599-R1 — fichier CRÉÉ par ce récit (étendu par le récit R3)
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   aio  androidApp/src/main/java/com/mirego/cmt/wrapper/trips/CMTTripManagerImpl.kt
//          l. 52 et l. 80 — l'appel réel à CmtService.isInDrive() et son observable SCRATCH.
//
//   ATTENTION — ce fichier émet `false` EN DUR. L'abonnement réel n'est pas écrit, et c'est
//   délibéré : une conversion approximative d'un observable SCRATCH vers un Flow produit une fuite
//   d'abonnement invisible en test. À écrire avec quelqu'un qui connaît cette bibliothèque.
//   Conséquence tant que ce n'est pas fait : le message « Mode économie d'énergie » s'affiche même
//   pendant un enregistrement.
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.ajusto.data.contextualmessage.datasource

import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource.CmtTripSignalsDataSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flowOf

/**
 * Lit l'état d'enregistrement sur le SDK télématique.
 *
 * CE QU'IL FAUT SAVOIR SUR LA SOURCE. Le SDK expose l'information via CmtService.isInDrive(),
 * publiée sur un observable réveillé par un rappel du SDK et par une minuterie récurrente. Cet
 * observable n'est alimenté qu'en avant-plan ET si la personne est authentifiée : il peut donc
 * rester silencieux longtemps sans qu'il y ait d'erreur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 * │ TODO WRU-26599-R1 — L'ABONNEMENT RÉEL RESTE À ÉCRIRE.                                    │
 * │                                                                                          │
 * │ Les observables du SDK ne sont pas des Flow Kotlin. La conversion demande un             │
 * │ callbackFlow avec fermeture propre (awaitClose) et un désabonnement fiable.              │
 * │                                                                                          │
 * │ Le récit demande explicitement de FAIRE RELIRE cet abonnement par quelqu'un qui connaît  │
 * │ cette bibliothèque avant de l'écrire. Écrire une conversion approximative ici produirait │
 * │ une fuite d'abonnement invisible en test et visible en production.                       │
 * │                                                                                          │
 * │ En attendant, la source émet false — valeur par défaut qui ne bloque aucune règle :       │
 * │ le message « Mode économie d'énergie » s'affichera donc même pendant un enregistrement,  │
 * │ ce qui est un écart à corriger AVANT la fusion du récit.                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */
internal class AndroidCmtTripSignalsDataSource : CmtTripSignalsDataSource {

    override fun observeIsRecording(): Flow<Boolean> =
        flowOf(false).distinctUntilChanged() // TODO WRU-26599-R1 — brancher l'observable du SDK

    // TODO WRU-26599-R3 — ajouter observeRecentTrips(), branché sur CMTTripProviderImpl,
    //                     puis filtré par RecentTripsFilter
}
