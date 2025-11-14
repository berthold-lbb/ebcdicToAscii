import 'zone.js';

import { enableProdMode, NgZone } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { bootstrapModule } from '@angular/platform-browser';            // ✅ nouveau
import { singleSpaAngular, getSingleSpaExtraProviders } from 'single-spa-angular';

import { environment } from './environments/environment';
import { AppModule } from './app/app.module';

// (optionnel) tes types/subject pour propager les props single-spa
import { CustomProps, singleSpaPropsSubject } from './single-spa/single-spa-props';

if (environment.production) {
  enableProdMode();
}

const lifecycles = singleSpaAngular({
  bootstrapFunction: (singleSpaProps: CustomProps) => {
    // garde ta logique si tu diffuses les props
    singleSpaPropsSubject.next(singleSpaProps);

    // ⛔️ platformBrowserDynamic(...).bootstrapModule(AppModule)  (déprécié)
    // ✅ remplacé par :
    return bootstrapModule(AppModule, {
      providers: getSingleSpaExtraProviders(),
    });
  },

  // gabarit racine
  template: '<app-root></app-root>',

  // tokens nécessaires à single-spa-angular
  Router,
  NgZone,
  NavigationStart,
});

export const bootstrap = lifecycles.bootstrap;
export const mount = lifecycles.mount;
export const unmount = lifecycles.unmount;
