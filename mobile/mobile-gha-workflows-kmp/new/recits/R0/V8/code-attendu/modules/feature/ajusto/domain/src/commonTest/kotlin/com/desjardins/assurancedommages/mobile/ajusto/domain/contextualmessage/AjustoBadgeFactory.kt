// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage

import com.desjardins.assurancedommages.mobile.ajusto.domain.achievements.model.AjustoBadge

/**
 * Fabrique de médailles pour les tests.
 *
 * POURQUOI ELLE EXISTE : dans AjustoBadge, previousBadge et nextBadge n'ont PAS de valeur par
 * défaut. Toute construction doit donc les passer explicitement, null compris. Sans cette
 * fabrique, chaque test répète la liste complète des paramètres.
 *
 * Tous les récits suivants s'en servent — R5 en particulier, qui en construit beaucoup.
 */
object AjustoBadgeFactory {

    fun medaille(
        identifiant: String = "medaille_demo",
        famille: String = "SNAP",
        niveau: Int = 1,
        reclamable: Boolean = true
    ): AjustoBadge = AjustoBadge(
        identifier = identifiant,
        groupIdentifier = famille,
        level = niveau,
        isClaimable = reclamable,
        previousBadge = null,
        nextBadge = null
    )
}
