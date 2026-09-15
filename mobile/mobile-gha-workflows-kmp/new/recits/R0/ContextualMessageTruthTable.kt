package com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage

import com.desjardins.assurancedommages.mobile.ajusto.domain.achievements.model.AjustoBadge
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualMessage
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoContextualSignals
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoRecentTrip
import com.desjardins.assurancedommages.mobile.ajusto.domain.contextualmessage.model.AjustoTip
import kotlinx.datetime.Instant

/**
 * Jeu de données de référence pour la zone de messages contextuels.
 *
 * Ce n'est pas un test : c'est la liste des cas, avec pour chacun les signaux d'entrée et ce qui
 * doit sortir. Les tests bouclent dessus. Le séparer des tests permet trois choses :
 *
 *  1. le relire sans lire de code de test — chaque cas porte un nom en français ;
 *  2. l'alimenter depuis plusieurs harnais — le même jeu peut être exécuté contre la cascade
 *     Kotlin en commonTest, et contre la cascade Java d'origine depuis un test JVM qui dépend du
 *     Core, ce qui compare les deux implémentations tant qu'elles coexistent ;
 *  3. le faire grandir par petites touches — chaque message branché ajoute ses cas sans toucher
 *     aux autres.
 *
 * ── LE POINT QUI COMPTE ────────────────────────────────────────────────────────────────────────
 * [Cas.attenduCascadeJava] est la tête de liste attendue une fois le conseil retiré, c'est-à-dire
 * le message unique qu'aurait choisi la cascade Java pour les mêmes signaux.
 *
 * Cette valeur doit être établie en LISANT le Java (`AjustoContextualMessageHelper`), jamais en
 * exécutant l'implémentation Kotlin. La renseigner depuis le code testé ferait passer tous les
 * tests sans rien prouver — et c'est une erreur facile à commettre sans s'en apercevoir.
 * ───────────────────────────────────────────────────────────────────────────────────────────────
 */
object ContextualMessageTruthTable {

    /**
     * @param nom             ce que le cas met en scène, en français
     * @param signaux         l'état d'entrée
     * @param conseil         le « Bon à savoir » du jour, s'il y en a un — il arrive par un autre
     *                        chemin que les signaux, d'où le paramètre séparé
     * @param attendu         la liste complète attendue, DANS L'ORDRE d'affichage
     * @param attenduCascadeJava  le message unique qu'aurait rendu la cascade Java, ou null si
     *                        elle n'en rendait aucun. Sert à vérifier que la tête de liste n'a pas
     *                        changé de comportement.
     */
    data class Cas(
        val nom: String,
        val signaux: AjustoContextualSignals,
        val conseil: AjustoContextualMessage.GoodToKnow? = null,
        val attendu: List<AjustoContextualMessage>,
        val attenduCascadeJava: AjustoContextualMessage?
    )

    // ── Fabriques ────────────────────────────────────────────────────────────────────────────

    /**
     * Part de l'état « aucune alerte » et ne surcharge que ce que le cas veut poser. Sans cela
     * chaque cas serait un bloc de quatorze paramètres et la table deviendrait illisible.
     */
    private fun signaux(
        marqueCompatible: Boolean = true,
        appareilCompatible: Boolean = true,
        batterieFaible: Boolean = false,
        enCharge: Boolean = false,
        economieEnergie: Boolean = false,
        enregistrementEnCours: Boolean = false,
        mode: String? = null,
        nombreDeTrajets: Int = 0,
        trajetsRecents: List<AjustoRecentTrip> = emptyList(),
        invitationNonEcartee: Boolean = true,
        joursAvantEntreeEnVigueur: Int? = null,
        medailles: List<AjustoBadge> = emptyList(),
        nomDuProgramme: String = "Ajusto"
    ) = AjustoContextualSignals(
        recentTrips = trajetsRecents,
        isRecording = enregistrementEnCours,
        badges = medailles,
        isDeviceCompatible = appareilCompatible,
        mode = mode,
        numberOfTrips = nombreDeTrajets,
        isBatteryLow = batterieFaible,
        isBatteryChargeSustained = enCharge,
        isPowerSavingModeEnabled = economieEnergie,
        isDeviceBrandCompatible = marqueCompatible,
        remainingDaysUntilPolicyTakesEffect = joursAvantEntreeEnVigueur,
        isClassifyInviteQualified = invitationNonEcartee,
        drivingProgramName = nomDuProgramme
    )

    /**
     * `previousBadge` et `nextBadge` n'ont pas de valeur par défaut dans [AjustoBadge] : toute
     * construction doit les passer, null compris. D'où cette fabrique.
     */
    fun medaille(
        identifiant: String = "medaille_demo",
        famille: String = "SNAP",
        niveau: Int = 1,
        reclamable: Boolean = true
    ) = AjustoBadge(
        identifier = identifiant,
        groupIdentifier = famille,
        level = niveau,
        isClaimable = reclamable,
        previousBadge = null,
        nextBadge = null
    )

    fun trajet(
        debut: Instant = Instant.fromEpochSeconds(0),
        etiqueteParLaPersonne: Boolean = false,
        mulligan: Boolean = false
    ) = AjustoRecentTrip(
        startDate = debut,
        isUserLabeled = etiqueteParLaPersonne,
        isMulligan = mulligan
    )

    private val conseilDuJour =
        AjustoContextualMessage.GoodToKnow(AjustoTip(identifier = "AJUSTO_TIP_DEMO"))

    private val medailleReclamable = medaille()

    /**
     * Les signaux qui déclenchent l'invitation à étiqueter : mode continu, plus de cinq trajets,
     * pas plus de vingt, aucun trajet récent étiqueté, invitation jamais écartée.
     */
    private fun signauxInvitation(
        batterieFaible: Boolean = false,
        medailles: List<AjustoBadge> = emptyList()
    ) = signaux(
        mode = "continuous4",
        nombreDeTrajets = 10,
        batterieFaible = batterieFaible,
        medailles = medailles
    )

    // ── Les cas ──────────────────────────────────────────────────────────────────────────────

    /** Un seul message à la fois — la base. */
    private val unSeulMessage = listOf(
        Cas(
            nom = "aucun signal actif — la zone reste vide",
            signaux = signaux(),
            attendu = emptyList(),
            attenduCascadeJava = null
        ),
        Cas(
            nom = "marque non compatible",
            signaux = signaux(marqueCompatible = false),
            attendu = listOf(AjustoContextualMessage.DeviceBrandNotCompatible),
            attenduCascadeJava = AjustoContextualMessage.DeviceBrandNotCompatible
        ),
        Cas(
            nom = "appareil non compatible",
            signaux = signaux(appareilCompatible = false),
            attendu = listOf(AjustoContextualMessage.DeviceNotCompatible("Ajusto")),
            attenduCascadeJava = AjustoContextualMessage.DeviceNotCompatible("Ajusto")
        ),
        Cas(
            nom = "batterie faible",
            signaux = signaux(batterieFaible = true),
            attendu = listOf(AjustoContextualMessage.LowBattery),
            attenduCascadeJava = AjustoContextualMessage.LowBattery
        ),
        Cas(
            nom = "economie d'energie",
            signaux = signaux(economieEnergie = true),
            attendu = listOf(AjustoContextualMessage.PowerSaving),
            attenduCascadeJava = AjustoContextualMessage.PowerSaving
        ),
        Cas(
            nom = "invitation a etiqueter",
            signaux = signauxInvitation(),
            attendu = listOf(AjustoContextualMessage.ClassifyInvite),
            attenduCascadeJava = AjustoContextualMessage.ClassifyInvite
        ),
        Cas(
            nom = "entree en vigueur dans 3 jours",
            signaux = signaux(joursAvantEntreeEnVigueur = 3),
            attendu = listOf(AjustoContextualMessage.PolicyEffective(3)),
            attenduCascadeJava = AjustoContextualMessage.PolicyEffective(3)
        ),
        Cas(
            nom = "une medaille reclamable",
            signaux = signaux(medailles = listOf(medailleReclamable)),
            attendu = listOf(AjustoContextualMessage.Badge(medailleReclamable)),
            attenduCascadeJava = AjustoContextualMessage.Badge(medailleReclamable)
        ),
        Cas(
            nom = "un conseil disponible, rien d'autre",
            signaux = signaux(),
            conseil = conseilDuJour,
            attendu = listOf(conseilDuJour),
            // Le conseil n'existe pas dans la cascade Java : elle ne rendait rien pour ces signaux.
            attenduCascadeJava = null
        )
    )

    /**
     * Deux regles d'une meme famille sont vraies ensemble : une seule doit sortir, la plus
     * prioritaire. C'est ce qui distingue une famille d'un simple groupe d'affichage.
     */
    private val cascadesInternes = listOf(
        Cas(
            nom = "marque ET appareil non compatibles — la marque gagne",
            signaux = signaux(marqueCompatible = false, appareilCompatible = false),
            attendu = listOf(AjustoContextualMessage.DeviceBrandNotCompatible),
            attenduCascadeJava = AjustoContextualMessage.DeviceBrandNotCompatible
        ),
        Cas(
            nom = "batterie faible ET economie d'energie — la batterie gagne",
            signaux = signaux(batterieFaible = true, economieEnergie = true),
            attendu = listOf(AjustoContextualMessage.LowBattery),
            attenduCascadeJava = AjustoContextualMessage.LowBattery
        ),
        Cas(
            nom = "marque non compatible ET batterie faible — la marque gagne",
            signaux = signaux(marqueCompatible = false, batterieFaible = true),
            attendu = listOf(AjustoContextualMessage.DeviceBrandNotCompatible),
            attenduCascadeJava = AjustoContextualMessage.DeviceBrandNotCompatible
        ),
        Cas(
            nom = "appareil non compatible ET economie d'energie — l'appareil gagne",
            signaux = signaux(appareilCompatible = false, economieEnergie = true),
            attendu = listOf(AjustoContextualMessage.DeviceNotCompatible("Ajusto")),
            attenduCascadeJava = AjustoContextualMessage.DeviceNotCompatible("Ajusto")
        ),
        Cas(
            nom = "invitation ET entree en vigueur — l'invitation gagne",
            signaux = signauxInvitation().copy(remainingDaysUntilPolicyTakesEffect = 3),
            attendu = listOf(AjustoContextualMessage.ClassifyInvite),
            attenduCascadeJava = AjustoContextualMessage.ClassifyInvite
        )
    )

    /**
     * Des familles differentes s'appliquent en meme temps : les messages s'empilent. C'est le
     * changement de comportement voulu par rapport au Java, qui n'en rendait qu'un.
     *
     * L'ordre est toujours le meme : le conseil, puis les avis par priorite croissante, puis la
     * medaille.
     */
    private val empilement = listOf(
        Cas(
            nom = "batterie faible ET invitation — deux avis",
            signaux = signauxInvitation(batterieFaible = true),
            attendu = listOf(
                AjustoContextualMessage.LowBattery,
                AjustoContextualMessage.ClassifyInvite
            ),
            attenduCascadeJava = AjustoContextualMessage.LowBattery
        ),
        Cas(
            nom = "batterie faible ET medaille",
            signaux = signaux(batterieFaible = true, medailles = listOf(medailleReclamable)),
            attendu = listOf(
                AjustoContextualMessage.LowBattery,
                AjustoContextualMessage.Badge(medailleReclamable)
            ),
            attenduCascadeJava = AjustoContextualMessage.LowBattery
        ),
        Cas(
            nom = "invitation ET medaille",
            signaux = signauxInvitation(medailles = listOf(medailleReclamable)),
            attendu = listOf(
                AjustoContextualMessage.ClassifyInvite,
                AjustoContextualMessage.Badge(medailleReclamable)
            ),
            attenduCascadeJava = AjustoContextualMessage.ClassifyInvite
        ),
        Cas(
            nom = "conseil ET batterie faible — le conseil en tete",
            signaux = signaux(batterieFaible = true),
            conseil = conseilDuJour,
            attendu = listOf(conseilDuJour, AjustoContextualMessage.LowBattery),
            attenduCascadeJava = AjustoContextualMessage.LowBattery
        ),
        Cas(
            nom = "conseil, batterie faible ET medaille — trois boites",
            signaux = signaux(batterieFaible = true, medailles = listOf(medailleReclamable)),
            conseil = conseilDuJour,
            attendu = listOf(
                conseilDuJour,
                AjustoContextualMessage.LowBattery,
                AjustoContextualMessage.Badge(medailleReclamable)
            ),
            attenduCascadeJava = AjustoContextualMessage.LowBattery
        ),
        Cas(
            // Le plafond. Quatre familles distinctes, donc quatre boites — voir le document 21,
            // qui montre cette configuration comme atteignable et non theorique.
            nom = "LE CAS MAXIMAL — conseil, batterie, invitation et medaille",
            signaux = signauxInvitation(
                batterieFaible = true,
                medailles = listOf(medailleReclamable)
            ),
            conseil = conseilDuJour,
            attendu = listOf(
                conseilDuJour,
                AjustoContextualMessage.LowBattery,
                AjustoContextualMessage.ClassifyInvite,
                AjustoContextualMessage.Badge(medailleReclamable)
            ),
            attenduCascadeJava = AjustoContextualMessage.LowBattery
        )
    )

    /**
     * Une condition ressemble a un declencheur mais n'en est pas un. Ces cas protegent contre
     * l'erreur inverse de celle qu'on cherche d'habitude : afficher un message de trop.
     */
    private val fauxDeclencheurs = listOf(
        Cas(
            nom = "economie d'energie PENDANT un enregistrement — rien",
            signaux = signaux(economieEnergie = true, enregistrementEnCours = true),
            attendu = emptyList(),
            attenduCascadeJava = null
        ),
        Cas(
            nom = "batterie faible MAIS en charge soutenue — rien",
            signaux = signaux(batterieFaible = true, enCharge = true),
            attendu = emptyList(),
            attenduCascadeJava = null
        ),
        Cas(
            nom = "entree en vigueur dans 0 jour — rien",
            signaux = signaux(joursAvantEntreeEnVigueur = 0),
            attendu = emptyList(),
            attenduCascadeJava = null
        ),
        Cas(
            nom = "des medailles, mais aucune reclamable — rien",
            signaux = signaux(medailles = listOf(medaille(reclamable = false))),
            attendu = emptyList(),
            attenduCascadeJava = null
        ),
        Cas(
            nom = "invitation : un trajet recent est deja etiquete — rien",
            signaux = signauxInvitation().copy(
                recentTrips = listOf(trajet(etiqueteParLaPersonne = true))
            ),
            attendu = emptyList(),
            attenduCascadeJava = null
        ),
        Cas(
            nom = "invitation : elle a ete ecartee — rien",
            signaux = signauxInvitation().copy(isClassifyInviteQualified = false),
            attendu = emptyList(),
            attenduCascadeJava = null
        ),
        Cas(
            nom = "invitation : le mode n'est pas le mode continu — rien",
            signaux = signauxInvitation().copy(mode = "none"),
            attendu = emptyList(),
            attenduCascadeJava = null
        ),
        Cas(
            nom = "invitation : plus de vingt trajets — rien",
            signaux = signauxInvitation().copy(numberOfTrips = 21),
            attendu = emptyList(),
            attenduCascadeJava = null
        )
    )

    /** Tous les cas, dans l'ordre de lecture. */
    val cas: List<Cas> = unSeulMessage + cascadesInternes + empilement + fauxDeclencheurs
}
