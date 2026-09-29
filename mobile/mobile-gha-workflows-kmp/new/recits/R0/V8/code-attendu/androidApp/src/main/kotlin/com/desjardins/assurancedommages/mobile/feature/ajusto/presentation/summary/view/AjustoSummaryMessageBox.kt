package com.desjardins.assurancedommages.mobile.feature.ajusto.presentation.summary.view

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import ca.dgag.ajusto.compose.dsd.theme.DgagPreview
import ca.dgag.ajusto.compose.dsd.theme.DgagTheme
import ca.dgag.ajusto.compose.dsd.theme.TpicPreview
import ca.dgag.ajusto.compose.dsd.theme.TpicTheme
import com.desjardins.assurancedommages.mobile.ajusto.presentation.summary.AjustoSummaryUiStateModel
import com.desjardins.assurancedommages.mobile.feature.ajusto.presentation.summary.preview.AjustoSummaryMessageBoxMockProvider

// WRU-26599-R0 — fichier CRÉÉ par ce récit
/**
 * Zone de messages contextuels du Summary, insérée APRÈS InformationalListSection et AVANT
 * TileButtonsSection (doc 17 §3.3, comme sur le Dashboard legacy — AjustoDashboardFragment.kt
 * l. 122-145). Empile jusqu'à N boîtes, une par catégorie non vide — la liste peut être VIDE,
 * état normal confirmé produit (doc 17 §4) : ne rien afficher dans ce cas, pas de placeholder.
 *
 * TODO WRU-26599 — reprendre les styles/tokens exacts du design system du module (couleurs,
 * espacements) au lieu des valeurs MaterialTheme par défaut ci-dessous — cette passe n'a pas
 * relu le fichier de thème Compose du module pour ne pas inventer les tokens de couleur/teinte.
 * TODO WRU-26599 — key() stable par type de message (checklist lot 6, doc 17 §4) — pas encore
 * appliqué ici, à faire au moment de brancher la Column réelle dans AjustoSummaryScreen.
 */
@Composable
fun AjustoSummaryMessageBoxSection(messageBoxes: List<AjustoSummaryUiStateModel.MessageBox>, onAction: (Any) -> Unit) {
    if (messageBoxes.isEmpty()) return // état normal, voir doc ci-dessus — rien à afficher

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        messageBoxes.forEach { messageBox ->
            AjustoSummaryMessageBox(messageBox = messageBox, onAction = onAction)
        }
    }
}

/**
 * Une boîte. La maquette montre trois éléments au plus : un titre, un texte de corps facultatif,
 * et une ligne d'action facultative — « → Touchez pour la réclamer » dans le cas de la médaille.
 *
 * ═══ RENDU DE L'ACTION, DÉCIDÉ LE 2026-09-14 (ken) ══════════════════════════════════════════
 * La boîte ENTIÈRE est cliquable dès qu'une action est présente, et ne l'est pas du tout sinon.
 * Deux raisons : la maquette ne montre pas de bouton, juste une ligne cliquable ; et une boîte
 * sans action ne fait alors simplement rien, ce qui évite d'avoir deux comportements à gérer.
 *
 * La ligne d'action n'est donc PAS une cible de clic à part — ce serait une cible imbriquée dans
 * une autre, mauvais pour l'accessibilité comme pour le pointage. Elle est l'indice visuel qui
 * dit que la boîte est cliquable.
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * TODO WRU-26599 — la maquette montre une flèche dans un cercle devant le libellé d'action. Le
 * dessin exact n'a pas été identifié dans le design system : à reprendre avec le design plutôt
 * qu'à deviner un nom de ressource.
 * TODO WRU-26599 — accessibilité : la boîte cliquable doit annoncer son rôle et sa destination.
 * À traiter avec le récit sur la fermeture des messages (la croix), qui ajoutera une seconde
 * cible de clic dans la même boîte.
 */
@Composable
private fun AjustoSummaryMessageBox(messageBox: AjustoSummaryUiStateModel.MessageBox, onAction: (Any) -> Unit) {
    val action = messageBox.action

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .then(
                if (action != null) {
                    Modifier.clickable { onAction(action) }
                } else {
                    Modifier
                }
            )
            .padding(16.dp)
    ) {
        Text(text = messageBox.title, style = MaterialTheme.typography.titleSmall)

        // Vide pour la médaille : la maquette n'y met aucun texte de corps.
        if (messageBox.message.isNotBlank()) {
            Text(text = messageBox.message, style = MaterialTheme.typography.bodyMedium)
        }

        messageBox.buttonText?.let { actionLabel ->
            Row(modifier = Modifier.padding(top = 8.dp)) {
                Text(
                    text = actionLabel,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PREVIEWS — WRU-26599, réécrites le 2026-09-10 (doc 19 §3.3)
//
// AVANT : sept @Preview nues, avec des titres et des messages écrits à la main dans ce fichier.
// Trois problèmes : ça ne suivait pas la convention de l'écran (PreviewParameterProvider dans
// preview/, @DgagPreview/@TpicPreview, previews centralisées) ; les textes en dur mentaient dès
// que le mapper changeait ; et rien ne garantissait qu'un nouveau type de message obtienne sa
// preview.
//
// APRÈS : deux fonctions seulement. Toutes les valeurs viennent de
// AjustoSummaryMessageBoxMockProvider, qui dérive lui-même de ContextualMessageMockCatalog —
// catalogue verrouillé sur la sealed class par un `when` exhaustif ET par un test sur
// sealedSubclasses. Compose génère donc une preview par état déclaré, automatiquement :
// la liste vide, puis les 8 types un par un, puis l'empilement réellement affiché en production.
//
// TODO WRU-26599 — CONVENTION : dans cet écran, les fonctions de preview sont centralisées dans
// AjustoSummaryScreen.kt, pas dans le fichier du composant. Elles sont ici uniquement parce que
// AjustoSummaryScreen.kt est un fichier SOURCE EXISTANT qu'on ne modifie pas tant que le lot 6
// n'est pas fusionné (règle du chantier : on ne touche pas aux sources, on propose à côté).
// Au moment de la fusion : déplacer ces deux fonctions dans AjustoSummaryScreen.kt et supprimer
// ce bloc.
// ─────────────────────────────────────────────────────────────────────────────────────────────

@DgagPreview
@Composable
internal fun AjustoSummaryMessageBoxDgagPreview(
    @PreviewParameter(provider = AjustoSummaryMessageBoxMockProvider::class)
    messageBoxes: List<AjustoSummaryUiStateModel.MessageBox>
) {
    DgagTheme {
        AjustoSummaryMessageBoxSection(
            messageBoxes = messageBoxes,
            onAction = {}
        )
    }
}

@TpicPreview
@Composable
internal fun AjustoSummaryMessageBoxTpicPreview(
    @PreviewParameter(provider = AjustoSummaryMessageBoxMockProvider::class)
    messageBoxes: List<AjustoSummaryUiStateModel.MessageBox>
) {
    TpicTheme {
        AjustoSummaryMessageBoxSection(
            messageBoxes = messageBoxes,
            onAction = {}
        )
    }
}
