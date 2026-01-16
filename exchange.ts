1) Centralise la policy par rôle
type RoleKey = 'PAIE' | 'SACI';

type ExtractionPolicy = {
  frequenceExtraction: FrequenceExtraction;
  typeFichierExtraction: TypeFichierExtraction;
};

const POLICY_PAR_ROLE: Record<RoleKey, ExtractionPolicy> = {
  PAIE: { frequenceExtraction: 'ANNUEL', typeFichierExtraction: 'XLS' },
  SACI: { frequenceExtraction: 'TRIMESTRIEL', typeFichierExtraction: 'PDF' },
};

2) Une seule méthode privée pour “exécuter une action REST”
private runAction$(
  call: (payload: ExtractionConcilActionFinAnnee$Params) => Observable<string>
): Observable<string> {
  return combineLatest([
    this.selectedDate$,
    this.selectedTransitId$,
    this.auth.isPaie$(),
    this.auth.isSaci$(),
  ]).pipe(
    take(1),
    switchMap(([dateRapport, transitId, isPaie, isSaci]) => {
      if (!dateRapport || !transitId) return EMPTY;

      const roleKey: RoleKey | null =
        isPaie ? 'PAIE' :
        isSaci ? 'SACI' :
        null;

      if (!roleKey) return EMPTY;

      const policy = POLICY_PAR_ROLE[roleKey];

      const payload: ExtractionConcilActionFinAnnee$Params = {
        body: {
          dateRapport,
          numeroTransit: [transitId],
          frequenceExtraction: policy.frequenceExtraction,
          typeFichierExtraction: policy.typeFichierExtraction,
        },
      };

      return call(payload);
    })
  );
}

3) Tes 2 méthodes publiques deviennent ultra courtes
extraire$(): Observable<string> {
  return this.runAction$(payload =>
    this.concilliationRepo.getExtractionConcilActionFinAnnee$(payload)
  );
}

envoyer$(): Observable<string> {
  return this.runAction$(payload =>
    this.concilliationRepo.getEnvoiConcilActionFinAnnee$(payload) // exemple
  );
}