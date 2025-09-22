  --------------------------------------------------------------------------------------------------------------------------------------------------
  ----------------------------------------------------------------------------------------------------------------

import { Component } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';



// Adapter custom pour dd/MM/yyyy HH:mm (mets :ss si tu veux les secondes)
class FrDateTimeAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: any): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = pad(date.getDate());
    const m = pad(date.getMonth() + 1);
    const y = date.getFullYear();
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    // const ss = pad(date.getSeconds()); // décommente si tu veux HH:mm:ss
    // return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
    return `${d}/${m}/${y} ${hh}:${mm}`;
  }
}

export const FR_DT_FORMATS = {
  parse:   { dateInput: 'input' },
  display: {
    dateInput: 'input',
    monthYearLabel: 'MMMM yyyy',
    dateA11yLabel: 'input',
    monthYearA11yLabel: 'MMMM yyyy',
  },
};




@Component({
  selector: 'app-credit',
  standalone: true,
  templateUrl: './credit.component.html',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: DateAdapter, useClass: FrDateTimeAdapter }, // 👈 affiche dd/MM/yyyy HH:mm
    { provide: MAT_DATE_FORMATS, useValue: FR_DT_FORMATS }
  ]
})
export class CreditComponent {
  form = this.fb.group({
    startDate: [null as Date | null, Validators.required],
    endDate:   [null as Date | null, Validators.required],
  });

  constructor(private fb: FormBuilder) {}

  /** Injecte l'heure/minute courantes sur la date sélectionnée */
  injectNow(controlName: 'startDate' | 'endDate', picked: Date | null) {
    if (!picked) return;
    const now = new Date();
    const withTime = new Date(
      picked.getFullYear(), picked.getMonth(), picked.getDate(),
      now.getHours(), now.getMinutes(), 0 // mets now.getSeconds() si tu veux les secondes
    );
    this.form.get(controlName)?.setValue(withTime);
  }
}


<!-- Date début -->
<mat-form-field appearance="fill">
  <mat-label>Date début</mat-label>
  <input
    matInput
    [matDatepicker]="pStart"
    formControlName="startDate"
    placeholder="JJ/MM/AAAA HH:mm"
    (dateChange)="injectNow('startDate', $event.value)"
  >
  <mat-datepicker-toggle matSuffix [for]="pStart"></mat-datepicker-toggle>
  <mat-datepicker #pStart startView="multi-year"></mat-datepicker>
</mat-form-field>

<!-- Date fin -->
<mat-form-field appearance="fill">
  <mat-label>Date fin</mat-label>
  <input
    matInput
    [matDatepicker]="pEnd"
    formControlName="endDate"
    placeholder="JJ/MM/AAAA HH:mm"
    (dateChange)="injectNow('endDate', $event.value)"
    [min]="form.value.startDate || null"
  >
  <mat-datepicker-toggle matSuffix [for]="pEnd"></mat-datepicker-toggle>
  <mat-datepicker #pEnd startView="multi-year"></mat-datepicker>
</mat-form-field>

-----------------------------------------------------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------------------------------------------------


// app.config.ts (ou main.ts si vous regroupez)
import { ApplicationConfig, ErrorHandler, provideHttpClient, withInterceptors } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideMatSnackBar } from '@angular/material/snack-bar';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { GlobalErrorHandler } from './core/errors/global-error.handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideMatSnackBar(),
    provideHttpClient(withInterceptors([httpErrorInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};


// core/services/snack-bar.service.ts
import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

export type SnackType = 'success' | 'info' | 'warn' | 'error';

@Injectable({ providedIn: 'root' })
export class SnackBarService {
  private readonly base: MatSnackBarConfig = {
    duration: 5000,
    horizontalPosition: 'end',
    verticalPosition: 'top',
    panelClass: ['snack-base'],
  };

  constructor(private readonly snack: MatSnackBar) {}

  show(message: string, type: SnackType = 'info', action = 'OK', cfg?: MatSnackBarConfig) {
    const panel = this.classFor(type);
    const config: MatSnackBarConfig = {
      ...this.base,
      ...cfg,
      panelClass: [...(this.base.panelClass ?? []), panel, ...(cfg?.panelClass ?? [])],
    };
    this.snack.open(message, action, config);
  }

  success(msg: string, cfg?: MatSnackBarConfig) { this.show(msg, 'success', 'OK', cfg); }
  info(msg: string, cfg?: MatSnackBarConfig)    { this.show(msg, 'info', 'OK', cfg); }
  warn(msg: string, cfg?: MatSnackBarConfig)    { this.show(msg, 'warn', 'Fermer', cfg); }
  error(msg: string, cfg?: MatSnackBarConfig)   { this.show(msg, 'error', 'Détails', cfg); }

  private classFor(type: SnackType) {
    switch (type) {
      case 'success': return 'snack-success';
      case 'warn':    return 'snack-warn';
      case 'error':   return 'snack-error';
      default:        return 'snack-info';
    }
  }
}


.snack-base { color: white; font-weight: 500; }
.snack-success { background: #2e7d32; }  /* green 800 */
.snack-info    { background: #1565c0; }  /* blue 800  */
.snack-warn    { background: #ef6c00; }  /* orange 800*/
.snack-error   { background: #c62828; }  /* red 800   */


// core/interceptors/http-error.interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SnackBarService } from '../services/snack-bar.service';
import { catchError, throwError } from 'rxjs';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(SnackBarService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const msg = err.error?.message || err.message || 'Erreur réseau';
        snack.error(`HTTP ${err.status} – ${msg}`);
      } else {
        snack.error('Erreur inattendue');
      }
      return throwError(() => err);
    })
  );
};

// core/errors/global-error.handler.ts
import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { SnackBarService } from '../services/snack-bar.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private snack: SnackBarService, private zone: NgZone) {}

  handleError(error: unknown): void {
    // S’assure d’ouvrir le snackbar dans la zone Angular
    this.zone.run(() => this.snack.error('Une erreur est survenue (voir console).'));
    console.error('[GlobalError]', error);
  }
}


import { Component } from '@angular/core';
import { SnackBarService } from '../core/services/snack-bar.service';

@Component({
  selector: 'app-demo',
  standalone: true,
  template: `
    <button mat-raised-button (click)="save()">Save</button>
  `,
})
export class DemoComponent {
  constructor(private snack: SnackBarService) {}

  async save() {
    try {
      // ... votre logique
      this.snack.success('Sauvegarde réussie');
    } catch (e) {
      this.snack.error('Une erreur est survenue lors de la sauvegarde');
      console.error(e);
    }
  }
}

-------
// snack-bar.service.ts
import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

type Snack = 'success' | 'info' | 'warn' | 'error'; // évite les fautes de frappe

@Injectable({ providedIn: 'root' })
export class SnackBarService {
  constructor(private readonly snack: MatSnackBar) {}

  open(message: string, type: Snack = 'info', cfg?: MatSnackBarConfig) {
    this.snack.open(message, 'OK', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: [`${type}-snackbar`],
      ...cfg, // permet d'écraser si besoin
    });
  }

  // raccourcis optionnels
  success(msg: string, cfg?: MatSnackBarConfig) { this.open(msg, 'success', cfg); }
  error(msg: string, cfg?: MatSnackBarConfig)   { this.open(msg, 'error', cfg); }
}



------------------------------------------------

import { Component, OnInit } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <button (click)="doLogin()">Se connecter</button>
  `
})
export class LoginComponent implements OnInit {
  constructor(
    private oauth: OAuthService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    // 1) Consomme le hash (#access_token=...) puis callback
    await this.oauth.tryLoginImplicitFlow({
      onTokenReceived: () => {
        this.cleanUrlBar();         // enlève le hash dans la barre d'adresse
        this.navigateToReturnUrl(); // redirige proprement
      }
    });

    // 2) Si déjà connecté (reload / retour direct)
    if (this.auth.isAuthenticated()) {
      this.cleanUrlBar();
      this.navigateToReturnUrl();
    }

    // 3) Sécurité : si l'événement arrive plus tard (rare)
    this.oauth.events.subscribe(e => {
      if (e.type === 'token_received') {
        this.cleanUrlBar();
        this.navigateToReturnUrl();
      }
    });
  }

  doLogin(): void {
    this.auth.login();
  }

  /** Helpers */
  private navigateToReturnUrl(): void {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl') || '/worktable';
    const clean = raw.split('#')[0]; // au cas où returnUrl aurait un fragment
    this.router.navigateByUrl(clean, { replaceUrl: true });
  }

  private cleanUrlBar(): void {
    // Supprime tout fragment ou query restants de la barre d'adresse
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}
