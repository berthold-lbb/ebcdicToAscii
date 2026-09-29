package com.desjardins.assurancedommages.mobile.feature.ajusto.presentation.summary.preview

import androidx.compose.ui.tooling.preview.PreviewParameterProvider
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage
import com.desjardins.assurancedommages.mobile.ajusto.presentation.summary.AjustoSummaryUiStateModel
import com.desjardins.assurancedommages.mobile.ajusto.presentation.summary.ContextualMessageActivation
import com.desjardins.assurancedommages.mobile.ajusto.presentation.summary.ContextualMessageMapper
import com.desjardins.assurancedommages.mobile.transverse.domain.localized.Language

// WRU-26599-R0 — fichier CRÉÉ par ce récit
/**
 * Suit la convention de l'écran (voir AjustoSummaryMockProvider, AjustoSummaryScoreGaugeMockProvider,
 * AjustoSummaryTripGaugeMockProvider) : les données de preview vivent ici, dans le paquet
 * `preview/`, jamais en dur dans le composant.
 *
 * Ce qui change par rapport aux trois autres providers : les valeurs ne sont PAS écrites à la
 * main, elles DÉRIVENT de [ContextualMessageMockCatalog]. Comme le catalogue est verrouillé sur la
 * sealed class (voir ses deux garde-fous), Compose génère mécaniquement une preview par état
 * déclaré — c'est la garantie « état déclaré ⇒ preview générée » demandée par ken.
 *
 * Trois familles de valeurs, dans cet ordre :
 *  1. la LISTE VIDE — état normal confirmé produit (doc 17 §4), le cas à ne surtout pas régresser ;
 *  2. chaque type UN PAR UN — y compris les 4 désactivés en production, qu'on peut ainsi montrer
 *     et relire à volonté sans qu'ils sortent à l'écran ;
 *  3. l'EMPILEMENT RÉEL — le catalogue passé au filtre de [ContextualMessageActivation], c'est-à-dire
 *     exactement ce que la production affiche aujourd'hui.
 *
 * Le mapping passe par le VRAI [ContextualMessageMapper] : si une clé de traduction, une icône ou
 * une teinte change, la preview le montre au lieu de mentir avec des chaînes écrites à la main.
 *
 * TODO WRU-26599 — Compose nomme les previews PAR INDEX, pas par type : le panneau affichera
 * « … 1, 2, 3 ». Les titres des MessageBox les rendent identifiables ; si ça gêne à l'usage, passer
 * un wrapper porteur d'un toString() parlant plutôt qu'une List brute (doc 19 §3.3, limites).
 */
class AjustoSummaryMessageBoxMockProvider :
    PreviewParameterProvider<List<AjustoSummaryUiStateModel.MessageBox>> {

    override val values: Sequence<List<AjustoSummaryUiStateModel.MessageBox>>
        get() = sequence {
            // 1 — la zone vide : état normal, pas une erreur, pas de placeholder
            yield(emptyList())

            // 2 — un type à la fois, catalogue complet (les 8, désactivés compris)
            ContextualMessageMockCatalog.all.forEach { message ->
                yield(listOf(message.toMessageBox()))
            }

            // 3 — ce que la production affiche réellement aujourd'hui : 4 types sur 8
            yield(
                ContextualMessageMockCatalog.all
                    .filter { ContextualMessageActivation.isEnabledInProduction(it) }
                    .map { it.toMessageBox() }
            )
        }

    private fun AjustoContextualMessage.toMessageBox(): AjustoSummaryUiStateModel.MessageBox =
        ContextualMessageMapper.toMessageBox(this, PREVIEW_LANGUAGE)

    private companion object {
        // TODO WRU-26599 — une seule langue en preview pour l'instant. Si on veut aussi relire le
        // rendu en anglais, dupliquer les 3 familles ci-dessus pour Language.EN double le nombre de
        // previews : à trancher à l'usage plutôt que par avance.
        val PREVIEW_LANGUAGE = Language.FR
    }
}
