// WRU-26599-R0 — fichier CRÉÉ par ce récit (alimenté par le récit R3)
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource

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
