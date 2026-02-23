private readonly checkTacheTrigger$ = this.state$.pipe(
  map(s => ({
    entiteId: s.selectedEntiteId,
    compteId: s.selectedCompteId
  })),
  filter(v => !!v.entiteId && !!v.compteId),
  distinctUntilChanged(
    (a, b) =>
      a.entiteId === b.entiteId &&
      a.compteId === b.compteId
  )
);

readonly checkTacheEffect$ = this.runEffect(
  this.checkTacheTrigger$,
  ({ entiteId, compteId }) =>
    this.conciliationRepository
      .verifierTacheEnCours(entiteId!, compteId!)
      .pipe(
        tap(result => {
          this.patchState({
            canTerminerConciliation: result
          });
        })
      )
);