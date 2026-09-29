// WRU-26599-R1 — fichier CRÉÉ par ce récit (étendu par le récit R3)
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   aio  androidApp/src/main/java/com/mirego/cmt/wrapper/trips/CMTTripManagerImpl.kt
//          l. 52  tripRecordStateObservable.notifyEvent(CmtService.isInDrive())
//          l. 80  notifyEventIfChanged(CmtService.isInDrive())
//        → c'est le SEUL booléen dont R1 a besoin, et la façon dont il est rafraîchi.
//   core-lib  .../core/trip/AjustoContextualMessageHelper.java — qui montre que la règle du mode
//             économie d'énergie consomme cet état, et rien d'autre du SDK.
//
//   Le port est nommé au PLURIEL alors qu'il ne porte qu'un membre : R3 y ajoutera la liste des
//   trajets récents. Renommer un port public au récit suivant coûte plus cher qu'un pluriel
//   prématuré.
//
//   POURQUOI IL RESTE DANS LA FEATURE, alors que DeviceStateProvider part en transverse : seul
//   Ajusto consomme le SDK télématique. Ce qui décide de l'emplacement, c'est QUI A LE DROIT de
//   consommer le port, pas le fait qu'il ait une implémentation par plateforme.
// ══════════════════════════════════════════════════════════════════════════════════════════════
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
