package ca.dgag.ajusto.kore.info.legacy

import ca.dgag.ajusto.core.AndroidScope
import ca.dgag.ajusto.kore.info.ConnectionType
import com.mirego.scratch.core.connectivity.SCRATCHConnectivityService
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkAll
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class NetworkStateImplTest {
    private val connectivityService = mockk<SCRATCHConnectivityService>(relaxed = true)
    private val androidScope = mockk<AndroidScope>()

    @BeforeEach
    fun setUp() {
        mockkStatic(AndroidScope::class)
        every { AndroidScope.get() } returns androidScope
        every { androidScope.inject(any<NetworkStateImpl>()) } answers {
            firstArg<NetworkStateImpl>().connectivityService = connectivityService
        }
    }

    @AfterEach
    fun tearDown() {
        unmockkAll()
    }

    @Test
    fun `initial connection type comes from connectivity service`() {
        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.WIFI

        val networkState = NetworkStateImpl()

        // Vérifie que l'état initial reflète immédiatement le service de connectivité.
        assertEquals(ConnectionType.WIFI, networkState.connectionType())
    }

    @Test
    fun `initial no internet connection type comes from connectivity service`() {
        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.NO_INTERNET

        val networkState = NetworkStateImpl()

        // Vérifie que le mode hors ligne est disponible dès l'initialisation.
        assertEquals(ConnectionType.NO_INTERNET, networkState.connectionType())
    }

    @Test
    fun `live wifi allows requests before the observable updates an offline cache`() {
        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.NO_INTERNET
        val networkState = NetworkStateImpl()

        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.WIFI

        assertTrue(networkState.hasNetworkAccess())
        assertFalse(networkState.noNetworkAccess())
        assertEquals(ConnectionType.NO_INTERNET, networkState.connectionType())
        assertEquals(ConnectionType.NO_INTERNET, networkState.connectionTypeStateFlow.value)
    }

    @Test
    fun `live mobile allows requests when the cache is unknown`() {
        every { connectivityService.connectionType } returns null
        val networkState = NetworkStateImpl()

        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.MOBILE

        assertTrue(networkState.hasNetworkAccess())
        assertFalse(networkState.noNetworkAccess())
        assertEquals(ConnectionType.UNKNOWN, networkState.connectionType())
    }

    @Test
    fun `live ethernet allows requests before a broadcast`() {
        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.NO_INTERNET
        val networkState = NetworkStateImpl()

        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.ETHERNET

        assertTrue(networkState.hasNetworkAccess())
        assertFalse(networkState.noNetworkAccess())
    }

    @Test
    fun `live offline rejects requests even when cache still says wifi`() {
        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.WIFI
        val networkState = NetworkStateImpl()

        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.NO_INTERNET

        assertFalse(networkState.hasNetworkAccess())
        assertTrue(networkState.noNetworkAccess())
        assertEquals(ConnectionType.WIFI, networkState.connectionTypeStateFlow.value)
    }

    @Test
    fun `unsupported live type falls back to a connected cache`() {
        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.WIFI
        val networkState = NetworkStateImpl()

        every { connectivityService.connectionType } returns null

        assertTrue(networkState.hasNetworkAccess())
        assertFalse(networkState.noNetworkAccess())
    }

    @Test
    fun `unsupported live type does not invent connectivity for an offline cache`() {
        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.NO_INTERNET
        val networkState = NetworkStateImpl()

        every { connectivityService.connectionType } returns null

        assertFalse(networkState.hasNetworkAccess())
        assertTrue(networkState.noNetworkAccess())
    }

    @Test
    fun `each check reads current connectivity without requiring a broadcast`() {
        every { connectivityService.connectionType } returns null
        val networkState = NetworkStateImpl()
        assertFalse(networkState.hasNetworkAccess())

        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.WIFI
        assertTrue(networkState.hasNetworkAccess())

        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.NO_INTERNET
        assertFalse(networkState.hasNetworkAccess())

        every { connectivityService.connectionType } returns SCRATCHConnectivityService.ConnectionType.MOBILE
        assertTrue(networkState.hasNetworkAccess())
        assertEquals(ConnectionType.UNKNOWN, networkState.connectionTypeStateFlow.value)
    }
}
