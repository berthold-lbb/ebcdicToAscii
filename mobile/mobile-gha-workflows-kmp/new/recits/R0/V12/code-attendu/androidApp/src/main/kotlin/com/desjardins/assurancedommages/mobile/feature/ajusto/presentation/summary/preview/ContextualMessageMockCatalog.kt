// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.feature.ajusto.presentation.summary.preview

import com.desjardins.assurancedommages.mobile.ajusto.domain.achievements.model.AjustoBadge
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage

/**
 * LA source des previews de la zone de messages : un exemplaire de CHAQUE type de message. Aucune
 * preview n'écrit ses données à la main — toutes dérivent de cette liste et passent par le vrai
 * mapper.
 *
 * OBJECTIF : « type déclaré ⇒ preview générée », garanti, et non confié à la mémoire de celui qui
 * ajoutera le prochain type. Deux garde-fous complémentaires s'en chargent.
 *
 *   1. LE COMPILATEUR — [exhaustiveCheck] est un `when` exhaustif SANS branche `else` sur une
 *      sealed class. Ajouter un neuvième type fait échouer la compilation DE CE FICHIER :
 *      impossible de l'ignorer, il faut venir ici.
 *
 *   2. L'INTÉGRATION CONTINUE — le `when` force à OUVRIR le fichier, il ne force pas à REMPLIR
 *      [all]. C'est le rôle de ContextualMessageMockCatalogTest.
 *
 * Ce catalogue est réutilisable par les tests du use case et du mapper : un seul jeu d'exemples
 * pour tout le chantier.
 */
object ContextualMessageMockCatalog {

    private val medailleDeDemo = AjustoBadge(
        identifier = "badge_demo_conduite_douce",
        groupIdentifier = "SNAP",
        title = "Conduite en douceur",
        badgeLevelText = "Or",
        level = 3,
        progress = 100,
        nextBadge = null,
        previousBadge = null,
        hasProgression = true,
        isClaimable = true,
        isAjustoBadge = true
    )

    /** Un exemplaire par type, dans l'ordre d'affichage. */
    val all: List<AjustoContextualMessage> = listOf(
        AjustoContextualMessage.GoodToKnow(AjustoTip(identifier = "AJUSTO_TIP_DEMO")),
        AjustoContextualMessage.DeviceBrandNotCompatible,
        AjustoContextualMessage.DeviceNotCompatible(drivingProgramName = "Ajusto"),
        AjustoContextualMessage.LowBattery,
        AjustoContextualMessage.PowerSaving,
        AjustoContextualMessage.ClassifyInvite,
        AjustoContextualMessage.PolicyEffective(remainingDays = 5),
        AjustoContextualMessage.Badge(medailleDeDemo)
    )

    /**
     * GARDE-FOU DE COMPILATION — ne fait rien à l'exécution, n'est appelé nulle part, et c'est
     * voulu. Sa seule raison d'exister est d'être exhaustif.
     *
     * NE PAS ajouter de branche `else` ici : ce serait supprimer la garantie.
     */
    @Suppress("unused", "UNUSED_PARAMETER")
    private fun exhaustiveCheck(message: AjustoContextualMessage): Unit = when (message) {
        is AjustoContextualMessage.GoodToKnow,
        AjustoContextualMessage.DeviceBrandNotCompatible,
        is AjustoContextualMessage.DeviceNotCompatible,
        AjustoContextualMessage.LowBattery -> Unit

        AjustoContextualMessage.PowerSaving,
        AjustoContextualMessage.ClassifyInvite,
        is AjustoContextualMessage.PolicyEffective,
        is AjustoContextualMessage.Badge -> Unit
    }
}
