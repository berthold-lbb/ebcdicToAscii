// app.config.ts
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { APP_BASE_HREF, LOCALE_ID, registerLocaleData } from '@angular/common';

import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZoneChangeDetection } from '@angular/core';

import localeFr from '@angular/common/locales/fr';

// Animations globales
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// NgRx
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

// HTTP pour ngx-translate
import { HttpClient, HttpClientModule } from '@angular/common/http';

// ngx-translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

// APP_INITIALIZER + services init
import { APP_INITIALIZER } from '@angular/core';
import { ConfigService } from './core/services/config.service';
import { EmcInitialisationService } from './core/services/emc-initialisation.service';

// Routes
import { routes } from './app.routes';

// NgRx reducers/effects – ⚠️ adapte les chemins / noms
import { reducers } from './core/store/reducers'; // ex: index.ts qui exporte "reducers"
import { AppEffects } from './core/store/effects/app.effects';

// ─────────────────────────────────────────────────────────────
// Locale FR
// ─────────────────────────────────────────────────────────────

registerLocaleData(localeFr);

// ─────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────

// Loader pour ngx-translate
export function HttpLoaderFactory(http: HttpClient) {
  // ⚠️ adapte le chemin si besoin
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

// APP_INITIALIZER : init de config + EMC (adapte à ton besoin)
export function initApp(configService: ConfigService, emcInitService: EmcInitialisationService) {
  return () => {
    // Exemple : d’abord charger la config, puis lancer l’init EMC
    // Si tu as déjà une seule méthode qui fait tout, appelle-la ici.
    return configService.loadConfig().then(() => {
      return emcInitService.initInitialisationSCP();
    });
  };
}

// ─────────────────────────────────────────────────────────────
// Config globale de l’app standalone
// ─────────────────────────────────────────────────────────────

export const appConfig: ApplicationConfig = {
  providers: [
    // 🌍 Locale globale
    { provide: LOCALE_ID, useValue: 'fr-FR' },

    // 🌐 Base de l’app (chemin sous l’orchestrateur)
    { provide: APP_BASE_HREF, useValue: '/conciliation-migration/' },

    // ⚙️ Zone / Change detection
    provideZoneChangeDetection({ eventCoalescing: true }),

    // 🧭 Router + HTTP
    provideRouter(routes),
    provideHttpClient(),

    // 🧪 APP_INITIALIZER : init global avant bootstrap
    ConfigService,
    EmcInitialisationService,
    {
      provide: APP_INITIALIZER,
      useFactory: initApp,
      deps: [ConfigService, EmcInitialisationService],
      multi: true
    },

    // ─────────────────────────────────────────────
    // NgRx global
    // ─────────────────────────────────────────────
    importProvidersFrom(
      // Store racine
      StoreModule.forRoot(reducers, {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictActionWithinNgZone: true,
          strictActionTypeUniqueness: true
        }
      }),

      // Effets globaux
      EffectsModule.forRoot([
        AppEffects
        // ajoute d’autres effets globaux ici si besoin
      ]),

      // DevTools (désactive logOnly en dev seulement si tu veux)
      StoreDevtoolsModule.instrument({
        maxAge: 25,
        logOnly: false
      }),

      // Animations globales
      BrowserAnimationsModule,

      // HTTP module pour TranslateLoader
      HttpClientModule,

      // ngx-translate global
      TranslateModule.forRoot({
        defaultLanguage: 'fr', // optionnel
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        }
      })
    )

    // ❌ FormsModule / ReactiveFormsModule / AgGrid / Material :
    // ne les mets PAS ici si tu veux du standalone propre.
    // ➜ importe-les dans les components standalone qui les utilisent.
  ]
};



const lifecycles = singleSpaAngular({
  bootstrapFunction: (singleSpaProps: AppProps) => {
    // on push les props single-spa comme avant
    singleSpaPropsSubject.next(singleSpaProps);

    // on fusionne la config globale de l'app + les providers single-spa
    const mergedConfig: ApplicationConfig = {
      providers: [
        ...(appConfig.providers ?? []),
        getSingleSpaExtraProviders(),
      ],
    };

    // ⬇️ équivalent standalone de :
    // platformBrowserDynamic(getSingleSpaExtraProviders()).bootstrapModule(AppModule)
    return bootstrapApplication(AppComponent, mergedConfig);
  },

  template: '<app-root />',
  Router,
  NavigationStart,
  NgZone,
});
