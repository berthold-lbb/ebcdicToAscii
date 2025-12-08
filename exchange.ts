import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { EmInitialisationService } from './core/services/em-initialisation.service';

export function initEmInitialisation(emInitService: EmInitialisationService) {
  return () => {
    emInitService.initInitialiser().subscribe({
      next: () => {},
      error: (err) =>
        console.error('[APP_INITIALIZER] EmInitialisation init failed', err),
    });

    return Promise.resolve(); // ⚠️ important : ne jamais rejeter
  };
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