/*
  BaseFacade
  - runAction<T>() : garde EXACTEMENT le comportement historique (subscribe interne)
  - runAction$<T>() : même logique (spinner/alert/mapError/takeUntilDestroyed)
                      MAIS retourne un Observable<T> (le composant subscribe).

  Règle d’usage:
  - Si tu appelles runAction() => NE PAS re-subscribe ailleurs.
  - Si tu appelles runAction$() => c’est le composant qui subscribe (navigation, etc.).
*/

import { DestroyRef, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, EMPTY, defer } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Adapte ces imports à ton projet (tu les as déjà)
// import { withGlobalSpinner } from '...';
// import { AppError } from '...';
// import { UiAlert } from '...';

export interface AppError {
  message?: string;
  // ... autres champs
}

export type UiAlertVariant = 'confirmation' | 'error' | 'info' | 'warning';

export interface UiAlert {
  variant: UiAlertVariant;
  title: string;
  message: string;
  timestamp: number;
}

export abstract class BaseFacade {
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(Store);

  /**
   * Existant dans ton code :
   * - clearAlert()
   * - setAlert(alert)
   * - withGlobalSpinner(this.store)
   *
   * Je les laisse ici en abstract pour coller à ton style.
   */
  protected abstract clearAlert(): void;
  protected abstract setAlert(alert: UiAlert | null): void;

  /**
   * Dans ton code tu utilises un operator `withGlobalSpinner(this.store)`.
   * Je te le laisse en méthode pour que tu gardes exactement la même implémentation.
   */
  protected withGlobalSpinner<T>() {
    // ⚠️ Remplace par TON operator réel
    // return withGlobalSpinner(this.store);
    return (source$: Observable<T>) => source$;
  }

  // ------------------------------
  // runAction / runEffect (historique)
  // ------------------------------

  /**
   * runAction : pour les actions "bouton" -> on subscribe ici.
   * ✅ On CONSERVE le comportement: VOID + subscribe interne.
   */
  protected runAction<T>(
    work$: Observable<T>,
    mapError: (err: unknown) => AppError,
    opts?: {
      useGlobalSpinner?: boolean; // default true/false selon ton existant
      clearAlertOnStart?: boolean; // default true
      success?: { title?: string; message: string };
      error?: { title?: string; fallbackMessage?: string };
      onSuccess?: (value: T) => void;
      onError?: (appErr: AppError) => void;
    }
  ): void {
    const {
      useGlobalSpinner = false,
      clearAlertOnStart = true,
      success,
      error,
      onSuccess,
      onError,
    } = opts ?? {};

    if (clearAlertOnStart) this.clearAlert();

    let stream$: Observable<T> = work$.pipe(takeUntilDestroyed(this.destroyRef));

    if (useGlobalSpinner) {
      stream$ = stream$.pipe(this.withGlobalSpinner<T>());
    }

    stream$
      .pipe(
        tap((value: T) => {
          onSuccess?.(value);

          if (success) {
            this.setAlert({
              variant: 'confirmation',
              title: success.title ?? 'Succès',
              message: success.message,
              timestamp: Date.now(),
            });
          }
        }),
        catchError((err: unknown) => {
          const appErr: AppError = mapError(err);
          onError?.(appErr);

          const msg: string =
            appErr.message ?? error?.fallbackMessage ?? 'Une erreur est survenue.';

          this.setAlert({
            variant: 'error',
            title: error?.title ?? 'Erreur',
            message: msg,
            timestamp: Date.now(),
          });

          return EMPTY;
        })
      )
      .subscribe();
  }

  // ------------------------------
  // runAction$ (nouveau)
  // ------------------------------

  /**
   * runAction$ : même logique que runAction (spinner/alert/mapError),
   * MAIS retourne un Observable<T>.
   *
   * ✅ Le composant peut subscribe et faire navigation propre.
   * ✅ On ne "ruine" pas runAction, car on ne double-subscribe jamais.
   */
  protected runAction$<T>(
    work$: Observable<T>,
    mapError: (err: unknown) => AppError,
    opts?: {
      useGlobalSpinner?: boolean;
      clearAlertOnStart?: boolean;
      success?: { title?: string; message: string };
      error?: { title?: string; fallbackMessage?: string };
      onSuccess?: (value: T) => void;
      onError?: (appErr: AppError) => void;
      /**
       * Optionnel: si tu veux empêcher l’alert success (ex: navigation immédiate)
       */
      emitSuccessAlert?: boolean; // default true
      emitErrorAlert?: boolean; // default true
    }
  ): Observable<T> {
    const {
      useGlobalSpinner = false,
      clearAlertOnStart = true,
      success,
      error,
      onSuccess,
      onError,
      emitSuccessAlert = true,
      emitErrorAlert = true,
    } = opts ?? {};

    // defer() pour que le clearAlert et le wiring se fassent au moment du subscribe
    return defer(() => {
      if (clearAlertOnStart) this.clearAlert();

      let stream$: Observable<T> = work$.pipe(takeUntilDestroyed(this.destroyRef));

      if (useGlobalSpinner) {
        stream$ = stream$.pipe(this.withGlobalSpinner<T>());
      }

      return stream$.pipe(
        tap((value: T) => {
          onSuccess?.(value);

          if (emitSuccessAlert && success) {
            this.setAlert({
              variant: 'confirmation',
              title: success.title ?? 'Succès',
              message: success.message,
              timestamp: Date.now(),
            });
          }
        }),
        catchError((err: unknown) => {
          const appErr: AppError = mapError(err);
          onError?.(appErr);

          if (emitErrorAlert) {
            const msg: string =
              appErr.message ?? error?.fallbackMessage ?? 'Une erreur est survenue.';

            this.setAlert({
              variant: 'error',
              title: error?.title ?? 'Erreur',
              message: msg,
              timestamp: Date.now(),
            });
          }

          // IMPORTANT: même comportement fonctionnel que runAction (on avale l’erreur)
          // et on termine le flux.
          return EMPTY;
        })
      );
    });
  }
}

/*
  Exemple d’usage côté composant (navigation après succès)

  this.facade
    .suppressionVerrou$() // qui appelle runAction$ en interne
    .pipe(take(1))
    .subscribe(() => {
      // navigation ici
      this.location.back();
    });

  ✅ Ici il n’y a qu’UNE subscription (celle du composant), donc pas de double API.
*/
