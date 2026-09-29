// WRU-26599-R1 — fichier CRÉÉ par ce récit
// ══ INSPIRATION ═══════════════════════════════════════════════════════════════════════════════
//   Core Java   core-lib  src/main/java/ca/dgag/ajusto/core/DeviceInfo.java
//                         → 4 membres sur 14 : isBatteryLow() · isBatteryChargeSustained()
//                           · isPowerSavingModeEnabled() · isAjustoDeviceBrandCompatible()
//   Kore KMP    aio  shared/src/commonMain/kotlin/ca/dgag/ajusto/kore/info/DeviceInfo.kt
//                    → l'interface KMP qui existe DÉJÀ au-dessus du Core, mêmes 14 membres
//   À y lire    quels signaux sont exposés. Les 10 autres membres (langue, matériel, localisation,
//               permissions, canCall) restent sur le Core : hors périmètre des messages contextuels.
//
// ══ NOM : POURQUOI PAS « DataSource » ═════════════════════════════════════════════════════════
// Une version antérieure l'appelait DeviceStateDataSource. Deux raisons d'abandonner ce nom :
//   · « DataSource » est un mot de la couche data — dans ce dépôt il désigne ce qui va chercher
//     des données ailleurs (AccountRemoteDataSource, AnalyticRemoteDataSource). Ici on lit une
//     CAPACITÉ DE LA PLATEFORME, pas une source de données.
//   · Les capacités de plateforme du dépôt ne portent pas ce suffixe : BiometryProtectedStorage,
//     AuthService, CmtSessionController. Ce port suit la même règle.
//
// ══ FORME : INTERFACE + expect class ══════════════════════════════════════════════════════════
// Calquée sur le couple BiometryProtectedStorage / PlatformBiometryProtectedStorage du dépôt :
// l'INTERFACE ici, pour que les tests puissent en fournir un faux ; l'IMPLÉMENTATION dans un
// `expect class` à côté, avec ses deux `actual` en .android.kt et .ios.kt.
// ══════════════════════════════════════════════════════════════════════════════════════════════
package com.desjardins.assurancedommages.mobile.transverse.domain.device

import kotlinx.coroutines.flow.StateFlow

interface DeviceStateProvider {

    /** Port de DeviceInfoImpl.isBatteryLow() — niveau en POURCENTAGE inférieur ou égal à 20. */
    val isBatteryLow: StateFlow<Boolean>

    /** Port de DeviceInfoImpl.isBatteryChargeSustained() — l'appareil est en charge. */
    val isBatteryChargeSustained: StateFlow<Boolean>

    /** Port de DeviceInfoImpl.isPowerSavingModeEnabled() — mode économie d'énergie actif. */
    val isPowerSavingModeEnabled: StateFlow<Boolean>

    /**
     * Port de DeviceInfoImpl.isAjustoDeviceBrandCompatible().
     *
     * VALEUR SIMPLE, PAS UN FLUX — le fabricant ne change jamais en cours d'exécution. Un flux qui
     * n'émettrait qu'une fois coûterait un abonnement pour rien.
     */
    val isDeviceBrandCompatible: Boolean

    /**
     * TODO WRU-26599-R1 — trancher qui les appelle : le graphe d'injection au démarrage, ou le
     * ViewModel de l'écran ? Côté Java, DeviceInfoImpl s'abonne lui-même au cycle de vie et
     * n'écoute qu'en avant-plan ; reproduire ce couplage ici ferait entrer le cycle de vie dans le
     * domaine. Le second choix corrige au passage le piège du retour d'avant-plan.
     */
    fun startObserving()

    fun stopObserving()
}
