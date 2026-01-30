extraire(): void {
  const work$ = combineLatest([
    this.selectedDateLabel$,   // string | null
    this.selectedTransitId$,   // string | null
    this.auth.isPaie$(),       // boolean
    this.auth.isSaci$(),       // boolean
  ]).pipe(
    take(1),
    switchMap(([dateRapport, transitId, isPaie, isSaci]) => {
      // 1) validations UI
      if (!dateRapport || !transitId) {
        this.setAlert({
          variant: 'warning',
          title: this.translate.instant('GLOBAL.MESSAGE_INFORMATION'),
          message: this.translate.instant('GLOBAL.FORMS.VEUILLEZ_SELECTIONNER_DATE_ET_TRANSIT'),
          timestamp: Date.now(),
        });
        return EMPTY;
      }

      // 2) rôle -> roleKey
      const roleKey = isPaie ? 'PAIE' : isSaci ? 'SACI' : null;
      if (!roleKey) {
        this.setAlert({
          variant: 'warning',
          title: this.translate.instant('GLOBAL.MESSAGE_INFORMATION'),
          message: this.translate.instant('GLOBAL.FORMS.ROLE_INVALIDE'),
          timestamp: Date.now(),
        });
        return EMPTY;
      }

      // 3) policy par rôle
      const policy = POLICY_PAR_ROLE[roleKey];

      const frequenceExtraction = policy.frequenceExtraction;
      const typeFichierExtraction = policy.typeFichierExtraction;

      // 4) payload (fidèle à ton code)
      const payload: ExtractionConciliationFinAnneeParams = {
        body: {
          dateRapport: `+33${dateRapport}`,
          numTransit: [transitId],
          frequenceExtraction,
          typeFichierExtraction,
        },
      };

      // 5) appel API
      return this.conciliationRepo.obtenirExtractionConciliationFinAnnee$(payload).pipe(
        tap((res) => {
          const blob = res.body as Blob;
          const cd = res.headers.get('content-disposition');

          const fallbackName =
            roleKey === 'PAIE'
              ? FileUtils.getFilenameFromContentDisposition(cd) ?? `Reddition-${transitId}-${dateRapport}.zip`
              : FileUtils.getFilenameFromContentDisposition(cd) ?? `${dateRapport}_11-2x-06_et_27-20-01.zip`;

          FileUtils.openBlobFile(blob, fallbackName, true);
        }),
        map(() => void 0)
      );
    })
  );

  // ✅ ici on centralise : spinner + mapping erreur + alerte persistante
  this.runAction({
    work$,
    spinner: true, // active withGlobalSpinner(store)
    mapError: (e) => this.apiErrorMapper.map(e),
    successMessage: this.translate.instant('FOLIO13EOP.MESSAGE_AJOUT_FOLIO_SUCCES'),
    errorTitle: this.translate.instant('GLOBAL.MESSAGE_ERREUR'),
  });
}
