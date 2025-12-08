import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { EmInitialisationService } from './core/services/em-initialisation.service';

export function emInitialisationFactory(emInit: EmInitialisationService) {
  return () =>
    emInit.initialiser()
      .then((ok) => {
        if (!ok) {
          console.warn('[EmInit] initialiser() a renvoyé false');
        }
        // on résout toujours, Angular attend juste que ça finisse
        return true;
      })
      .catch((err) => {
        console.error('[EmInit] initialiser() a échoué', err);
        // 🔴 surtout : NE PAS relancer l’erreur
        // on résout quand même pour ne pas casser le bootstrap / single-spa
        return true;
      });
}

export const appConfig: ApplicationConfig = {
  providers: [
    // --- providers globaux (router, http, translate, etc.) ---
    
    EmInitialisationService,
    {
      provide: APP_INITIALIZER,
      useFactory: initEmInitialisation,
      deps: [EmInitialisationService],
      multi: true,
    },
  ]
};