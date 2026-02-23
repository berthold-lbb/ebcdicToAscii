private readonly canTerminerConciliation$: Observable<boolean> = this.runEffect<boolean>(
    this.readyTriggers$.pipe(
      switchMap(({ entiteId, compteId, modeTravail }) => {
        if (modeTravail === 'ENTITE') {
          return this.tacheConciliationAutoRepo
            .obtenirComptesGLAvecTachesNonTerminees({ idTransit: entiteId })
            .pipe(
              map(comptes => comptes?.some(c => (c.identifiantCompteGL ?? '') === compteId) ?? false)
            );
        }

        return this.tacheConciliationAutoRepo
          .obtenirTransitsAvecTachesNonTerminees({ idCompteGL: compteId })
          .pipe(
            map(transits => transits?.some(t => (t.identifiantTransit ?? '') === entiteId) ?? false)
          );
      })
    ),
    (err) => err as AppError,
    {
      fallbackValue: false,
      useGlobalSpinner: true,
      clearAlertOnStart: true,
      error: {
        title: 'Chargement impossible',
        fallbackMessage: 'Impossible de vérifier les tâches en cours',
      },
    }
  ).pipe(
    // si entité/compte se vident, readyTriggers$ n’émet plus, donc canTerminer reste sur l’ancienne valeur.
    // => startWith(false) garantit que l’écran démarre à false.
    startWith(false),
    shareReplay({ bufferSize: 1, refCount: true })
  );