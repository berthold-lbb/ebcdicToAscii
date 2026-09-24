// WRU-26599-R1 — fichier CRÉÉ par ce récit (étendu par le récit R3)
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource

import kotlinx.coroutines.flow.Flow

/**
 * Le port des signaux de trajets, réduit à ce dont R1 a besoin : savoir si un trajet est en cours
 * d'enregistrement.
 *
 * R3 y ajoutera la liste des trajets récents. C'est la règle des fichiers partagés : le premier
 * récit qui en a besoin crée le port, le suivant l'étend.
 *
 * Ce port est le SEUL du chantier qui restera dépendant du SDK télématique — deux membres à terme,
 * et aucune décision transportée.
 */
fun interface CmtTripSignalsDataSource {

    /**
     * Vrai tant qu'un trajet est en cours d'enregistrement.
     *
     * Le SDK ne publie qu'en avant-plan et seulement si la personne est authentifiée. Le flux doit
     * donc émettre `false` par défaut plutôt que de rester silencieux.
     */
    fun observeIsRecording(): Flow<Boolean>

    // TODO WRU-26599-R3 — ajouter ici observeRecentTrips(): Flow<List<AjustoRecentTrip>>
}
