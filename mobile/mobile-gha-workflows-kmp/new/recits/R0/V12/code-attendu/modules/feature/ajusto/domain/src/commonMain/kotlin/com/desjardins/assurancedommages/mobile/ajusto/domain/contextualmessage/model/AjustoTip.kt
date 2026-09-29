// WRU-26599-R0 — fichier CRÉÉ par ce récit (alimenté par le récit R6)
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   AUCUNE — ce message N'EXISTE PAS côté Java, il n'est dans aucune branche de la cascade.
//   Sa source de données n'est pas tranchée : trois hypothèses documentées, décision au récit R6.
//   Déjà présent côté présentation, sans producteur : les clés d'icône LightBulb et ClappingHands
//   (aio, AjustoSummaryIconKey).
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model

/**
 * Le contenu d'un « Bon à savoir ».
 *
 * [identifier] est une CLÉ DE TRADUCTION, jamais un libellé : le domaine ne porte aucun texte
 * traduit. La résolution en texte se fait en présentation.
 */
data class AjustoTip(
    val identifier: String,
    val linkUrl: String? = null
)
