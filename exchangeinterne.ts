import { DestroyRef, inject } from '@angular/core';
import { Store } from '@ngxs/store';
import {
  Observable,
  EMPTY,
  Subject,
  defer,
  shareReplay,
  catchError,
  finalize,
  tap,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type AlertVariant = 'error' | 'success' | 'info' | 'warning';

export interface UiAlert {
  variant: AlertVariant;
  title?: string;
  message: string;
  timestamp: number;
}

export abstract class BaseFacade {
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(Store);

  // ---------- UI state (tu peux remplacer par NGXS si tu préfères) ----------
  private readonly alertSubject = new Subject<UiAlert | null>();
  readonly alert$ = this.alertSubject.asObservable();

  protected setAlert(alert: UiAlert) {
    this.alertSubject.next(alert);
  }
  clearAlert() {
    this.alertSubject.next(null);
  }

  // ---------- Loading ----------
  /**
   * Enveloppe un observable avec ton spinner global.
   * => dispatch UpdateActiveCalls(true) au start, false au finalize.
   */
  protected withGlobalLoading<T>(): (source$: Observable<T>) => Observable<T> {
    return (source$) =>
      defer(() => {
        this.store.dispatch(new UpdateActiveCalls(true));
        return source$.pipe(
          finalize(() => {
            this.store.dispatch(new UpdateActiveCalls(false));
          })
        );
      });
  }

  // ---------- cache1 ----------
  /**
   * cache1 : crée une fonction qui renvoie un Observable partagé,
   * qui ne fait le call qu'une fois tant que tu ne reset pas.
   *
   * - refCount false => reste en cache même si plus aucun subscriber
   * - reset() permet de forcer un reload
   */
  protected cache1<T>(factory: () => Observable<T>) {
    let cached$: Observable<T> | null = null;

    const get$ = () => {
      if (!cached$) {
        cached$ = factory().pipe(
          shareReplay({ bufferSize: 1, refCount: false })
        );
      }
      return cached$;
    };

    const reset = () => {
      cached$ = null;
    };

    return { get$, reset };
  }

  // ---------- runAction / runEffect ----------
  /**
   * runAction : pour les actions "bouton" -> on subscribe ici.
   * - spinner global (optionnel)
   * - mapping erreur -> AppError
   * - alert success / error (optionnel)
   * - pas de throw : on avale l'erreur (EMPTY) pour éviter de casser le flux UI
   */
  protected runAction<T>(
    work$: Observable<T>,
    mapError: (err: unknown) => AppError,
    opts?: {
      useGlobalSpinner?: boolean; // default true
      clearAlertOnStart?: boolean; // default true (tu peux mettre false pour persistance)
      success?: { title?: string; message: string };
      error?: { title?: string; fallbackMessage?: string };
      onSuccess?: (value: T) => void;
      onError?: (appErr: AppError) => void;
    }
  ): void {
    const {
      useGlobalSpinner = true,
      clearAlertOnStart = true,
      success,
      error,
      onSuccess,
      onError,
    } = opts ?? {};

    if (clearAlertOnStart) this.clearAlert();

    let stream$ = work$.pipe(takeUntilDestroyed(this.destroyRef));

    if (useGlobalSpinner) {
      stream$ = stream$.pipe(this.withGlobalLoading());
    }

    stream$
      .pipe(
        tap((value) => {
          onSuccess?.(value);

          if (success) {
            this.setAlert({
              variant: 'success',
              title: success.title ?? 'Succès',
              message: success.message,
              timestamp: Date.now(),
            });
          }
        }),
        catchError((err) => {
          const appErr = mapError(err);
          onError?.(appErr);

          const msg =
            appErr.message ??
            error?.fallbackMessage ??
            'Une erreur est survenue.';

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

  /**
   * runEffect : utile pour les streams "automatiques" (load initial, refresh, etc.)
   * => renvoie un observable à binder plutôt que de subscribe.
   */
  protected runEffect<T>(
    work$: Observable<T>,
    mapError: (err: unknown) => AppError,
    opts?: {
      useGlobalSpinner?: boolean; // default true
      onError?: (appErr: AppError) => void;
    }
  ): Observable<T> {
    const { useGlobalSpinner = true, onError } = opts ?? {};

    let stream$ = work$.pipe(takeUntilDestroyed(this.destroyRef));
    if (useGlobalSpinner) stream$ = stream$.pipe(this.withGlobalLoading());

    return stream$.pipe(
      catchError((err) => {
        const appErr = mapError(err);
        onError?.(appErr);
        this.setAlert({
          variant: 'error',
          title: 'Erreur',
          message: appErr.message ?? 'Une erreur est survenue.',
          timestamp: Date.now(),
        });
        return EMPTY;
      })
    );
  }
}
