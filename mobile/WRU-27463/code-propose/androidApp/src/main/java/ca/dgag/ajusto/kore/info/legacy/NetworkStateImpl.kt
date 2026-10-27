package ca.dgag.ajusto.kore.info.legacy

import ca.dgag.ajusto.core.AndroidScope
import ca.dgag.ajusto.kore.info.BaseNetworkState
import ca.dgag.ajusto.kore.info.ConnectionType
import com.mirego.itch.core.ItchInject
import com.mirego.itch.core.ItchInjectable
import com.mirego.scratch.core.connectivity.SCRATCHConnectivityService
import timber.log.Timber

@ItchInjectable
class NetworkStateImpl : BaseNetworkState() {

    @ItchInject
    lateinit var connectivityService: SCRATCHConnectivityService

    init {
        AndroidScope.get().inject(this)
        updateConnectionType(connectionType(connectivityService.connectionType))
        connectivityService.connectionTypeObservable.subscribe { _, eventData ->
            updateConnectionType(connectionType((eventData)))
        }
    }

    // Le broadcast réseau peut arriver après les appels de démarrage.
    // Lire le service maintenant, sans attendre la mise à jour de son observable.
    override fun hasNetworkAccess(): Boolean {
        val cached = super.connectionType()
        val live = connectivityService.connectionType
        val current = if (live != null) connectionType(live) else cached
        if (cached != current) {
            Timber.d("Network check: cached=%s live=%s", cached, current)
        }
        return current.hasNetworkAccess()
    }

    private fun connectionType(eventData: SCRATCHConnectivityService.ConnectionType?): ConnectionType {
        return when (eventData) {
            SCRATCHConnectivityService.ConnectionType.NO_INTERNET -> ConnectionType.NO_INTERNET
            SCRATCHConnectivityService.ConnectionType.MOBILE -> ConnectionType.MOBILE
            SCRATCHConnectivityService.ConnectionType.WIFI -> ConnectionType.WIFI
            SCRATCHConnectivityService.ConnectionType.ETHERNET -> ConnectionType.ETHERNET
            else -> ConnectionType.UNKNOWN
        }
    }

}
