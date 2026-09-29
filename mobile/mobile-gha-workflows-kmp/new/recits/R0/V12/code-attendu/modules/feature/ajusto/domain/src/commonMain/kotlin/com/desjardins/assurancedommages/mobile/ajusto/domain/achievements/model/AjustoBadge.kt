// WRU-26599-R0 — FICHIER EXISTANT, REPRODUIT ICI POUR LECTURE SEULE.
//
// Ce fichier N'EST PAS à écrire : il est déjà dans le dépôt, à ce chemin exact, et il est utilisé
// par l'écran des médailles. Il est reproduit dans code-attendu/ parce que deux choses du récit R0
// s'appuient dessus et seraient incompréhensibles sans lui :
//
//   - AjustoContextualSignals porte une `List<AjustoBadge>`, et le cas Badge de
//     AjustoContextualMessage porte un AjustoBadge ;
//   - AjustoBadgeFactory (commonTest) existe uniquement parce que `nextBadge` et `previousBadge`
//     sont les DEUX SEULS champs sur dix-huit à ne pas avoir de valeur par défaut. Toute
//     construction doit donc les passer explicitement, null compris.
//
// NE PAS RECOPIER CE FICHIER PAR-DESSUS L'ORIGINAL : si le dépôt a évolué depuis, c'est le dépôt
// qui fait foi, pas cette copie. R0 ne le modifie pas d'une ligne.
//
// Si le message « nouvelle médaille » avait besoin d'un champ absent ici, ce serait une
// modification de ce fichier, donc un sujet du récit R5 — pas de R0.

// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   Core Java   core-lib  src/main/java/ca/dgag/ajusto/core/badge/Badge.java
//                         → les champs et supportedBadgeLevels() = badgeLevelTitles.size()
//               core-lib  .../core/badge/BadgeResponse.java  — la forme rendue par l'API
//   Ce fichier N'EST PAS issu du chantier WRU-26599 : il a été écrit pour l'écran des médailles,
//   avant lui. Il est cité ici parce que les messages contextuels le RÉUTILISENT tel quel.
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.ajusto.domain.achievements.model

/**
 * Modèle de domaine remplaçant la classe Badge héritée.
 * Représente un insigne d'accomplissement dans Ajusto.
 */
data class AjustoBadge(
    val identifier: String,
    val groupIdentifier: String? = null,
    val title: String? = null,
    val summary: String? = null,
    val contextualText: String? = null,
    val badgeLevelText: String? = null,
    val level: Int = -1,
    val progress: Int = -1,
    val iconUrl: String? = null,
    val customText: String? = null,
    val nextBadge: AjustoBadge?,
    val previousBadge: AjustoBadge?,
    val hasProgression: Boolean = false,
    val isClaimable: Boolean = false,
    val isClaimed: Boolean = false,
    val isAjustoBadge: Boolean = false
) {
    enum class State { PROGRESS, LOCKED }
    enum class ProgressState { NONE, HALF, COMPLETED }

    fun getSiblingState(level: Int): State =
        if (level <= this.level) State.PROGRESS else State.LOCKED

    fun getSiblingProgressState(level: Int): ProgressState = when {
        level < this.level -> ProgressState.COMPLETED
        level > this.level -> ProgressState.NONE
        progress == 0 -> ProgressState.NONE
        progress >= 100 -> ProgressState.COMPLETED
        else -> ProgressState.HALF
    }
}
