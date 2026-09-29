// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   aio  androidApp/src/main/java/ca/dgag/ajusto/ajusto/dashboard/AjustoDashboardFragment.kt
//        l. 270-355 — LE RENDU ACTUEL fait foi, pas le texte brut du Core Java.
//   core-lib  .../core/trip/AjustoContextualMessageHelper.java — les clés de traduction exactes
//   À y lire    titre, icône et teinte de chaque cas, tels qu'ils s'affichent aujourd'hui.
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.ajusto.presentation.summary

import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage
import com.desjardins.assurancedommages.mobile.transverse.domain.localized.Language
import com.desjardins.assurancedommages.mobile.transverse.presentation.localized.AjustoLocalizedString
import com.desjardins.assurancedommages.mobile.transverse.presentation.localized.format
import com.desjardins.assurancedommages.mobile.transverse.presentation.localized.get

// WRU-26599-R0 — fichier CRÉÉ par ce récit
/**
 * Traduit un [AjustoContextualMessage] (zéro texte) en [AjustoSummaryUiStateModel.MessageBox]
 * (texte + icône + teinte). DOIT REPRODUIRE le rendu du Dashboard legacy, pas le texte brut du
 * Core Java — vérifié dans AjustoDashboardFragment.kt (l. 270-355) :
 *  - le titre du badge est SUBSTITUÉ par AJUSTO_DASHBOARD_NEW_MEDAL_TITLE, jamais badge.title
 *    (décision D4, déjà tranchée par l'existant — un Summary qui afficherait badge.getTitle()
 *    serait une régression visuelle).
 *  - la teinte EST lue et mappée : ACCENT→BRAND, WARNING→WARNING, BLUE→BLUE, RED→RED,
 *    null→DEFAULT (getKoreIconColorFromColorKey()).
 *
 * TODO WRU-26599 — BLOQUANT (doc 17 §4, préalable) : les clés AjustoLocalizedString référencées
 * ci-dessous (CONTEXTUAL_MESSAGE_*, UBI_ONBOARDING_UNAVAILABLE_DEVICE_*,
 * AJUSTO_BRAND_NOT_COMPATIBLE_CONTEXTUAL_MESSAGE_*, AJUSTO_DASHBOARD_NEW_MEDAL_TITLE,
 * CONTEXTUAL_MESSAGE_CLAIM_BADGE_BUTTON) sont les clés EXACTES du Core Java
 * (AjustoContextualMessageHelper.java / LocalizedString.java) mais n'existent pas encore
 * forcément dans l'enum généré AjustoLocalizedString tant que
 * modules/transverse/presentation/.../resources/translations-kore.json reste VIDE (0 o) —
 * sans lui, generateTranslations ne produit rien et ce fichier ne compile pas. Ajouter ces 19
 * clés au JSON Lokalise avant le lot 6 (doc 17 §2 entrée ⑬, checklist §4).
 */
object ContextualMessageMapper {

    fun toMessageBox(message: AjustoContextualMessage, language: Language): AjustoSummaryUiStateModel.MessageBox =
        when (message) {
            is AjustoContextualMessage.DeviceBrandNotCompatible -> AjustoSummaryUiStateModel.MessageBox(
                title = AjustoLocalizedString.AJUSTO_BRAND_NOT_COMPATIBLE_CONTEXTUAL_MESSAGE_TITLE.get(language),
                message = AjustoLocalizedString.AJUSTO_BRAND_NOT_COMPATIBLE_CONTEXTUAL_MESSAGE_TEXT.get(language),
                // Bouton volontairement omis — décision D2 : "modélisé, non rendu" (action morte côté Java).
                iconKey = AjustoSummaryIconKey.WarningSign(iconColor = null)
            )

            is AjustoContextualMessage.DeviceNotCompatible -> AjustoSummaryUiStateModel.MessageBox(
                title = AjustoLocalizedString.UBI_ONBOARDING_UNAVAILABLE_DEVICE_TITLE.get(language),
                message = AjustoLocalizedString.UBI_ONBOARDING_UNAVAILABLE_DEVICE_MESSAGE
                    .format(language, message.drivingProgramName),
                iconKey = AjustoSummaryIconKey.DeviceNotCompatible(iconColor = null)
            )

            AjustoContextualMessage.LowBattery -> AjustoSummaryUiStateModel.MessageBox(
                title = AjustoLocalizedString.CONTEXTUAL_MESSAGE_LOW_BATTERY_TITLE.get(language),
                message = AjustoLocalizedString.CONTEXTUAL_MESSAGE_LOW_BATTERY_TEXT.get(language),
                iconKey = AjustoSummaryIconKey.BatteryLow(AjustoSummaryIconColor.RED)
            )

            AjustoContextualMessage.PowerSaving -> AjustoSummaryUiStateModel.MessageBox(
                title = AjustoLocalizedString.CONTEXTUAL_MESSAGE_POWER_SAVING_TITLE.get(language),
                message = AjustoLocalizedString.CONTEXTUAL_MESSAGE_POWER_SAVING_TEXT.get(language),
                iconKey = AjustoSummaryIconKey.BatteryLow(AjustoSummaryIconColor.WARNING)
            )

            AjustoContextualMessage.ClassifyInvite -> AjustoSummaryUiStateModel.MessageBox(
                title = AjustoLocalizedString.CONTEXTUAL_MESSAGE_CLASSIFY_INVITE_TITLE.get(language),
                message = AjustoLocalizedString.CONTEXTUAL_MESSAGE_CLASSIFY_INVITE_TEXT.get(language),
                iconKey = AjustoSummaryIconKey.EditPen(AjustoSummaryIconColor.BLUE)
            )

            is AjustoContextualMessage.PolicyEffective -> AjustoSummaryUiStateModel.MessageBox(
                title = AjustoLocalizedString.CONTEXTUAL_MESSAGE_POLICY_EFFECTIVE_TITLE.get(language),
                message = AjustoLocalizedString.CONTEXTUAL_MESSAGE_POLICY_EFFECTIVE_TEXT.get(language),
                iconKey = AjustoSummaryIconKey.FileWithMedal(AjustoSummaryIconColor.BRAND) // teinte ACCENT→BRAND
            )

            is AjustoContextualMessage.Badge -> AjustoSummaryUiStateModel.MessageBox(
                // ═══ ALIGNÉ SUR LA MAQUETTE LE 2026-09-14 (décision de ken) ═══════════════════
                // La maquette montre deux lignes et rien d'autre :
                //     « Félicitations pour votre nouvelle médaille ! »
                //     « → Touchez pour la réclamer »
                //
                // Trois écarts corrigés par rapport à la version précédente de ce mapper :
                //  1. le NOM DE LA MÉDAILLE n'est plus affiché. Il était mis en `message` ;
                //     ni la maquette ni le tableau de bord actuel ne le montrent. Décision D4 :
                //     le titre est toujours « Félicitations… », jamais badge.title.
                //  2. `message` est donc VIDE — la boîte n'a pas de texte de corps. La vue saute
                //     le rendu quand il est vide (voir AjustoSummaryMessageBox).
                //  3. `buttonText` porte « Touchez pour la réclamer », rendu comme une LIGNE
                //     D'ACTION cliquable et non comme un bouton — c'est ce que montre la maquette,
                //     et c'est aussi ce que fait le tableau de bord actuel.
                //
                // `action` reste OnClaimBadge : la vue rend la boîte entière cliquable dès qu'une
                // action est présente, donc la ligne « Touchez pour la réclamer » l'est aussi.
                //
                // TODO WRU-26599 — destination de l'action à confirmer : la réclamation mène
                // probablement à l'écran des médailles (achievements). Le nom d'événement actuel
                // est NavigateToClaimedBadgeView ; vérifier qu'il pointe au bon endroit.
                // TODO WRU-26599 — checklist lot 6 : OnClaimBadge doit porter le badgeIdentifier,
                // sinon l'écran de destination ne sait pas quelle médaille afficher. Ça touche
                // AjustoSummaryAction et AjustoSummaryEvent, hors du périmètre de ce fichier.
                title = AjustoLocalizedString.AJUSTO_DASHBOARD_NEW_MEDAL_TITLE.get(language),
                message = "",
                buttonText = AjustoLocalizedString.CONTEXTUAL_MESSAGE_CLAIM_BADGE_BUTTON.get(language),
                action = AjustoSummaryAction.OnClaimBadge,
                iconKey = AjustoSummaryIconKey.FileWithMedal(AjustoSummaryIconColor.GREEN)
            )

            is AjustoContextualMessage.GoodToKnow -> AjustoSummaryUiStateModel.MessageBox(
                // TODO WRU-26599 — le contenu réel dépend de la source confirmée de AjustoTip
                // (voir AjustoTipDataSource) ; ce mapper suppose que le titre/texte sont déjà
                // résolus en amont une fois la source tranchée.
                title = message.tip.identifier,
                message = message.tip.identifier,
                iconKey = AjustoSummaryIconKey.LightBulb
            )
        }
}
