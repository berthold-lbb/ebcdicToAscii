// WRU-26599-R1 — fichier MODIFIÉ par ce récit
//
// Trois lignes passent de false à true. Rien d'autre ne change.
package com.desjardins.assurancedommages.mobile.ajusto.presentation.summary

import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage

object ContextualMessageActivation {

    fun isEnabledInProduction(message: AjustoContextualMessage): Boolean = when (message) {
        AjustoContextualMessage.DeviceBrandNotCompatible -> true   // WRU-26599-R1 — était false
        is AjustoContextualMessage.DeviceNotCompatible -> false     // WRU-26599-R2 passera à true
        AjustoContextualMessage.LowBattery -> true                  // WRU-26599-R1 — était false
        AjustoContextualMessage.PowerSaving -> true                 // WRU-26599-R1 — était false
        AjustoContextualMessage.ClassifyInvite -> false             // WRU-26599-R3 passera à true
        is AjustoContextualMessage.PolicyEffective -> false          // WRU-26599-R4 passera à true
        is AjustoContextualMessage.Badge -> false                    // WRU-26599-R5 passera à true
        is AjustoContextualMessage.GoodToKnow -> false               // WRU-26599-R6 passera à true
    }
}
