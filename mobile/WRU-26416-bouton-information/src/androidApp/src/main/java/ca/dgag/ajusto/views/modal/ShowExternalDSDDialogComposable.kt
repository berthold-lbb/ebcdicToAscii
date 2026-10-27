package ca.dgag.ajusto.views.modal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ca.dgag.ajusto.compose.dsd.theme.DgagPreview
import ca.dgag.ajusto.compose.dsd.theme.DgagTheme
import ca.dgag.ajusto.compose.dsd.theme.InsuranceTheme.dsd
import ca.dgag.ajusto.compose.dsd.theme.TpicPreview
import ca.dgag.ajusto.compose.dsd.theme.TpicTheme
import com.desjardins.assurancedommages.mobile.presentation.compose.utils.get
import com.desjardins.assurancedommages.mobile.transverse.presentation.localized.AjustoLocalizedString
import com.desjardins.assurancedommages.mobile.transverse.presentation.localized.InsuranceLocalizedString
import com.dsd.compose.component.modal.DSDModal
import com.dsd.compose.component.modal.DSDModalButton

@Composable
fun ShowExternalDSDDialog(
    primaryButtonOnClick: () -> Unit = {},
    secondaryButtonOnClick: () -> Unit = {},
    title: String = InsuranceLocalizedString.INSURANCE_EXTERNAL_WEBSITE_TITLE.get(),
    message: String = InsuranceLocalizedString.INSURANCE_EXTERNAL_WEBSITE_DSD_MESSAGE.get(),
    primaryText: String = AjustoLocalizedString.GLOBAL_CONTINUE.get(),
    secondaryText: String = AjustoLocalizedString.GLOBAL_CANCEL.get()
) {
    DSDModal(
        title = title,
        primaryButton = DSDModalButton(text = primaryText) {
            primaryButtonOnClick()
        },
        secondaryButton = DSDModalButton(text = secondaryText) {
            secondaryButtonOnClick()
        }
    ) {
        Text(text = message)
    }
}

@Composable
private fun ShowExternalDSDDialogPreview() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(color = dsd.colors.background.default)
    ) {
        ShowExternalDSDDialog()
    }
}

@TpicPreview
@Composable
fun TpicShowExternalDSDDialogPreview() {
    TpicTheme {
        ShowExternalDSDDialogPreview()
    }
}

@DgagPreview
@Composable
fun DgagShowExternalDSDDialogPreview() {
    DgagTheme {
        ShowExternalDSDDialogPreview()
    }
}
