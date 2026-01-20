import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, combineLatest, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';

import { ConciliationRepository } from '../data/conciliation.repository';
import { FileUtils } from '../shared/file-utils.service';
import { ApiErrorMapper, AppError } from '../shared/api-error.mapper';

import { toDownloadFile } from '../utils/download-file.mapper';
import { endOfMonth, toDsdDateLabel, toIsoDate } from '../utils/date-format.util';
import { AsyncState, idleState, loadingState, successState, errorState } from '../domain/async-state.model';
import { RedditionVm, TransitDtoLite } from '../domain/reddition-vm.model';
import { ExtractionPolicy, RoleKey } from '../domain/extraction-policy.model';

// ⚠️ adapte selon ton auth
import { AuthentificationService } from '.../core/auth/authentification.service';

// ⚠️ types OpenAPI
import {
  ExtractionConciliationFinAnnee$Params,
  ExtractionCourrielFinAnnee$Params,
} from '.../generated/fn/extraction-conciliation-fin-annee'; // adapte

const POLICY_PAR_ROLE: Record<RoleKey, ExtractionPolicy> = {
  PAIE: { frequenceExtraction: 'TRIMESTRIEL', typeFichierExtraction: 'XLS' },
  SACI: { frequenceExtraction: 'ANNUEL', typeFichierExtraction: 'PDF' },
};

@Injectable({ providedIn: 'root' })
export class RedditionFacade {
  private readonly repo = inject(ConciliationRepository);
  private readonly files = inject(FileUtils);
  private readonly errorMapper = inject(ApiErrorMapper);
  private readonly auth = inject(AuthentificationService);

  // ---------------------------
  // Inputs UI (date + transit)
  // ---------------------------
  private readonly selectedDateIsoSubject = new BehaviorSubject<string>(''); // yyyy-MM-dd (API)
  readonly selectedDateIso$ = this.selectedDateIsoSubject.asObservable();

  private readonly selectedDateLabelSubject = new BehaviorSubject<string>(''); // dd-MM-yyyy (UI)
  readonly selectedDateLabel$ = this.selectedDateLabelSubject.asObservable();

  private readonly selectedTransitIdSubject = new BehaviorSubject<string>('');
  readonly selectedTransitId$ = this.selectedTransitIdSubject.asObservable();

  // ---------------------------
  // States (extraire / envoyer)
  // ---------------------------
  private readonly extraireStateSubject = new BehaviorSubject<AsyncState<AppError>>(idleState());
  readonly extraireState$ = this.extraireStateSubject.asObservable();

  private readonly envoyerStateSubject = new BehaviorSubject<AsyncState<AppError>>(idleState());
  readonly envoyerState$ = this.envoyerStateSubject.asObservable();

  // Erreur globale (optionnel)
  readonly error$: Observable<AppError | null> = combineLatest([this.extraireState$, this.envoyerState$]).pipe(
    map(([a, b]) => (a.status === 'error' ? a.error ?? null : b.status === 'error' ? b.error ?? null : null)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // ---------------------------
  // Rôles (depuis auth)
  // ---------------------------
  readonly isPaie$ = this.auth.isPaie$(); // Observable<boolean>
  readonly isSaci$ = this.auth.isSaci$(); // Observable<boolean>

  // ---------------------------
  // Transits (exemple)
  // -> Tu branches ton flux réel ici
  // ---------------------------
  readonly transits$: Observable<TransitDtoLite[]> = of([]); // TODO: ton store / repo transits

  /** Filtre transits selon rôle: ex PAIE -> idSociete == null */
  readonly transitsFiltres$: Observable<TransitDtoLite[]> = combineLatest([this.transits$, this.isPaie$]).pipe(
    map(([transits, isPaie]) => (isPaie ? transits.filter(t => t.idSociete == null) : transits)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // ---------------------------
  // VM pour la vue
  // ---------------------------
  readonly vm$: Observable<RedditionVm> = combineLatest([
    this.transitsFiltres$,
    this.selectedTransitId$,
    this.selectedDateLabel$,
    this.selectedDateIso$,
  ]).pipe(
    map(([transits, selectedTransitId, selectedDateLabel, dateIso]) => ({
      transits,
      selectedTransitId,
      selectedDateLabel,
      dateIso,
      comboOptionsTransits: transits.map(t => [t.id, `${t.numeroTransit} - ${t.nomTransit}`]),
    })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /**
   * showActions:
   * - il faut date + transit
   * - si PAIE => on montre seulement "Extraire" (géré aussi en HTML via isPaie$)
   */
  readonly showActions$ = combineLatest([this.selectedDateIso$, this.selectedTransitId$]).pipe(
    map(([date, transitId]) => !!date && !!transitId),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // ---------------------------
  // Setters UI
  // ---------------------------
  setSelectedTransit(id: string | null | undefined): void {
    this.selectedTransitIdSubject.next(id ?? '');
  }

  /** Reçoit une date (input DSD), convertit en fin de mois et stocke iso + label */
  setSelectedDate(input: Date | string | null | undefined): void {
    if (!input) {
      this.selectedDateIsoSubject.next('');
      this.selectedDateLabelSubject.next('');
      return;
    }
    const d = input instanceof Date ? input : new Date(input);
    const end = endOfMonth(d);

    this.selectedDateIsoSubject.next(toIsoDate(end));       // yyyy-MM-dd
    this.selectedDateLabelSubject.next(toDsdDateLabel(end)); // dd-MM-yyyy
  }

  // ---------------------------
  // EXTRAIRE (Blob zip)
  // ---------------------------
  extraire$(): Observable<void> {
    this.extraireStateSubject.next(loadingState());

    return combineLatest([this.selectedDateIso$, this.selectedTransitId$, this.isPaie$, this.isSaci$]).pipe(
      take(1),
      switchMap(([dateIso, transitId, isPaie, isSaci]) => {
        if (!dateIso || !transitId) {
          this.extraireStateSubject.next(idleState());
          return EMPTY;
        }

        // Policy selon rôle (tu peux changer la priorité si PAIE/SACI peuvent coexister)
        const roleKey: RoleKey | null = isPaie ? 'PAIE' : isSaci ? 'SACI' : null;
        if (!roleKey) {
          this.extraireStateSubject.next(idleState());
          return EMPTY;
        }

        const policy = POLICY_PAR_ROLE[roleKey];

        const params: ExtractionConciliationFinAnnee$Params = {
          body: {
            dateRapport: dateIso,
            numTransit: [transitId],
            frequenceExtraction: policy.frequenceExtraction,
            typeFichierExtraction: policy.typeFichierExtraction,
          },
        } as any;

        return this.repo.extraire$Response(params).pipe(
          map(res => toDownloadFile(res, `${dateIso}_rapport.zip`)),
          tap(file => this.files.download(file.blob, file.filename)),
          tap(() => this.extraireStateSubject.next(successState())),
          map(() => void 0),
          catchError(err => {
            const mapped = this.errorMapper.map(err);
            this.extraireStateSubject.next(errorState(mapped));
            return EMPTY;
          })
        );
      })
    );
  }

  // ---------------------------
  // ENVOYER
  // ---------------------------

  /**
   * ✅ Variante A: envoyer renvoie un Blob (.eml binaire)
   * => on peut download ou open
   */
  envoyerBlob$(): Observable<void> {
    this.envoyerStateSubject.next(loadingState());

    return combineLatest([this.selectedDateIso$, this.selectedTransitId$, this.isPaie$]).pipe(
      take(1),
      switchMap(([dateIso, transitId, isPaie]) => {
        if (!dateIso || !transitId) {
          this.envoyerStateSubject.next(idleState());
          return EMPTY;
        }

        // si PAIE: on autorise envoyer ? d’après ta règle tu veux cacher envoyer, donc on bloque
        if (isPaie) {
          this.envoyerStateSubject.next(idleState());
          return EMPTY;
        }

        const params: ExtractionCourrielFinAnnee$Params = {
          body: {
            dateRapport: dateIso,
            numTransit: [transitId],
          },
        } as any;

        return this.repo.envoyer$ResponseBlob(params).pipe(
          map(res => toDownloadFile(res, `${dateIso}_Courriel_Rapport.eml`)),
          tap(file => this.files.download(file.blob, file.filename)),
          tap(() => this.envoyerStateSubject.next(successState())),
          map(() => void 0),
          catchError(err => {
            const mapped = this.errorMapper.map(err);
            this.envoyerStateSubject.next(errorState(mapped));
            return EMPTY;
          })
        );
      })
    );
  }

  /**
   * ✅ Variante B: envoyer renvoie un string (html/texte)
   * => on crée un Blob text/html et on download en .eml ou .html
   */
  envoyerText$(): Observable<void> {
    this.envoyerStateSubject.next(loadingState());

    return combineLatest([this.selectedDateIso$, this.selectedTransitId$, this.isPaie$]).pipe(
      take(1),
      switchMap(([dateIso, transitId, isPaie]) => {
        if (!dateIso || !transitId) {
          this.envoyerStateSubject.next(idleState());
          return EMPTY;
        }
        if (isPaie) {
          this.envoyerStateSubject.next(idleState());
          return EMPTY;
        }

        const params: ExtractionCourrielFinAnnee$Params = {
          body: {
            dateRapport: dateIso,
            numTransit: [transitId],
          },
        } as any;

        return this.repo.envoyer$Text(params).pipe(
          tap((html) => {
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            this.files.download(blob, `${dateIso}_Courriel_Rapport.html`);
          }),
          tap(() => this.envoyerStateSubject.next(successState())),
          map(() => void 0),
          catchError(err => {
            const mapped = this.errorMapper.map(err);
            this.envoyerStateSubject.next(errorState(mapped));
            return EMPTY;
          })
        );
      })
    );
  }
}
