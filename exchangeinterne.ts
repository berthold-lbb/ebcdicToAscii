private readonly folioQuery$ = merge(
  // changement de transit => reload
  this.selectedTransitId$.pipe(
    distinctUntilChanged(),
    map((id) => ({ id, reason: 'transit' as const }))
  ),

  // refresh => reload avec le dernier transit
  this.refresh$.pipe(
    withLatestFrom(this.selectedTransitId$),
    map(([, id]) => ({ id, reason: 'refresh' as const }))
  )
).pipe(
  // normalisation "tous" => undefined
  map(({ id, reason }) => ({
    idTransit: id === 'tous' ? undefined : id,
    reason
  })),
  shareReplay({ bufferSize: 1, refCount: true })
);



readonly folioEops$ = this.runEffect(
  this.folioQuery$.pipe(
    switchMap(({ idTransit }) =>
      this.parametreI3EopRepo.obtenirFolio13Eops({ idTransit })
    )
  ),
  (err) => err as AppError,
  {
    fallbackValue: [],
    useGlobalSpinner: true,
    clearAlertOnStart: true,
    error: {
      title: 'Erreur',
      fallbackMessage: 'Impossible de charger les folios EOP.'
    }
  }
).pipe(
  // crucial : 1 seul call même si template subscribe plusieurs fois
  shareReplay({ bufferSize: 1, refCount: true })
);
