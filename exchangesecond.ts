La solution clean dans ton cas
A) Injecter ApiConfiguration depuis ton ConfigService

Tu vas overrider le provider ApiConfiguration (généré) pour que son rootUrl vienne de ta config.

1) APP_INITIALIZER pour charger ta config AVANT
import { APP_INITIALIZER, Provider } from '@angular/core';

export function initConfig(configService: ConfigService) {
  return () => configService.load(); // doit retourner Promise/Observable -> Promise
}

export const CONFIG_INIT_PROVIDER: Provider = {
  provide: APP_INITIALIZER,
  multi: true,
  deps: [ConfigService],
  useFactory: initConfig,
};

2) Provider ApiConfiguration basé sur ta config chargée
import { ApiConfiguration } from '.../api/api-configuration';

export function apiConfigFactory(configService: ConfigService) {
  const cfg = new ApiConfiguration();

  // ✅ ton backendId (ex: 'bff_concil_action')
  cfg.rootUrl = configService.getBackendUrl('bff_concil_action');

  return cfg;
}

export const API_CONFIG_PROVIDER: Provider = {
  provide: ApiConfiguration,
  deps: [ConfigService],
  useFactory: apiConfigFactory,
};

3) Ajouter ça dans app.config.ts (standalone)
import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    CONFIG_INIT_PROVIDER,
    API_CONFIG_PROVIDER,
  ],
};


✅ Résultat : this.rootUrl dans tous tes services générés va automatiquement prendre ton URL dynamique.