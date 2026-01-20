import { AsyncState } from './async-state.model';
import { AppError } from './app-error.model';

export type TransitOption = [value: string, label: string];

export interface TransitDtoLite {
  id: string;
  numeroTransit: string;
  nomTransit: string;
  idSociete?: string | null;
}

export interface RedditionViewState {
  // data
  transits: TransitDtoLite[];
  transitOptions: TransitOption[];

  // form values (ce que tu affiches dans les DSD)
  selectedTransitId: string;
  selectedDateLabel: string; // dd-MM-yyyy pour DSD
  selectedDateIso: string;   // yyyy-MM-dd pour API

  // contraintes
  dateMaxLabel: string | null; // dd-MM-yyyy pour DSD (max)
  dateMaxIso: string | null;   // yyyy-MM-dd (si utile)

  // rôles / visibilité
  isPaie: boolean;
  isSaci: boolean;
  canShowActions: boolean;
  showEnvoyer: boolean;

  // states actions
  extraireState: AsyncState<AppError>;
  envoyerState: AsyncState<AppError>;

  // erreur globale (optionnel)
  error: AppError | null;
}



import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { ConciliationRepository } from '../data/conciliation.repository';
import { FileUtils } from '../shared/file-utils.service';
import { ApiErrorMapper, AppError } from '../shared/api-error.mapper';

import { AsyncState, idleState, loadingState, successState, errorState } from '../domain/async-state.model';
import { RedditionViewState, TransitDtoLite } from '../domain/reddition-viewstate.model';
import { endOfMonth, toDsdDateLabel, toIsoDate } from '../utils/date-format.util';

@Injectable({ providedIn: 'root' })
export class RedditionFacade {
  private readonly repo = inject(ConciliationRepository);
  private readonly files = inject(FileUtils);
  private readonly errorMapper = inject(ApiErrorMapper);
  private readonly auth = inject(AuthentificationService);

  // ----- form inputs (source of truth dans la façade)
  private readonly selectedDateIsoSubject = new BehaviorSubject<string>('');
  readonly selectedDateIso$ = this.selectedDateIsoSubject.asObservable();

  private readonly selectedDateLabelSubject = new BehaviorSubject<string>('');
  readonly selectedDateLabel$ = this.selectedDateLabelSubject.asObservable();

  private readonly selectedTransitIdSubject = new BehaviorSubject<string>('');
  readonly selectedTransitId$ = this.selectedTransitIdSubject.asObservable();

  // ----- states actions
  private readonly extraireStateSubject = new BehaviorSubject<AsyncState<AppError>>(idleState<AppError>());
  readonly extraireState$ = this.extraireStateSubject.asObservable();

  private readonly envoyerStateSubject = new BehaviorSubject<AsyncState<AppError>>(idleState<AppError>());
  readonly envoyerState$ = this.envoyerStateSubject.asObservable();

  // ----- roles
  readonly isPaie$ = this.auth.isPaie$().pipe(shareReplay({ bufferSize: 1, refCount: true }));
  readonly isSaci$ = this.auth.isSaci$().pipe(shareReplay({ bufferSize: 1, refCount: true }));

  // ----- transits (branche ton flux réel)
  readonly transits$: import('rxjs').Observable<TransitDtoLite[]> = this.repo.getTransits$(); // exemple

  // ----- dateMax (SACI seulement)
  readonly dateMaxIso$ = this.isSaci$.pipe(
    // si pas SACI => pas de dateMax
    switchMap(isSaci => (isSaci ? this.repo.getDateMax$() : of(null))),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly dateMaxLabel$ = this.dateMaxIso$.pipe(
    map(iso => (iso ? isoToDsdLabel(iso) : null)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // ----- ViewState unique pour la vue
  readonly viewState$ = combineLatest([
    this.transits$,
    this.selectedTransitId$,
    this.selectedDateLabel$,
    this.selectedDateIso$,
    this.dateMaxLabel$,
    this.dateMaxIso$,
    this.isPaie$,
    this.isSaci$,
    this.extraireState$,
    this.envoyerState$,
  ]).pipe(
    map(([transits, selectedTransitId, selectedDateLabel, selectedDateIso, dateMaxLabel, dateMaxIso, isPaie, isSaci, extraireState, envoyerState]): RedditionViewState => {
      const canShowActions = !!selectedDateIso && !!selectedTransitId;
      const showEnvoyer = !isPaie; // règle : PAIE => pas de bouton envoyer

      const error =
        extraireState.status === 'error' ? (extraireState.error ?? null)
        : envoyerState.status === 'error' ? (envoyerState.error ?? null)
        : null;

      return {
        transits,
        transitOptions: transits.map(t => [t.id, `${t.numeroTransit} - ${t.nomTransit}`]),

        selectedTransitId,
        selectedDateLabel,
        selectedDateIso,

        dateMaxLabel,
        dateMaxIso,

        isPaie,
        isSaci,
        canShowActions,
        showEnvoyer,

        extraireState,
        envoyerState,

        error,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // ----- setters (appelés par UI)
  setSelectedTransit(id: string | null | undefined): void {
    this.selectedTransitIdSubject.next(id ?? '');
  }

  /** Reçoit une date quelconque -> fin de mois -> stocke ISO + Label DSD */
  setSelectedDate(input: Date | string | null | undefined): void {
    if (!input) {
      this.selectedDateIsoSubject.next('');
      this.selectedDateLabelSubject.next('');
      return;
    }
    const d = input instanceof Date ? input : new Date(input);
    const end = endOfMonth(d);
    this.selectedDateIsoSubject.next(toIsoDate(end));        // yyyy-MM-dd
    this.selectedDateLabelSubject.next(toDsdDateLabel(end)); // dd-MM-yyyy
  }

  // ----- actions
  extraire(): void {
    this.extraireStateSubject.next(loadingState<AppError>());

    combineLatest([this.selectedDateIso$, this.selectedTransitId$])
      .pipe(
        take(1),
        switchMap(([dateIso, transitId]) => {
          if (!dateIso || !transitId) {
            this.extraireStateSubject.next(idleState<AppError>());
            return EMPTY;
          }

          const params = { body: { dateRapport: dateIso, numTransit: [transitId] } } as any;

          return this.repo.extraire$Response(params).pipe(
            map(res => toDownloadFile(res, `${dateIso}_rapport.zip`)),
            tap(file => this.files.download(file.blob, file.filename)),
            tap(() => this.extraireStateSubject.next(successState<AppError>())),
            catchError(err => {
              const mapped = this.errorMapper.map(err);
              this.extraireStateSubject.next(errorState<AppError>(mapped));
              return EMPTY;
            })
          );
        })
      )
      .subscribe();
  }

  envoyer(): void {
    this.envoyerStateSubject.next(loadingState<AppError>());

    combineLatest([this.selectedDateIso$, this.selectedTransitId$, this.isPaie$])
      .pipe(
        take(1),
        switchMap(([dateIso, transitId, isPaie]) => {
          if (!dateIso || !transitId || isPaie) {
            this.envoyerStateSubject.next(idleState<AppError>());
            return EMPTY;
          }

          // selon ton backend : Blob .eml OU string html -> adapte ici
          const params = { body: { dateRapport: dateIso, numTransit: [transitId] } } as any;

          return this.repo.envoyer$Response(params).pipe(
            map(res => toDownloadFile(res, `${dateIso}_Courriel_Rapport.eml`)),
            tap(file => this.files.download(file.blob, file.filename)),
            tap(() => this.envoyerStateSubject.next(successState<AppError>())),
            catchError(err => {
              const mapped = this.errorMapper.map(err);
              this.envoyerStateSubject.next(errorState<AppError>(mapped));
              return EMPTY;
            })
          );
        })
      )
      .subscribe();
  }
}

function isoToDsdLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}


@Component({
  standalone: true,
  imports: [CommonModule, DsdDatePickerBindDirective],
  templateUrl: './reddition.component.html',
})
export class RedditionComponent {
  readonly facade = inject(RedditionFacade);
  readonly viewState$ = this.facade.viewState$;

  onExtraire(): void {
    this.facade.extraire();
  }

  onEnvoyer(): void {
    this.facade.envoyer();
  }
}


@if (viewState$ | async; as s) {

  <!-- Combobox -->
  <dsd-combo
    [value]="s.selectedTransitId"
    [options]="s.transitOptions"
    (valueChange)="facade.setSelectedTransit($event)">
  </dsd-combo>

  <!-- Datepicker + binding max/value via directive -->
  <dsd-datepicker
    [bindMax]="s.dateMaxLabel"
    [bindValue]="s.selectedDateLabel"
    (dsdDatepickerChange)="facade.setSelectedDate($event)">
  </dsd-datepicker>

  @if (!s.canShowActions) {
    <div>Veuillez sélectionner une date et un transit.</div>
  } @else {
    <button [disabled]="s.extraireState.status === 'loading'" (click)="onExtraire()">
      @if (s.extraireState.status === 'loading') { Téléchargement... }
      @else if (s.extraireState.status === 'success') { Fichier récupéré }
      @else { Extraire }
    </button>

    @if (s.showEnvoyer) {
      <button [disabled]="s.envoyerState.status === 'loading'" (click)="onEnvoyer()">
        @if (s.envoyerState.status === 'loading') { Génération... }
        @else if (s.envoyerState.status === 'success') { Fichier prêt }
        @else { Envoyer }
      </button>
    }
  }

  @if (s.error) {
    <dsd-alert type="error" [title]="s.error.title" [message]="s.error.message"></dsd-alert>
  }
}
