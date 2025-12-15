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


















standalone 




1) ConfigService (doit être “ready” après load)

L’idée : load() hydrate une config en mémoire, et getBackendUrl() lit dedans.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type AppConfig = {
  backends: Record<string, string>; // ex: { "bff_concil_action": "https://..." }
};

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private cfg!: AppConfig;

  constructor(private http: HttpClient) {}

  async load(): Promise<void> {
    // exemple : fichier assets/config.json ou endpoint /config
    this.cfg = await firstValueFrom(this.http.get<AppConfig>('/assets/config.json'));
  }

  getBackendUrl(backendId: string): string {
    const url = this.cfg?.backends?.[backendId];
    if (!url) throw new Error(`Backend URL introuvable pour backendId="${backendId}"`);
    return url;
  }
}

2) APP_INITIALIZER (standalone)

⚠️ Important : la factory doit retourner une fonction qui retourne Promise<void>.

import { APP_INITIALIZER, Provider } from '@angular/core';
import { ConfigService } from './config.service';

export function initConfig(configService: ConfigService) {
  return () => configService.load();
}

export const CONFIG_INIT_PROVIDER: Provider = {
  provide: APP_INITIALIZER,
  multi: true,
  deps: [ConfigService],
  useFactory: initConfig,
};

3) Override ApiConfiguration (ng-openapi-gen)

Tu overrides le provider de ApiConfiguration (celui généré par ng-openapi-gen).

import { Provider } from '@angular/core';
import { ApiConfiguration } from 'src/app/api/api-configuration'; // adapte le chemin
import { ConfigService } from './config.service';

export function apiConfigFactory(configService: ConfigService) {
  const cfg = new ApiConfiguration();
  cfg.rootUrl = configService.getBackendUrl('bff_concil_action');
  return cfg;
}

export const API_CONFIG_PROVIDER: Provider = {
  provide: ApiConfiguration,
  deps: [ConfigService],
  useFactory: apiConfigFactory,
};


✅ Résultat : tous les services générés qui font this.rootUrl + path vont prendre cette URL.

4) app.config.ts (standalone)

N’oublie pas HttpClient si tu ne l’as pas déjà.

import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { CONFIG_INIT_PROVIDER } from './config/config-init.provider';
import { API_CONFIG_PROVIDER } from './config/api-config.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),

    CONFIG_INIT_PROVIDER,
    API_CONFIG_PROVIDER,
  ],
};