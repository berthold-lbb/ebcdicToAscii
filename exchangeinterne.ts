import { BehaviorSubject, Subject, merge } from 'rxjs';
import { auditTime, distinctUntilChanged, map, shareReplay, switchMap, withLatestFrom, skip } from 'rxjs/operators';

type TransitId = 'tous' | string;

export class Folio13EopFacade extends BaseFacade {
  private readonly selectedTransitIdSubject = new BehaviorSubject<TransitId>('tous');
  readonly selectedTransitId$ = this.selectedTransitIdSubject.asObservable().pipe(
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  setSelectedTransitId(id: TransitId): void {
    this.selectedTransitIdSubject.next(id);
  }

  private readonly refreshSubject = new Subject<void>();
  refreshFolios(): void {
    this.refreshSubject.next();
  }

  // ✅ 1) Changement de transit (mais on skip l’émission initiale pour éviter double avec init/refresh)
  private readonly changeTransitTrigger$ = this.selectedTransitId$.pipe(skip(1));

  // ✅ 2) Refresh (prend toujours le dernier transit)
  private readonly refreshTrigger$ = this.refreshSubject.pipe(
    withLatestFrom(this.selectedTransitId$),
    map(([, id]) => id),
  );

  // ✅ 3) Le vrai trigger final (1 emission = 1 appel)
  private readonly folioTriggers$ = merge(
    this.selectedTransitId$,      // ✅ charge au démarrage (1 fois)
    this.changeTransitTrigger$,   // ✅ charge quand changement (après le start)
    this.refreshTrigger$,         // ✅ charge quand refresh
  ).pipe(
    auditTime(0),
    map(id => (id === 'tous' ? undefined : id) as string | undefined),
    distinctUntilChanged((a, b) => a === b), // sécurité
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ⚠️ IMPORTANT : refCount:false évite la re-souscription quand le template remonte/descend (modals, @if, etc.)
  readonly foliosEop$ = this.folioTriggers$.pipe(
    switchMap(idTransit => this.parametre13EopRepo.obtenirFolio13Eop$({ idTransit })),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
}

readonly foliosEop$ = this.folioTriggers$.pipe(
    switchMap(idTransit => this.parametre13EopRepo.obtenirFolio13Eop$({ idTransit })),
    shareReplay({ bufferSize: 1, refCount: false }),
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
