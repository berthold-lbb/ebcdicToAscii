src/app/guards/em-jeton-pkce-guard-v20.guard.ts

import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';

@Injectable({
  providedIn: 'root'
})
export class EmJetonPKCEGuardV20 implements CanActivate {

  constructor(private readonly oauthService: OAuthService) {}

  /**
   * Méthode utilisée par le router Angular pour autoriser ou non une route.
   * (même logique que le guard original de la librairie)
   */
  canActivate(): boolean {
    if (this.oauthService.hasValidAccessToken() &&
        this.oauthService.hasValidIdToken()) {
      return true;
    } else {
      this.oauthService.initImplicitFlow();
      return false;
    }
  }
}




@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    // ... tes autres imports
    EmCoreModule.forRoot(/* ta config */),
  ],
  providers: [
    // autres providers éventuels...

    // 👉 OVERRIDE DU GUARD DE LA LIB
    {
      provide: EmJetonPKCEGuard,
      useExisting: EmJetonPKCEGuardV20
      // tu peux aussi faire:
      // useClass: EmJetonPKCEGuardV20
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
