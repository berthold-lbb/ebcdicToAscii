// ---- Le flux qui appelle l’API et renvoie le boolean final
  private readonly canTerminerConciliation$: Observable<boolean> = this.readyTriggers$.pipe(
    switchMap(({ entiteId, compteId, modeTravail }) => {
      // ENTITE -> on récupère les comptes GL non terminés pour une entité (idTransit = entiteId)
      if (modeTravail === 'ENTITE') {
        return this.tacheConciliationAutoRepo
          .obtenirComptesGLAvecTachesNonTerminees({ idTransit: entiteId })
          .pipe(
            map((comptes) => comptes?.some(c => (c.identifiantCompteGL ?? '') === compteId) ?? false)
          );
      }

      // COMPTE -> on récupère les transits non terminés pour un compte (idCompteGL = compteId)
      return this.tacheConciliationAutoRepo
        .obtenirTransitsAvecTachesNonTerminees({ idCompteGL: compteId })
        .pipe(
          map((transits) => transits?.some(t => (t.identifiantTransit ?? '') === entiteId) ?? false)
        );
    }),
    catchError(() => of(false)),
    // share pour ne pas rappeler 2 fois si le viewState se recompose
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // ✅ viewState$ : en l’utilisant dans le template, ça “active” tout
  readonly viewState$: Observable<ConciliationViewState> = combineLatest([
    this.states$,
    this.canTerminerConciliation$.pipe(startWith(false)),
  ]).pipe(
    map(([state, can]) => ({
      ...state,
      canTerminerConciliation: can,
    })),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}