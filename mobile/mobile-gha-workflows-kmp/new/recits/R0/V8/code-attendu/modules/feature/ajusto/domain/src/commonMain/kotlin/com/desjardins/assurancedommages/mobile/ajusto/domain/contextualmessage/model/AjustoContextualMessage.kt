// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model

import com.desjardins.assurancedommages.mobile.ajusto.domain.achievements.model.AjustoBadge
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource.AjustoTip

/**
 * Remplace AjustoContextualMessageHelper.findContextualMessage() (Java, ad-digital-mobile-core-lib).
 *
 * Le domaine émet QUEL CAS s'applique — zéro texte traduit, zéro icône, zéro teinte. La traduction
 * et le rendu descendent dans la couche présentation.
 *
 * Les huit variantes sont déclarées d'emblée, même si aucune n'est encore produite : ce sont de
 * simples déclarations, et les déclarer ensemble évite un modèle taillé pour le premier message et
 * inadapté au septième. Chaque récit branche ensuite la sienne.
 *
 * L'ORDRE D'AFFICHAGE N'EST PAS PORTÉ ICI. Il est donné par l'ordre de construction de la liste
 * dans ResolveContextualMessagesUseCase.resolve(). Une seule définition, un seul endroit.
 */
sealed class AjustoContextualMessage(val group: AjustoMessageGroup) {

    /** Le fabricant du téléphone est sur liste d'exclusion. Veto local, hors ligne. */
    data object DeviceBrandNotCompatible : AjustoContextualMessage(AjustoMessageGroup.NOTICE)

    /**
     * L'appareil n'est pas sur liste blanche serveur, ou il manque un capteur.
     * [drivingProgramName] s'interpole dans le texte affiché.
     */
    data class DeviceNotCompatible(val drivingProgramName: String) :
        AjustoContextualMessage(AjustoMessageGroup.NOTICE)

    /** Batterie faible et appareil pas en charge soutenue. */
    data object LowBattery : AjustoContextualMessage(AjustoMessageGroup.NOTICE)

    /** Mode économie d'énergie actif et aucun trajet en cours d'enregistrement. */
    data object PowerSaving : AjustoContextualMessage(AjustoMessageGroup.NOTICE)

    /** Invitation à identifier un trajet — cinq conditions combinées. */
    data object ClassifyInvite : AjustoContextualMessage(AjustoMessageGroup.NOTICE)

    /** Jours restants avant l'entrée en vigueur de la police. Toujours strictement positif. */
    data class PolicyEffective(val remainingDays: Int) :
        AjustoContextualMessage(AjustoMessageGroup.NOTICE)

    /** La médaille réclamable la plus avancée. */
    data class Badge(val badge: AjustoBadge) : AjustoContextualMessage(AjustoMessageGroup.BADGE)

    /** Le conseil du jour. Sans équivalent dans le Core : c'est un message nouveau. */
    data class GoodToKnow(val tip: AjustoTip) : AjustoContextualMessage(AjustoMessageGroup.ADVICE)
}
