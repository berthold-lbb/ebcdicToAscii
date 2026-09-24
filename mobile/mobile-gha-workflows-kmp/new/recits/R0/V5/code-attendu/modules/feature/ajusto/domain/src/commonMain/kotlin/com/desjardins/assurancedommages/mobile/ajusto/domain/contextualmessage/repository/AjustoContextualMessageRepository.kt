// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.repository

import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage
import kotlinx.coroutines.flow.Flow

/**
 * Le port que la couche data implémentera : elle combine les sources, assemble les signaux, appelle
 * le use case, et publie le résultat.
 *
 * Le flux émet à chaque changement d'un signal. La liste peut être vide — c'est un état normal, pas
 * une erreur.
 */
fun interface AjustoContextualMessageRepository {
    fun getContextualMessages(): Flow<List<AjustoContextualMessage>>
}
