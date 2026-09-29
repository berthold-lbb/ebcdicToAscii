// WRU-26599-R0 — fichier CRÉÉ par ce récit
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   Core Java   core-lib  .../core/badge/Badge.java        — les identifiants de famille
//               core-lib  .../core/badge/BadgeScoper.java  — quelles familles sont EXCLUES
//   À y lire    la liste des familles retenues et le motif des exclusions.
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model

/**
 * Les sept familles de médailles.
 *
 * L'ORDRE DE DÉCLARATION EST SIGNIFICATIF : c'est l'ordre de recherche de la médaille réclamable.
 * Il reproduit celui de la table de classement du Core (BadgeScoper.java). Le modifier change la
 * médaille proposée.
 *
 * La famille TURN existe côté Core (Badge.BADGE_SCOPE_TURN) mais N'EST PAS reprise ici : la table
 * de classement du Java ne la contient pas, donc un badge de cette famille y est ignoré. Exclusion
 * volontaire, verrouillée par un test — ne pas l'ajouter en croyant corriger un oubli.
 */
enum class AjustoBadgeScope(val identifier: String) {
    SNAP("SNAP"),
    FIRSTSCORE("FIRSTSCORE"),
    TOTAL("TOTAL"),
    BRAKE("BRAKE"),
    DISTRACTION("DISTRACTION"),
    SPEEDING("SPEEDING"),
    ACCEL("ACCEL");

    companion object {

        /**
         * Le niveau maximum de médaille pris en charge, toutes familles confondues.
         *
         * SIMPLIFICATION ASSUMÉE : le Core borne avec badge.supportedBadgeLevels(), qui rend la
         * taille de la liste des libellés de niveaux REÇUE POUR CE BADGE. La borne y dépend donc
         * de la donnée. Le modèle KMP ne porte pas cette liste. À confirmer au récit R5.
         */
        const val MAX_SUPPORTED_LEVEL = 6

        /** Correspondance EXACTE et sensible à la casse, comme la table du Java. */
        fun fromIdentifier(identifier: String?): AjustoBadgeScope? =
            entries.firstOrNull { it.identifier == identifier }
    }
}
