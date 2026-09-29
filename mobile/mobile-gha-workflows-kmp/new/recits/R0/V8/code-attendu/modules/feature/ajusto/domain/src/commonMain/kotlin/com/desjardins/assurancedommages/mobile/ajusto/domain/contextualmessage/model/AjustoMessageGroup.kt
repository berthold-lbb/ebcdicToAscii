// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model

/**
 * Les trois familles de messages contextuels. Elles correspondent exactement à ce que la personne
 * voit : le libellé affiché en haut de chaque boîte.
 *
 * Cet enum ne porte QUE l'apparence. Il ne dit rien de l'ordre d'affichage — celui-ci est donné
 * par l'ordre de construction de la liste dans ResolveContextualMessagesUseCase.
 */
enum class AjustoMessageGroup {

    /** « Bon à savoir » / « Useful information ». */
    ADVICE,

    /**
     * « Avis » / « Notice » — tout ce qui demande une attention ou signale une contrainte :
     * marque non compatible, appareil non compatible, batterie faible, économie d'énergie,
     * invitation à identifier un trajet, jours avant l'entrée en vigueur.
     */
    NOTICE,

    /** Nouvelle médaille à réclamer. Rendue à part : ni libellé, ni bordure colorée. */
    BADGE
}
