// WRU-26599-R0 — fichier CRÉÉ par ce récit (alimenté par le récit R3)
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   Core Java   core-lib  .../core/trip/TripServiceImpl.java                — LATEST_TRIPS_PAST_DAYS
//                                                                             et la note Mulligan
//               core-lib  .../core/classifyinvite/ClassifyInviteChecker.java — ce que la règle
//                                                                             consomme réellement
//   À y lire    les TROIS SEULS champs utilisés. Le Java manipule des List<CMTTrip> complets ;
//               les règles n'en retiennent que la taille et « a été étiqueté ».
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model

import kotlinx.datetime.Instant

/**
 * Un trajet récent, réduit à ce que les règles consomment réellement : la date de départ pour le
 * filtre, le fait qu'il ait été identifié par la personne, et le fait qu'il soit un rattrapage.
 *
 * AUCUN type du SDK télématique ne traverse cette frontière.
 */
data class AjustoRecentTrip(
    val startDate: Instant,
    val isUserLabeled: Boolean,
    val isMulligan: Boolean
)
