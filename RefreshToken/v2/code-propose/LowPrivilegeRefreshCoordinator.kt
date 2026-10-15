// Proposition V2 autonome, non intégrée et non compilée sur ce snapshot incomplet.
// Les types ci-dessous sont NOUVEAUX. L'adaptateur applicatif est décrit dans
// ../proposition-solution.md. Aucun secret ne doit être loggé via ces objets.
package proposal.refreshtoken

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

internal data class Endpoint(val url: String, val clientId: String, val tenant: String)
internal data class SessionTokens(
    val access: String,
    val refresh: String?,
    val email: String,
    val expiresAtEpochSeconds: Long,
)
internal data class Session(val endpoint: Endpoint, val tokens: SessionTokens)
internal data class Snapshot(val generation: Long, val session: Session?)
internal data class LoginTicket(val generation: Long, val endpoint: Endpoint)

// L'adaptateur doit valider parsing, expiration, marque et email avant Accepted.
// Il doit conserver le refresh précédent SEULEMENT pour un renouvellement,
// jamais pour une nouvelle connexion.
internal sealed interface Exchange {
    data class Accepted(val tokens: SessionTokens) : Exchange
    data object Rejected : Exchange // invalid_grant confirmé
    data object EmailNotVerified : Exchange
    data object Failed : Exchange // échec connu, sans boucle de retry automatique
    data object Indeterminate : Exchange // rotation peut-être consommée, réponse perdue
}
internal enum class Status {
    SUCCESS, UNAUTHORIZED, EMAIL_NOT_VERIFIED, FAILED, SESSION_CHANGED
}
internal data class Outcome(
    val generation: Long,
    val status: Status,
    val access: String? = null,
)

internal class LowPrivilegeRefreshCoordinator(
    private val scope: CoroutineScope, // scope applicatif supervisé injecté
    private val nowSeconds: () -> Long,
    private val exchange: suspend (Endpoint, String) -> Exchange,
) {
    private val mutex = Mutex()
    private var generation = 0L
    private var nextFlightId = 0L
    private var pendingLogin: LoginTicket? = null
    private val mutableState = MutableStateFlow(Snapshot(0L, null))
    val state: StateFlow<Snapshot> = mutableState.asStateFlow()

    private data class Flight(
        val id: Long,
        val generation: Long,
        val deferred: Deferred<Outcome>,
    )
    private var flight: Flight? = null

    // À appeler dès le début d'une nouvelle authentification bas privilège.
    // Le ticket doit accompagner le state OAuth/PKCE propre à CETTE tentative.
    suspend fun beginLogin(endpoint: Endpoint): LoginTicket = mutex.withLock {
        invalidateLocked()
        LoginTicket(generation, endpoint).also { pendingLogin = it }
    }

    // tokens provient uniquement de la réponse de cette nouvelle connexion.
    // En particulier : refresh absent => null, jamais celui d'une ancienne session.
    suspend fun completeLogin(ticket: LoginTicket, tokens: SessionTokens): Outcome = mutex.withLock {
        if (ticket.generation != generation || pendingLogin != ticket) {
            return@withLock Outcome(ticket.generation, Status.SESSION_CHANGED)
        }
        pendingLogin = null // ticket consommé une seule fois, même si réponse invalide
        if (tokens.access.isBlank() || tokens.expiresAtEpochSeconds <= nowSeconds()) {
            return@withLock Outcome(generation, Status.FAILED)
        }
        mutableState.value = Snapshot(generation, Session(ticket.endpoint, tokens))
        Outcome(generation, Status.SUCCESS, tokens.access)
    }

    suspend fun cancelLogin(ticket: LoginTicket) = mutex.withLock {
        if (pendingLogin == ticket && generation == ticket.generation) invalidateLocked()
    }

    suspend fun clearSession() = mutex.withLock { invalidateLocked() }

    // force=true pour les deux écrans existants (actualisation de l'email).
    // force=false pour un consommateur qui veut un access token utilisable.
    suspend fun refresh(force: Boolean): Outcome {
        val pending: Deferred<Outcome> = mutex.withLock {
            val session = mutableState.value.session
                ?: return Outcome(generation, Status.UNAUTHORIZED)

            // Priorité à la tentative en cours, même si l'ancien access est frais.
            flight?.takeIf { it.generation == generation }?.let {
                return@withLock it.deferred
            }
            if (!force && session.tokens.expiresAtEpochSeconds > nowSeconds()) {
                return Outcome(generation, Status.SUCCESS, session.tokens.access)
            }
            val refresh = session.tokens.refresh
            if (refresh.isNullOrBlank()) {
                return Outcome(generation, Status.UNAUTHORIZED)
            }

            val epoch = generation
            val id = ++nextFlightId
            val deferred = scope.async(start = CoroutineStart.LAZY) {
                try {
                    val response = try {
                        exchange(session.endpoint, refresh)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                        // Sans preuve que la requête n'est pas partie, ne pas
                        // rejouer automatiquement un refresh peut-être consommé.
                        Exchange.Indeterminate
                    }
                    mutex.withLock {
                        if (generation != epoch) {
                            return@withLock Outcome(epoch, Status.SESSION_CHANGED)
                        }
                        when (response) {
                            is Exchange.Accepted -> {
                                mutableState.value = Snapshot(
                                    epoch, session.copy(tokens = response.tokens)
                                )
                                Outcome(epoch, Status.SUCCESS, response.tokens.access)
                            }
                            Exchange.Rejected, Exchange.Indeterminate -> {
                                // Même génération pour que les abonnés sachent
                                // quelle session réclame une reconnexion.
                                mutableState.value = Snapshot(epoch, null)
                                Outcome(epoch, Status.UNAUTHORIZED)
                            }
                            Exchange.EmailNotVerified ->
                                Outcome(epoch, Status.EMAIL_NOT_VERIFIED)
                            Exchange.Failed -> Outcome(epoch, Status.FAILED)
                        }
                    }
                } finally {
                    withContext(NonCancellable) {
                        mutex.withLock {
                            // Une vieille requête ne doit pas effacer la flight
                            // installée entre-temps pour la nouvelle session.
                            if (flight?.id == id) flight = null
                        }
                    }
                }
            }
            flight = Flight(id, epoch, deferred)
            deferred.start() // lancé avant de rendre la main au demandeur
            deferred
        }
        val result = pending.await() // annuler l'écran n'annule pas le scope injecté
        return mutex.withLock {
            if (result.generation == generation) result
            else Outcome(result.generation, Status.SESSION_CHANGED)
        }
    }

    private fun invalidateLocked() {
        generation += 1
        pendingLogin = null
        mutableState.value = Snapshot(generation, null)
        // L'ancienne opération réseau peut finir, mais elle ne pourra plus écrire.
        // On ne la rejoue pas et on ne dépend pas de son annulation transport.
        flight = null
    }
}
