protected runEffect<T>(
  work$: Observable<T>,
  mapError: (err: unknown) => AppError,
  opts: {
    fallbackValue: T;                 // 👈 obligatoire
    useGlobalSpinner?: boolean;       // default true
    clearAlertOnStart?: boolean;      // default false ou true selon ton UX
    error?: { title?: string; fallbackMessage?: string };
    onError?: (appErr: AppError) => void;
  }
): Observable<T> {
  const {
    fallbackValue,
    useGlobalSpinner = true,
    clearAlertOnStart = false,
    error,
    onError,
  } = opts;

  if (clearAlertOnStart) this.clearAlert();

  let stream$ = work$.pipe(takeUntilDestroyed(this.destroyRef));

  if (useGlobalSpinner) {
    stream$ = stream$.pipe(withGlobalSpinner(this.store));
  }

  return stream$.pipe(
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

      // ✅ au lieu de EMPTY
      return of(fallbackValue);
    })
  );
}


readonly transits$ = this.runEffect(
  this.transitRepo.obtenirTransits({ includeTransitsFusionnes: true }),
  this.apiErrorMapper.toAppError,
  {
    fallbackValue: [],
    useGlobalSpinner: true,
    clearAlertOnStart: true,
    error: { title: 'Chargement impossible', fallbackMessage: 'Impossible de charger les transits.' }
  }
).pipe(
  shareReplay({ bufferSize: 1, refCount: true }) // 👈 important pour éviter multi appels/alertes
);


readonly transits$ = this.runEffect(
  this.transitRepo.obtenirTransits({ includeTransitsFusionnes: true }),
  this.apiErrorMapper.toAppError,
  {
    fallbackValue: [],               // 👈 clé ici
    useGlobalSpinner: true,
    clearAlertOnStart: true,
    error: {
      title: 'Chargement impossible',
      fallbackMessage: 'Impossible de charger les transits.',
    },
  }
).pipe(
  shareReplay({ bufferSize: 1, refCount: true })
);
