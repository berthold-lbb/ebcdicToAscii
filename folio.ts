ajouterFolioEop(): void {
  combineLatest([
    this.numFolioEnAjout$,
    this.foliosEop$,
    this.selectedTransitId$, // si tu en as besoin pour la requête
  ])
    .pipe(take(1))
    .subscribe(([rawInput, folios, selectedTransitId]) => {
      // 1) normaliser
      const normalized = normalizeFolio7(rawInput);

      if (!normalized.ok) {
        // Alert métier (tu peux mettre variant warning/error selon ton DS)
        this.setAlert({
          variant: 'error',
          title: 'Validation',
          message: normalized.reason === 'EMPTY'
            ? 'Le folio est obligatoire.'
            : 'Le folio ne doit pas dépasser 7 chiffres.',
        });

        // si ton alert doit apparaître dans le modal
        this.isAlertOnModalSubject.next(true);
        return;
      }

      const folio7 = normalized.folio7;

      // 2) vérifier doublon (comparaison sur la version normalisée)
      const exists = Array.isArray(folios) && folios.some(f => {
        const existingRaw = (f as any)?.numFolio ?? (f as any)?.folio ?? '';
        const n = normalizeFolio7(String(existingRaw));
        return n.ok && n.folio7 === folio7;
      });

      if (exists) {
        this.setAlert({
          variant: 'error',
          title: 'Validation',
          message: 'Ce folio existe déjà.',
        });
        this.isAlertOnModalSubject.next(true);
        return;
      }

      // 3) construire la requête (padding conservé)
      const requete = {
        idTransit: selectedTransitId === 'tous' ? '' : selectedTransitId,
        numFolio: folio7, // <-- IMPORTANT: c'est "0000100" etc.
      };

      // 4) appel backend (remplace par ton repo exact)
      this.runEffect(
        this.parametre13EopRepo.ajouterFolio(requete), // <- adapte le nom
        (err: unknown) => err as AppError,
        {
          useGlobalSpinner: true,
          clearAlertOnStart: true,
          fallbackValue: null,
          error: { title: 'Ajout impossible', fallbackMessage: "Impossible d'ajouter le folio." },
        }
      ).subscribe(() => {
        // 5) clean / refresh
        this.setNumFolioEnAjout('');
        this.isAlertOnModalSubject.next(false);

        // Si tu as un refresh folios:
        this.rafraichirFoliosEopsSubject.next(void 0);
      });
    });
}
