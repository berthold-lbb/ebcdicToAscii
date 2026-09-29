// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.usecase

import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage.GoodToKnow
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualSignals

/**
 * Le seul endroit de l'application qui décide quels messages contextuels s'appliquent.
 *
 * ── CE QUI CHANGE PAR RAPPORT AU JAVA ─────────────────────────────────────────────────────────
 * La cascade Java est un if/else-if qui s'arrête à la première règle vraie : elle ne rend qu'UN
 * message. La nouvelle zone en affiche jusqu'à quatre, empilés. Ce use case évalue donc chaque
 * famille INDÉPENDAMMENT.
 *
 * Deux écarts assumés, à ne pas prendre pour des défauts :
 *   1. les quatre familles sont toujours évaluées, là où le Java s'arrêtait à la première vraie ;
 *   2. la médaille est évaluée dans tous les cas, là où le Java ne l'atteignait que si aucune des
 *      six règles précédentes n'avait fait mouche.
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 *
 * À LA LIVRAISON DE R0, LES QUATRE FONCTIONS DE RÉSOLUTION RENDENT null. Chaque récit R1 à R6
 * remplit ensuite la sienne. La mécanique d'assemblage, elle, est complète et testée dès ici.
 */
object ResolveContextualMessagesUseCase {

    /**
     * De 0 à 4 messages, DÉJÀ dans l'ordre d'affichage. La liste vide est un état normal — c'est
     * même le cas le plus fréquent.
     *
     * ── L'ORDRE EST DONNÉ PAR L'ORDRE DES QUATRE LIGNES CI-DESSOUS ────────────────────────────
     * `listOfNotNull` conserve l'ordre de ses arguments et supprime les absents. La sortie est
     * donc ordonnée sans aucun tri : le conseil en tête, l'appareil, l'engagement, la médaille en
     * dernier.
     *
     * Il n'y a délibérément NI champ `priority` sur les messages, NI liste d'ordre des groupes, NI
     * `sortedWith`. L'ordre n'est écrit qu'à un seul endroit — ici. Toute autre solution en
     * créerait plusieurs, qu'il faudrait garder cohérents entre eux.
     *
     * NE PAS remplacer par un regroupement par `group` suivi d'un « garder le plus prioritaire » :
     * les familles appareil et engagement partagent le groupe NOTICE, un tel regroupement
     * supprimerait donc silencieusement l'un des deux messages quand les deux s'appliquent.
     * La déduplication se fait DANS chaque fonction de résolution, où elle est lisible.
     * ──────────────────────────────────────────────────────────────────────────────────────────
     */
    fun resolve(
        signals: AjustoContextualSignals,
        tip: GoodToKnow? = null
    ): List<AjustoContextualMessage> = listOfNotNull(
        tip,                          // groupe ADVICE — toujours en tête
        resolveDeviceState(signals),  // groupe NOTICE — famille appareil
        resolveEngagement(signals),   // groupe NOTICE — famille engagement
        resolveBadge(signals)         // groupe BADGE  — toujours en dernier
    )

    /**
     * Famille appareil — une seule s'affiche.
     *
     * Les branches sont dans l'ordre de la cascade Java : marque, appareil, batterie, économie.
     * Deux problèmes simultanés ne donnent qu'un message, le plus prioritaire.
     *
     * R1 branche la marque, la batterie et l'économie d'énergie.
     * R2 insère l'appareil non compatible entre la marque et la batterie.
     */
    private fun resolveDeviceState(signals: AjustoContextualSignals): AjustoContextualMessage? =
        null // TODO WRU-26599-R1 et R2 — branchement des règles de cette famille

    /**
     * Famille engagement — une seule s'affiche.
     *
     * Ordre de la cascade Java : l'invitation à identifier passe avant le décompte de la police.
     *
     * R3 branche l'invitation, R4 le décompte.
     */
    private fun resolveEngagement(signals: AjustoContextualSignals): AjustoContextualMessage? =
        null // TODO WRU-26599-R3 et R4 — branchement des règles de cette famille

    /**
     * Famille médaille — la médaille réclamable la plus avancée, ou rien.
     *
     * R5 la branche.
     */
    private fun resolveBadge(signals: AjustoContextualSignals): AjustoContextualMessage? =
        null // TODO WRU-26599-R5 — branchement de la règle de cette famille
}
