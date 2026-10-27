package ca.dgag.ajusto.authentification.welcome

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.net.toUri
import ca.dgag.ajusto.action.ActionListener
import ca.dgag.ajusto.authentification.login.LoginLowPrivilegeActivity
import ca.dgag.ajusto.authentification.signup.SignUpActivity
import ca.dgag.ajusto.communication.CommunicationActivity
import ca.dgag.ajusto.communication.CommunicationActivity.Companion.EXTRA_INIT_STATE
import ca.dgag.ajusto.compose.dsd.theme.InsuranceTheme
import ca.dgag.ajusto.configuration.EnvironmentConfigurationActivity
import ca.dgag.ajusto.core.services.analytics.AnalyticsService
import ca.dgag.ajusto.databinding.DgagComposeBinding
import ca.dgag.ajusto.gia.CallSupportActivity
import ca.dgag.ajusto.gia.ChooseProvinceActivity
import ca.dgag.ajusto.gia.WelcomeView
import ca.dgag.ajusto.home.MainActivity
import ca.dgag.ajusto.kore.activity.BaseKoreActivity
import ca.dgag.ajusto.onetrust.OneTrustWrapperImpl
import ca.dgag.ajusto.utils.AppUtil
import ca.dgag.ajusto.views.model.ShowExternalDSDDialog
import com.desjardins.assurancedommages.mobile.feature.authenticate.domain.Screen
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.welcome.WelcomeAction
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.welcome.WelcomeReaction
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.welcome.WelcomeReaction.Nothing
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.welcome.WelcomeUiState
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.welcome.WelcomeViewModel
import com.desjardins.assurancedommages.mobile.feature.communication.presentation.CommunicationInitState.PhoneConfirmation
import com.desjardins.assurancedommages.mobile.presentation.compose.utils.get
import com.desjardins.assurancedommages.mobile.transverse.presentation.localized.GiaLocalizedString
import com.mirego.itch.core.ItchInjectable
import org.koin.android.ext.android.inject
import timber.log.Timber

/**
 * This activity manages the Écran d'accueil, which includes
 *   - sign in
 *   - sign up
 *   - forgot password
 *   - update province
 *   - settings, for environment configuration (only in non-prod)
 *   - call support
 *   - information link to an external page (WRU-26416)
 */
@ItchInjectable
class WelcomeActivity : BaseKoreActivity<WelcomeUiState, WelcomeReaction, WelcomeViewModel, DgagComposeBinding>() {
    override val viewModel: WelcomeViewModel by inject()
    private var showDialogSetter: ((Boolean, String?) -> Unit)? = null
    private var showInformationModal by mutableStateOf(false)

    private val actionListener = ActionListener<WelcomeAction?> { action ->
        when (action) {
            null -> Unit
            WelcomeAction.InformationLinkTapped -> onInformationLinkTapped()
            else -> viewModel.executeAction(action)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupBackPressHandler()

        viewBinding.content.setContent {
            InsuranceTheme {
                var showDialog by remember { mutableStateOf(false) }
                var dialogUrl by remember { mutableStateOf<String?>(null) }

                WelcomeView(viewModel, actionListener)

                if (showDialog && dialogUrl != null) {
                    ShowExternalDSDDialog(primaryButtonOnClick = {
                        startActivity(Intent(Intent.ACTION_VIEW, dialogUrl?.toUri()))
                        showDialog = false
                        dialogUrl = null
                    }, secondaryButtonOnClick = {
                        showDialog = false
                        dialogUrl = null
                    })
                }

                if (showInformationModal) {
                    ShowExternalDSDDialog(
                        title = GiaLocalizedString.GIA_LOGIN_INFORMATION_MODAL_TITLE.get(),
                        message = GiaLocalizedString.GIA_LOGIN_INFORMATION_MODAL_MESSAGE.get(),
                        primaryText = GiaLocalizedString.GIA_LOGIN_INFORMATION_MODAL_CONTINUE.get(),
                        secondaryText = GiaLocalizedString.GIA_LOGIN_INFORMATION_MODAL_CANCEL.get(),
                        primaryButtonOnClick = {
                            showInformationModal = false
                            viewModel.executeAction(WelcomeAction.ContinueInformation)
                        },
                        secondaryButtonOnClick = {
                            showInformationModal = false
                            viewModel.executeAction(WelcomeAction.CancelInformation)
                        }
                    )
                }

                showDialogSetter = { value, url ->
                    showDialog = value
                    dialogUrl = url
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        AnalyticsService.getInstance().trackLoginScreen()
        AppUtil.checkPlayServices(this)
    }

    override fun isDSD(): Boolean = true

    override fun handleReaction(reaction: WelcomeReaction) {
        if (reaction !is Nothing) {
            Timber.d("$TAG Handle reaction=${reaction::class.simpleName}")
        }
        when (reaction) {
            is WelcomeReaction.NavTo -> when (val screen = reaction.screen) {
                Screen.Main -> MainActivity.newIntent(this)
                Screen.SignUp -> SignUpActivity.newIntent(this)
                Screen.Login -> LoginLowPrivilegeActivity.newIntent(this)
                is Screen.ForgotPassword -> forgotPassword(screen.url)
                Screen.Communication -> communication()
                Screen.ChooseProvince -> ChooseProvinceActivity.newIntent(this)
                Screen.Settings -> EnvironmentConfigurationActivity.newIntent(this)
                Screen.CallSupport -> CallSupportActivity.newIntent(this)
                else -> null
            }?.let {
                startActivity(it)
            }

            is WelcomeReaction.OpenExternalBrowser ->
                startActivity(Intent(Intent.ACTION_VIEW, reaction.url.toUri()))

            WelcomeReaction.CookiesConsent -> OneTrustWrapperImpl.showBanner(this)

            else -> Unit // do nothing
        }
    }

    private fun forgotPassword(url: String): Intent? {
        showDialogSetter?.invoke(true, url)
        return null
    }

    private fun onInformationLinkTapped() {
        viewModel.executeAction(WelcomeAction.InformationLinkTapped)
        viewModel.executeAction(WelcomeAction.InformationModalViewed)
        showInformationModal = true
    }

    private fun communication() =
        CommunicationActivity.newIntent(this).putExtra(EXTRA_INIT_STATE, PhoneConfirmation.toString())

    private fun setupBackPressHandler() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = Unit // back blocked
            }
        )
    }

    override fun inflate(): DgagComposeBinding = DgagComposeBinding.inflate(layoutInflater)

    companion object {
        private val TAG = WelcomeActivity::class.java.simpleName

        @JvmStatic
        fun newIntent(context: Context?): Intent = Intent(context, WelcomeActivity::class.java)
    }
}
