package ca.dgag.ajusto.gia

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.animation.slideInHorizontally
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.ButtonDefaults
import androidx.compose.material.Icon
import androidx.compose.material.IconButton
import androidx.compose.material.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Alignment.Companion.CenterHorizontally
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.dimensionResource
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.res.vectorResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ca.dgag.ajusto.R
import ca.dgag.ajusto.R.color.dgag_radar_event_icon
import ca.dgag.ajusto.R.drawable.dgag_icn_settings
import ca.dgag.ajusto.R.drawable.ico_information_bubble
import ca.dgag.ajusto.R.drawable.login_screen_bgnd
import ca.dgag.ajusto.R.drawable.logo_with_blurb
import ca.dgag.ajusto.action.ActionListener
import ca.dgag.ajusto.compose.ButtonParam
import ca.dgag.ajusto.compose.dsd.DsdButton
import ca.dgag.ajusto.compose.dsd.DsdButtonPrimary
import ca.dgag.ajusto.compose.dsd.InsuranceDSDModal
import ca.dgag.ajusto.compose.dsd.theme.InsuranceTheme.dsd
import ca.dgag.ajusto.compose.font.regular
import ca.dgag.ajusto.compose.view.ContactAppBar
import ca.dgag.ajusto.kore.domain.state.find
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.welcome.WelcomeAction
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.welcome.WelcomeUiState
import com.desjardins.assurancedommages.mobile.feature.authenticate.presentation.welcome.WelcomeViewModel
import com.desjardins.assurancedommages.mobile.presentation.compose.utils.get
import com.desjardins.assurancedommages.mobile.presentation.compose.wrapper.ContentContainer
import com.desjardins.assurancedommages.mobile.presentation.compose.wrapper.ToolbarContainerStatusBar
import com.desjardins.assurancedommages.mobile.transverse.presentation.localized.GiaLocalizedString
import com.desjardins.dsd.R as DsdR
import com.desjardins.dsd.R.color.dsd_confirmation_4
import com.desjardins.dsd.R.dimen.dsd_icon_size
import com.desjardins.dsd.R.drawable.dsd_ic_navigations_contour_fleche_droite
import kotlinx.coroutines.delay

@Composable
internal fun WelcomeView(viewModel: WelcomeViewModel, actionListener: ActionListener<WelcomeAction?>) {
    val uiStates = viewModel.uiStateFlow.collectAsState()

    WelcomeView(
        state = WelcomeState(
            toolbar = uiStates.value.find<WelcomeUiState.Toolbar>(),
            content = uiStates.value.find<WelcomeUiState.Content>(),
            actionListener = actionListener
        )
    )
}

@Preview
@Composable
internal fun WelcomeView(@PreviewParameter(WelcomeMock::class) state: WelcomeState) {
    Scaffold(
        contentWindowInsets = WindowInsets.safeDrawing,
        topBar = {
            state.toolbar?.let {
                ToolbarContainerStatusBar {
                    ContactAppBar(it) {
                        state.actionListener.onClick(it.action)
                    }
                }
            }
        },
        content = { padding ->
            state.content?.let {
                ContentContainer(
                    innerPadding = padding,
                    backgroundColor = dsd.colors.background.default
                ) {
                    LoginContent(
                        state = it,
                        modifier = Modifier.padding(padding),
                        actionListener = state.actionListener
                    )
                }
            }
        }
    )
}

@Composable
private fun LoginContent(
    state: WelcomeUiState.Content,
    modifier: Modifier,
    actionListener: ActionListener<WelcomeAction?>
) {
    val localDensity = LocalDensity.current
    var padding by remember { mutableStateOf(0.dp) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        state.transitionModal?.let { modalState ->
            InsuranceDSDModal(
                state = modalState,
                onPositive = { actionListener.onClick(modalState.primaryButton.action as? WelcomeAction) }
            )
        } ?: state.errorModal?.let { modalState ->
            InsuranceDSDModal(
                state = modalState,
                onPositive = { actionListener.onClick(modalState.primaryButton.action as? WelcomeAction) },
                onNegative = { actionListener.onClick(modalState.secondaryButton?.action as? WelcomeAction) }
            )
        }

        Column(horizontalAlignment = CenterHorizontally) {
            Image(
                imageVector = ImageVector.vectorResource(logo_with_blurb),
                contentDescription = state.logoAccessibility,
                modifier = Modifier
                    .padding(bottom = medium)
                    .width(152.dp)
            )
            Box {
                Image(
                    bitmap = ImageBitmap.imageResource(login_screen_bgnd),
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .onGloballyPositioned { coordinates ->
                            padding = if (coordinates.size.height > OVERLAP) {
                                with(localDensity) { coordinates.size.height.toDp() } - OVERLAP.dp
                            } else {
                                0.dp
                            }
                        }.background(colorResource(R.color.dgag_gia_main_background)),
                    contentScale = ContentScale.FillWidth
                )
                Column(
                    modifier = Modifier
                        .padding(top = padding)
                        .clip(RoundedCornerShape(topStart = medium, topEnd = medium))
                        .background(color = Color.White)
                        .padding(horizontal = medium)
                        .padding(top = cardTopPadding, bottom = medium)
                ) {
                    with(state.loginButton) {
                        DsdButtonPrimary(
                            buttonParam = ButtonParam(
                                text = title,
                                onClick = { actionListener.onClick(action) }
                            ),
                            color = colorResource(dsd_confirmation_4)
                        )
                    }
                    Spacer(Modifier.height(medium))
                    with(state.passwordButton) {
                        AdjustedDsdSecondary(title) { actionListener.onClick(action) }
                    }
                    Spacer(Modifier.height(large))
                    with(state.signUpButton) {
                        AdjustedDsdSecondary(title) { actionListener.onClick(action) }
                    }
                }
                if (state.informationUrl != null) {
                    // Zone qui va du haut de l'illustration jusqu'au haut du bouton « Se connecter » :
                    // la boîte d'information y est ancrée en bas, à droite.
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .fillMaxWidth()
                            .height(padding + cardTopPadding),
                        contentAlignment = Alignment.BottomEnd
                    ) {
                        InformationFloatingButton(
                            // Même marge à droite que la carte des boutons : bord droit aligné avec eux.
                            endMargin = medium,
                            onClick = { actionListener.onClick(WelcomeAction.InformationLinkTapped) }
                        )
                    }
                }
            }
        }
        ModifyProvince(
            state = state,
            onClickModify = { actionListener.onClick(state.modifyButton.action) },
            onClickSettings = { actionListener.onClick(state.settingsButton?.action) }
        )
    }
}

@Composable
private fun ModifyProvince(
    state: WelcomeUiState.Content,
    onClickModify: () -> Unit = {},
    onClickSettings: () -> Unit = {}
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(Modifier.padding(start = medium)) {
            Text(state.modifyProvince, style = titleTextStyle())

            TextButton(
                contentPadding = PaddingValues(
                    start = 0.dp,
                    top = small,
                    end = small,
                    bottom = medium
                ),
                onClick = onClickModify
            ) {
                ArrowIcon()
                Text(state.modifyButton.title, style = buttonTextStyle())
            }
        }
        if (state.settingsButton != null) {
            Box(
                modifier = Modifier
                    .padding(medium)
                    .size(30.dp)
            ) {
                IconButton(onClick = onClickSettings) {
                    Icon(
                        tint = colorResource(dgag_radar_event_icon),
                        imageVector = ImageVector.vectorResource(dgag_icn_settings),
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
}

@Composable
private fun ArrowIcon() {
    Box(
        modifier = Modifier
            .padding(end = 6.dp)
            .size(dimensionResource(dsd_icon_size))
            .clip(CircleShape)
            .background(colorResource(dsd_confirmation_4))
            .clearAndSetSemantics {}
    ) {
        Icon(
            modifier = Modifier
                .wrapContentSize()
                .padding(4.dp)
                .align(Alignment.Center),
            imageVector = ImageVector.vectorResource(
                dsd_ic_navigations_contour_fleche_droite
            ),
            tint = Color.White,
            contentDescription = null
        )
    }
}

@Composable
private fun AdjustedDsdSecondary(title: String, onClick: () -> Unit = {}) {
    val green = colorResource(R.color.ajusto_accordions_header)
    DsdButton(
        buttonParam = ButtonParam(
            text = title,
            onClick = onClick
        ),
        buttonColors = ButtonDefaults.buttonColors(
            backgroundColor = colorResource(R.color.dgag_transparent),
            contentColor = green
        ),
        border = BorderStroke(width = 2.dp, color = green)
    )
}

@Composable
private fun InformationFloatingButton(endMargin: Dp, modifier: Modifier = Modifier, onClick: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        delay(INFO_SHOW_DELAY_MS)
        visible = true
        delay(INFO_COLLAPSE_DELAY_MS)
        expanded = false
    }

    val accessibilityHint = GiaLocalizedString.GIA_LOGIN_INFORMATION_ACCESSIBILITY_HINT.get()
    // Écart vertical entre la boîte et le bouton « Se connecter » (jeton DSD).
    val bottomGap = dsd.dimensions.padding.small
    val endMarginPx = with(LocalDensity.current) { endMargin.roundToPx() }
    val shape = RoundedCornerShape(dsd.dimensions.radius.small)

    AnimatedVisibility(
        visible = visible,
        modifier = modifier.padding(end = endMargin, bottom = bottomGap),
        // Part complètement hors écran (largeur de la boîte + marge de droite) puis glisse vers sa place.
        enter = slideInHorizontally(animationSpec = tween(INFO_ANIMATION_MS)) { fullWidth ->
            fullWidth + endMarginPx
        }
    ) {
        Row(
            modifier = Modifier
                .shadow(elevation = informationElevation, shape = shape)
                .background(dsd.colors.background.default, shape)
                .clickable(role = Role.Button, onClick = onClick)
                .semantics { contentDescription = accessibilityHint }
                .padding(dsd.dimensions.padding.xsmall),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = ImageVector.vectorResource(ico_information_bubble),
                tint = dsd.colors.icon.brand,
                contentDescription = null,
                modifier = Modifier.size(dimensionResource(dsd_icon_size))
            )
            AnimatedVisibility(
                visible = expanded,
                enter = expandHorizontally(animationSpec = tween(INFO_ANIMATION_MS)) +
                    fadeIn(animationSpec = tween(INFO_ANIMATION_MS)),
                exit = shrinkHorizontally(animationSpec = tween(INFO_ANIMATION_MS)) +
                    fadeOut(animationSpec = tween(INFO_ANIMATION_MS))
            ) {
                Column(modifier = Modifier.padding(horizontal = dsd.dimensions.padding.xsmall)) {
                    Text(
                        text = GiaLocalizedString.GIA_LOGIN_INFORMATION_TITLE.get(),
                        style = dsd.typography.b40Bold,
                        color = dsd.colors.font.default
                    )
                    Text(
                        text = GiaLocalizedString.GIA_LOGIN_INFORMATION_LEARN_MORE.get(),
                        style = dsd.typography.b40,
                        color = dsd.colors.font.default
                    )
                }
            }
        }
    }
}

private val small = 8.dp
private val medium = 16.dp
private val large = 32.dp
private val cardTopPadding = 24.dp
private val informationElevation = 4.dp // pas de jeton d'élévation DSD connu ; même valeur que EmailSectionComposable
private const val OVERLAP = 20
private const val INFO_SHOW_DELAY_MS = 1_000L
private const val INFO_COLLAPSE_DELAY_MS = 5_000L
private const val INFO_ANIMATION_MS = 400

@Composable
private fun titleTextStyle() = TextStyle(
    color = colorResource(DsdR.color.dsd_graphite_7),
    fontFamily = regular,
    fontWeight = FontWeight(400),
    fontSize = 16.sp,
    lineHeight = 24.sp
)

@Composable
private fun buttonTextStyle() = TextStyle(
    color = colorResource(DsdR.color.dsd_graphite_7),
    fontFamily = regular,
    fontWeight = FontWeight(700),
    fontSize = 16.sp,
    lineHeight = 20.sp,
    textDecoration = TextDecoration.Underline
)

@Immutable
class WelcomeState(
    val toolbar: WelcomeUiState.Toolbar?,
    val content: WelcomeUiState.Content?,
    val actionListener: ActionListener<WelcomeAction?>
)
