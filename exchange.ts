import 'zone.js';

import { enableProdMode, ApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Router, NavigationStart } from '@angular/router';
import { NgZone } from '@angular/core';

import { environment } from './environments/environment';

import {
  singleSpaAngular,
  getSingleSpaExtraProviders
} from 'single-spa-angular';

// ⚠️ adapte le chemin / les types à ton projet
import { AppProps, singleSpaPropsSubject } from './single-spa/single-spa-props';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

if (environment.production) {
  enableProdMode();
}

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

export const bootstrap = lifecycles.bootstrap;
export const mount = lifecycles.mount;
export const unmount = lifecycles.unmount;
