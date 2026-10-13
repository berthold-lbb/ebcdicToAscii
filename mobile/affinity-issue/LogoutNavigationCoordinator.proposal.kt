// PROPOSITION D'ANALYSE — hors des sources compilées de l'application.
// Même contrat public que la copie locale ; quatre champs au lieu de six.
// À compiler et tester dans le dépôt complet avant intégration.
// Limite conservée : sans résultat de didFinishEvent(), le verrou reste posé.
// Voir README.md pour le traitement terminal SCRATCH à vérifier.
package ca.dgag.ajusto.authentification.logout

import android.app.Activity
import android.app.Application
import android.os.Bundle
import androidx.annotation.MainThread
import com.mirego.scratch.core.event.SCRATCHObservableCallback
import com.mirego.scratch.core.event.SCRATCHSubscriptionManager
import com.mirego.scratch.core.operation.SCRATCHOperation
import com.mirego.scratch.core.operation.SCRATCHOperationResult
import com.mirego.scratch.core.operation.UiThreadDispatchQueue
import java.lang.ref.WeakReference
import timber.log.Timber

@MainThread
class LogoutNavigationCoordinator(
    private val navigate: (Activity) -> Unit
) : Application.ActivityLifecycleCallbacks {
    // État de la demande de navigation, pas de l'authentification ni du réseau.
    private enum class NavigationState {
        IDLE,    // Aucune navigation de déconnexion demandée.
        PENDING, // Navigation demandée, en attente de pouvoir partir.
        HANDLED  // Demande consommée : ne plus lancer pour cette déconnexion.
    }

    private var foregroundActivity = WeakReference<Activity>(null)
    private var wasAuthenticated = false
    private var navigationState = NavigationState.IDLE
    private var manualSubscriptions: SCRATCHSubscriptionManager? = null

    fun onAuthenticationChanged(authenticated: Boolean) {
        if (authenticated == wasAuthenticated) return
        wasAuthenticated = authenticated
        if (!authenticated) {
            requestLogout()
        } else if (manualSubscriptions == null) {
            navigationState = NavigationState.IDLE
        }
    }

    fun requestLogout() {
        if (navigationState == NavigationState.HANDLED) return
        navigationState = NavigationState.PENDING
        navigateIfReady()
    }

    @Suppress("DEPRECATION")
    fun <T : Any> runManualLogout(
        operation: () -> SCRATCHOperation<T>,
        onCompleted: (SCRATCHOperationResult<T>) -> Unit = {}
    ): Boolean {
        if (manualSubscriptions != null || navigationState != NavigationState.IDLE) {
            return false
        }
        val subscriptions = SCRATCHSubscriptionManager()
        manualSubscriptions = subscriptions
        try {
            operation().apply {
                didFinishEvent().observeOn(UiThreadDispatchQueue.newInstance()).first()
                    .subscribe(object : SCRATCHObservableCallback<SCRATCHOperationResult<T>>(subscriptions) {
                        override fun onEvent(eventData: SCRATCHOperationResult<T>) {
                            // Rejette aussi le nettoyage d'un callback devenu périmé.
                            if (manualSubscriptions !== subscriptions) return
                            try {
                                // Garder le verrou pendant le nettoyage métier appelant.
                                onCompleted(eventData)
                            } finally {
                                finishManualLogout(subscriptions, requestNavigation = true)
                            }
                        }
                    })
                start()
            }
        } catch (error: RuntimeException) {
            Timber.e(error, "Échec pendant la déconnexion manuelle")
            finishManualLogout(subscriptions, requestNavigation = false)
            return false
        }
        return true
    }

    private fun finishManualLogout(
        subscriptions: SCRATCHSubscriptionManager,
        requestNavigation: Boolean
    ) {
        if (manualSubscriptions !== subscriptions) return
        manualSubscriptions = null
        if (requestNavigation && navigationState != NavigationState.HANDLED) {
            navigationState = NavigationState.PENDING
        }
        // requestNavigation=false conserve une demande déjà reçue de l'observateur.
        try {
            subscriptions.cancel()
        } finally {
            navigateIfReady()
        }
    }

    private fun navigateIfReady() {
        if (navigationState != NavigationState.PENDING || manualSubscriptions != null) return
        val activity = foregroundActivity.get() ?: return
        if (activity.isFinishing || activity.isDestroyed) return

        // Consommer avant les effets Android pour empêcher une navigation réentrante.
        navigationState = NavigationState.HANDLED
        if (activity is LogoutActivity) return
        try {
            navigate(activity)
        } catch (error: RuntimeException) {
            Timber.e(error, "Échec de navigation après déconnexion")
            navigationState = NavigationState.PENDING
        }
    }

    override fun onActivityResumed(activity: Activity) {
        foregroundActivity = WeakReference(activity)
        navigateIfReady()
    }

    override fun onActivityPaused(activity: Activity) {
        if (foregroundActivity.get() === activity) foregroundActivity.clear()
    }

    override fun onActivityDestroyed(activity: Activity) {
        if (foregroundActivity.get() === activity) foregroundActivity.clear()
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
}
