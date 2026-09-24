// WRU-26599-R0 — fichier CRÉÉ par ce récit
package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model

import com.desjardins.assurancedommages.mobile.ajusto.domain.achievements.model.AjustoBadge
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.datasource.AjustoRecentTrip

/**
 * Les treize signaux d'entrée de la décision, assemblés par le repository.
 *
 * POURQUOI TOUTES LES VALEURS PAR DÉFAUT SONT OBLIGATOIRES.
 * Côté Java, l'assemblage attend que TOUTES les sources aient répondu avant de se prononcer. Tant
 * que le profil du SDK n'a pas répondu, aucun message ne s'affiche — pas même la batterie, dont le
 * signal est pourtant disponible. Au premier lancement, la zone reste donc vide.
 *
 * Les valeurs par défaut empêchent de reproduire ce défaut : une règle se prononce dès que SES
 * signaux sont connus. Chaque défaut est « l'état qui ne déclenche aucune alerte ».
 *
 * Effet secondaire utile : un récit peut brancher son signal sans que les douze autres existent.
 */
data class AjustoContextualSignals(

    // ── Trajets — SDK télématique, branchés par R3 ────────────────────────────────────────────
    /** Trajets déjà filtrés : après la date de police, moins de 90 jours, hors rattrapage. */
    val recentTrips: List<AjustoRecentTrip> = emptyList(),

    // ── Enregistrement — SDK télématique, branché par R1 ──────────────────────────────────────
    val isRecording: Boolean = false,

    // ── Médailles — requête signée par le SDK, branchées par R5 ───────────────────────────────
    val badges: List<AjustoBadge> = emptyList(),

    // ── Compatibilité — requête HTTP + cache, branchée par R2 ─────────────────────────────────
    /** Liste blanche serveur ET capteurs présents. Défaut : compatible. */
    val isDeviceCompatible: Boolean = true,

    // ── Compte Ajusto — déjà en KMP, branché par R3 ───────────────────────────────────────────
    /** Comparaison EXACTE et sensible à la casse avec "continuous4". */
    val mode: String? = null,
    val numberOfTrips: Int = 0,

    // ── État du téléphone — branché par R1 ────────────────────────────────────────────────────
    /** Niveau inférieur ou égal à 20 %, d'après la dernière diffusion système reçue. */
    val isBatteryLow: Boolean = false,
    val isBatteryChargeSustained: Boolean = false,
    /** Lu en direct sur le service système : Android ne prévient pas quand ce mode bascule. */
    val isPowerSavingModeEnabled: Boolean = false,
    /** Faux si le fabricant est sur liste d'exclusion. Défaut : compatible. */
    val isDeviceBrandCompatible: Boolean = true,

    // ── Profil — SDK télématique, branché par R4 ──────────────────────────────────────────────
    /** null tant que le profil n'a pas répondu — ce qui ne bloque aucune autre règle. */
    val remainingDaysUntilPolicyTakesEffect: Int? = null,

    // ── Invitation à identifier — stockage local, branché par R3 ──────────────────────────────
    /** Au moins un trajet de la fenêtre récente a été identifié par la personne. */
    val hasEverLabeledATrip: Boolean = false,
    /** Faux si la personne a écarté l'invitation. Défaut : elle ne l'a pas écartée. */
    val isClassifyInviteQualified: Boolean = true,

    // ── Interpolation du message « appareil non compatible » — branchée par R2 ────────────────
    val drivingProgramName: String = ""
)
