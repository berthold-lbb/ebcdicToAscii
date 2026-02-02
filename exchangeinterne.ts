import { DestroyRef, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, Subject, Subscription, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type AlertVariant = 'error' | 'confirmation' | 'information';

export interface UiAlert {
  variant: AlertVariant;
  title?: string;
  message: string;
  timestamp: number;
  autoCloseMs?: number; // optionnel
}

export abstract class BaseFacade {
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(Store);

  private readonly alertSubject = new Subject<UiAlert | null>();
  readonly alert$ = this.alertSubject.asObservable();

  private alertAutoClearSub: Subscription | null = null;

  protected setAlert(alert: UiAlert): void {
    // 1) annule le timer précédent
    this.cancelAutoClear();

    // 2) push l’alert
    this.alertSubject.next(alert);

    // 3) auto-clear UNIQUEMENT pour succès (confirmation)
    //    - par défaut: 5s
    //    - override possible via alert.autoCloseMs
    if (alert.variant === 'confirmation') {
      const ms = alert.autoCloseMs ?? 5000;

      this.alertAutoClearSub = timer(ms)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.clearAlert();
        });
    }

    // (optionnel) tu peux aussi auto-clear 'information' avec un autre timing
    // if (alert.variant === 'information') { ... }
  }

  clearAlert(): void {
    this.cancelAutoClear();
    this.alertSubject.next(null);
  }

  private cancelAutoClear(): void {
    this.alertAutoClearSub?.unsubscribe();
    this.alertAutoClearSub = null;
  }
}
