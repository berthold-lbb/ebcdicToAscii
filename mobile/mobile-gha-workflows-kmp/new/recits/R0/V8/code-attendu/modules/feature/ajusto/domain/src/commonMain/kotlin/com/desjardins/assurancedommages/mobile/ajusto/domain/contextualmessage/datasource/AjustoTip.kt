// WRU-26599-R0 — fichier CRÉÉ par ce récit (alimenté par le récit R6)
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource

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
