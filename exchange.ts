export type FrequenceExtraction = 'ANNUEL' | 'TRIMESTRIEL';
export type TypeFichierExtraction = 'XLS' | 'PDF';

export interface ExtractionRequest {
  dateRapport: string;
  numTransit: string[];
  frequenceExtraction: FrequenceExtraction;
  typeFichierExtraction: TypeFichierExtraction;
}

@Injectable({ providedIn: 'root' })
export class RedditionFacade {
  private readonly selectedDateSubject = new BehaviorSubject<string>(''); // "YYYY-MM-DD"
  readonly selectedDate$ = this.selectedDateSubject.asObservable();

  private readonly selectedTransitIdSubject = new BehaviorSubject<string>('');
  readonly selectedTransitId$ = this.selectedTransitIdSubject.asObservable();

  readonly vm$ = combineLatest([this.transits$, this.selectedTransitId$]).pipe(
    map(([transits, selectedTransitId]) => ({
      transits,
      selectedTransitId,
      comboOptionsTransits: transits.map(t => [`${t.numeroTransit}`, `${t.nomTransit}`]),
    })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly showActions$ = combineLatest([this.selectedDate$, this.selectedTransitId$]).pipe(
    map(([date, transitId]) => !!date && !!transitId),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  setSelectedTransit(id: string): void {
    this.selectedTransitIdSubject.next(id ?? '');
  }

  setSelectedDate(input: Date | string | null | undefined): void {
    if (!input) {
      this.selectedDateSubject.next('');
      return;
    }
    const d = input instanceof Date ? input : new Date(input);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    this.selectedDateSubject.next(end.toLocaleDateString('sv')); // YYYY-MM-DD
  }

  extraire$(): Observable<void> {
    const frequenceExtraction: FrequenceExtraction = 'TRIMESTRIEL';
    const typeFichierExtraction: TypeFichierExtraction = 'XLS';

    return combineLatest([this.selectedDate$, this.selectedTransitId$]).pipe(
      take(1),
      switchMap(([dateRapport, transitId]) => {
        if (!dateRapport || !transitId) return EMPTY;

        const payload: ExtractionRequest = {
          dateRapport,
          numTransit: [transitId],
          frequenceExtraction,
          typeFichierExtraction,
        };

        return this.transitRepo.extraire$(payload);
      })
    );
  }

  envoyer$(): Observable<void> {
    return combineLatest([this.selectedDate$, this.selectedTransitId$]).pipe(
      take(1),
      switchMap(([date, transitId]) => {
        if (!date || !transitId) return EMPTY;
        return this.transitRepo.envoyer$({ date, transitId });
      })
    );
  }

  constructor(private readonly transitRepo: TransitRepository) {}
}
