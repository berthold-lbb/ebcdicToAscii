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
    // MODIFIÉ C : une étape décrit le parcours entier, pas seulement la navigation.
    // Les abonnements appartiennent à l'étape en cours : plus de verrou nullable séparé.
    private sealed class LogoutStep {
        object Ready : LogoutStep()
        class InProgress(
            val subscriptions: SCRATCHSubscriptionManager = SCRATCHSubscriptionManager(),
            var exitRequested: Boolean = false
        ) : LogoutStep()
        object WaitingForActivity : LogoutStep()
        object ExitOpened : LogoutStep()
    }

    private var foregroundActivity = WeakReference<Activity>(null)
    private var wasAuthenticated = false
    // MODIFIÉ C : remplace navigationState ET manualSubscriptions.
    private var step: LogoutStep = LogoutStep.Ready

    fun onAuthenticationChanged(authenticated: Boolean) {
        if (authenticated == wasAuthenticated) return
        wasAuthenticated = authenticated
        // MODIFIÉ C : une reconnexion réarme le parcours hors opération en cours (comme A).
        if (!authenticated) {
            requestLogout()
        } else if (step !is LogoutStep.InProgress) {
            step = LogoutStep.Ready
        }
    }

    fun requestLogout() {
        // MODIFIÉ C : chaque situation se lit explicitement, sans combinaison de champs.
        when (val current = step) {
            LogoutStep.Ready -> step = LogoutStep.WaitingForActivity
            is LogoutStep.InProgress -> current.exitRequested = true
            LogoutStep.WaitingForActivity -> Unit
            LogoutStep.ExitOpened -> return
        }
        openExitWhenPossible()
    }

    @Suppress("DEPRECATION")
    fun <T : Any> runManualLogout(
        operation: () -> SCRATCHOperation<T>,
        onCompleted: (SCRATCHOperationResult<T>) -> Unit = {}
    ): Boolean {
        // MODIFIÉ C : on accepte une demande uniquement quand le parcours est disponible.
        if (step !== LogoutStep.Ready) return false
        val attempt = LogoutStep.InProgress()
        step = attempt // Avant de créer l'opération : bloque aussi les appels réentrants.
        try {
            operation().apply {
                didFinishEvent().observeOn(UiThreadDispatchQueue.newInstance()).first()
                    .subscribe(object : SCRATCHObservableCallback<SCRATCHOperationResult<T>>(attempt.subscriptions) {
                        override fun onEvent(eventData: SCRATCHOperationResult<T>) {
                            // MODIFIÉ C : l'identité de la tentative rejette les anciens callbacks.
                            if (step !== attempt) return
                            try {
                                onCompleted(eventData)
                            } finally {
                                // MODIFIÉ C : politique A conservée, même sur résultat en échec.
                                // Attend le retour du callback, pas ses éventuels travaux asynchrones.
                                completeAttempt(attempt, openExit = true)
                            }
                        }
                    })
                start()
            }
        } catch (error: RuntimeException) {
            Timber.e(error, "Échec pendant la déconnexion manuelle")
            // MODIFIÉ C : sans fin normale, seule une sortie déjà demandée est conservée.
            completeAttempt(attempt, openExit = false)
            return false
        }
        return true
    }

    // MODIFIÉ C : termine une tentative et annonce directement l'étape suivante.
    private fun completeAttempt(attempt: LogoutStep.InProgress, openExit: Boolean) {
        if (step !== attempt) return
        step = if (openExit || attempt.exitRequested) {
            LogoutStep.WaitingForActivity
        } else {
            LogoutStep.Ready
        }
        try {
            attempt.subscriptions.cancel()
        } finally {
            openExitWhenPossible()
        }
    }

    // MODIFIÉ C : seule l'étape « attente d'activité » autorise un lancement Android.
    private fun openExitWhenPossible() {
        if (step !== LogoutStep.WaitingForActivity) return
        val activity = foregroundActivity.get() ?: return
        if (activity.isFinishing || activity.isDestroyed) return

        step = LogoutStep.ExitOpened // Consommer avant tout effet réentrant.
        if (activity is LogoutActivity) return
        try {
            navigate(activity)
        } catch (error: RuntimeException) {
            Timber.e(error, "Échec de navigation après déconnexion")
            step = LogoutStep.WaitingForActivity // Nouvelle tentative à la prochaine reprise.
        }
    }

    override fun onActivityResumed(activity: Activity) {
        foregroundActivity = WeakReference(activity)
        openExitWhenPossible() // MODIFIÉ C : nom exprimant l'intention.
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
