// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.presentation.summary

import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage

/**
 * Décide quels types de message sortent RÉELLEMENT à l'écran.
 *
 * Le domaine, lui, résout toujours les huit règles : rien n'est coupé en amont. Seul l'affichage
 * est filtré, et il l'est au dernier étage possible — juste avant la traduction.
 *
 * Conséquence utile : un message désactivé reste visible dans les previews, ce qui permet de le
 * montrer à l'équipe sans l'exposer en production.
 *
 * À LA LIVRAISON DE R0, LES HUIT TYPES SONT À false. Chaque récit bascule le sien à true quand son
 * message est prêt.
 *
 * NE JAMAIS AJOUTER DE BRANCHE `else` : le `when` exhaustif sur une sealed class est ce qui fait
 * échouer la compilation de ce fichier le jour où un neuvième type est ajouté. C'est la garantie,
 * pas une contrainte.
 */
object ContextualMessageActivation {

    fun isEnabledInProduction(message: AjustoContextualMessage): Boolean = when (message) {
        AjustoContextualMessage.DeviceBrandNotCompatible -> false  // WRU-26599-R1 passera à true
        is AjustoContextualMessage.DeviceNotCompatible -> false    // WRU-26599-R2 passera à true
        AjustoContextualMessage.LowBattery -> false                // WRU-26599-R1 passera à true
        AjustoContextualMessage.PowerSaving -> false               // WRU-26599-R1 passera à true
        AjustoContextualMessage.ClassifyInvite -> false            // WRU-26599-R3 passera à true
        is AjustoContextualMessage.PolicyEffective -> false        // WRU-26599-R4 passera à true
        is AjustoContextualMessage.Badge -> false                  // WRU-26599-R5 passera à true
        is AjustoContextualMessage.GoodToKnow -> false             // WRU-26599-R6 passera à true
    }
}
