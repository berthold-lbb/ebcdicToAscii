import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, switchMap } from 'rxjs/operators';

import { BaseFacade, AppError } from './base-facade';
import {
  Affichage,
  ModeTravail,
  TransitBffDto,
  InformationCompteGlBffDto,
  GestionTacheRowDto,
  GestionTachesCriteria,
  GestionTachesViewState,
  initialCriteria,
  initialVm,
} from '../domain/gestion-taches.models';

import { TacheConciliationAutomatiqueRepository } from '../repository/tache-conciliation-automatique.repository';

function shallowCriteriaEqual(a: GestionTachesCriteria, b: GestionTachesCriteria): boolean {
  return (
    a.affichage === b.affichage &&
    a.modeTravail === b.modeTravail &&
    a.entiteId === b.entiteId &&
    a.compteId === b.compteId
  );
}

@Injectable()
export class GestionTachesFacade extends BaseFacade {
  private readonly repo = inject(TacheConciliationAutomatiqueRepository);

  /** ✅ source de vérité */
  private readonly criteriaSubject = new BehaviorSubject<GestionTachesCriteria>(initialCriteria);
  readonly criteria$ = this.criteriaSubject.asObservable().pipe(
    distinctUntilChanged(shallowCriteriaEqual),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** mapping erreur -> AppError (adapte) */
  private mapError(err: unknown): AppError {
    // tu peux mettre ton ApiErrorMapper ici
    return err as AppError;
  }

  /** ---------------------------
   *  1) LOAD INITIAL LISTS
   *  --------------------------- */

  private readonly initialLists$ = this.criteria$.pipe(
    map((c) => c.affichage),
    distinctUntilChanged(),
    switchMap((affichage) =>
      combineLatest([
        this.runEffect(
          this.repo.obtenirEntites(affichage),
          (err) => this.mapError(err),
          {
            fallbackValue: [] as TransitBffDto[],
            clearAlertOnStart: true,
            error: { title: 'Chargement impossible', fallbackMessage: 'Impossible de charger les entités.' },
          }
        ),
        this.runEffect(
          this.repo.obtenirComptes(affichage),
          (err) => this.mapError(err),
          {
            fallbackValue: [] as InformationCompteGlBffDto[],
            clearAlertOnStart: false, // évite d'effacer l’alerte de l’autre call
            error: { title: 'Chargement impossible', fallbackMessage: 'Impossible de charger les comptes.' },
          }
        ),
      ]).pipe(
        map(([entites, comptes]) => ({
          entiteOptions: this.toEntiteOptions(entites),
          compteOptions: this.toCompteOptions(comptes),
        }))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** ---------------------------
   *  2) LOAD DEPENDENT DATA (rows + options)
   *  --------------------------- */
  private readonly selectionResult$ = this.criteria$.pipe(
    switchMap((c) => {
      // Rien sélectionné -> on vide les dépendants
      if (c.modeTravail === 'ENTITE' && !c.entiteId) {
        return of({
          rows: [] as GestionTacheRowDto[],
          dependentEntiteOptions: [] as string[][],
          dependentCompteOptions: [] as string[][],
        });
      }
      if (c.modeTravail === 'COMPTE' && !c.compteId) {
        return of({
          rows: [] as GestionTacheRowDto[],
          dependentEntiteOptions: [] as string[][],
          dependentCompteOptions: [] as string[][],
        });
      }

      // ENTITE sélectionnée
      if (c.modeTravail === 'ENTITE' && c.entiteId) {
        return this.runEffect(
          this.repo.obtenirRowsParEntite(c.affichage, c.entiteId),
          (err) => this.mapError(err),
          {
            fallbackValue: [] as GestionTacheRowDto[],
            clearAlertOnStart: true,
            error: { title: 'Chargement impossible', fallbackMessage: 'Impossible de charger les résultats pour cette entité.' },
          }
        ).pipe(
          map((rows) => ({
            rows,
            dependentCompteOptions: this.toCompteOptionsFromRows(rows),
            dependentEntiteOptions: [] as string[][], // pas nécessaire dans ce mode
          }))
        );
      }

      // COMPTE sélectionné
      if (c.modeTravail === 'COMPTE' && c.compteId) {
        return this.runEffect(
          this.repo.obtenirRowsParCompte(c.affichage, c.compteId),
          (err) => this.mapError(err),
          {
            fallbackValue: [] as GestionTacheRowDto[],
            clearAlertOnStart: true,
            error: { title: 'Chargement impossible', fallbackMessage: 'Impossible de charger les résultats pour ce compte.' },
          }
        ).pipe(
          map((rows) => ({
            rows,
            dependentEntiteOptions: this.toEntiteOptionsFromRows(rows),
            dependentCompteOptions: [] as string[][], // pas nécessaire dans ce mode
          }))
        );
      }

      return of({
        rows: [] as GestionTacheRowDto[],
        dependentEntiteOptions: [] as string[][],
        dependentCompteOptions: [] as string[][],
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** ---------------------------
   *  3) VIEWSTATE UNIQUE
   *  --------------------------- */
  readonly viewState$: Observable<GestionTachesViewState> = combineLatest([
    this.criteria$,
    this.initialLists$,
    this.selectionResult$,
  ]).pipe(
    map(([c, initial, selection]) => {
      const vm: GestionTachesViewState = {
        ...initialVm,

        affichage: c.affichage,
        modeTravail: c.modeTravail,

        entiteOptions: initial.entiteOptions,
        compteOptions: initial.compteOptions,

        selectedEntiteId: c.entiteId,
        selectedCompteId: c.compteId,

        dependentEntiteOptions: selection.dependentEntiteOptions,
        dependentCompteOptions: selection.dependentCompteOptions,

        rows: selection.rows,
      };

      return vm;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** =========================
   *  SETTERS (API EVENTS)
   *  ========================= */

  setAffichage(affichage: Affichage) {
    const c = this.criteriaSubject.value;
    if (c.affichage === affichage) return;

    // reset complet
    this.criteriaSubject.next({
      affichage,
      modeTravail: c.modeTravail, // on garde le mode (ou tu peux reset à ENTITE si tu veux)
      entiteId: null,
      compteId: null,
    });
  }

  setModeTravail(modeTravail: ModeTravail) {
    const c = this.criteriaSubject.value;
    if (c.modeTravail === modeTravail) return;

    // reset complet des sélections
    this.criteriaSubject.next({
      ...c,
      modeTravail,
      entiteId: null,
      compteId: null,
    });
  }

  /** ⚠️ ICI : on ne touche PAS au modeTravail */
  setEntiteId(entiteId: string | null) {
    const c = this.criteriaSubject.value;
    if (c.modeTravail !== 'ENTITE') return;
    if (c.entiteId === entiteId) return;

    this.criteriaSubject.next({
      ...c,
      entiteId,
      compteId: null, // reset l’autre
    });
  }

  /** ⚠️ ICI : on ne touche PAS au modeTravail */
  setCompteId(compteId: string | null) {
    const c = this.criteriaSubject.value;
    if (c.modeTravail !== 'COMPTE') return;
    if (c.compteId === compteId) return;

    this.criteriaSubject.next({
      ...c,
      compteId,
      entiteId: null, // reset l’autre
    });
  }

  /** =========================
   *  MAPPINGS OPTIONS
   *  ========================= */

  private toEntiteOptions(entites: TransitBffDto[]): string[][] {
    // format DSD combobox = string[][]
    // adapte si tu as [id, label]
    return entites.map((e) => [e.transitEntite, e.libelle ?? e.transitEntite]);
  }

  private toCompteOptions(comptes: InformationCompteGlBffDto[]): string[][] {
    return comptes.map((c) => [c.numeroCompte, c.libelle ?? c.numeroCompte]);
  }

  private toCompteOptionsFromRows(rows: GestionTacheRowDto[]): string[][] {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.compteId) set.add(r.compteId);
    }
    return Array.from(set).map((id) => [id, id]);
  }

  private toEntiteOptionsFromRows(rows: GestionTacheRowDto[]): string[][] {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.entiteId) set.add(r.entiteId);
    }
    return Array.from(set).map((id) => [id, id]);
  }
}









-----------------------------------


import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Affichage, ModeTravail, GestionTachesViewState } from '../../domain/gestion-taches.models';

type FiltersForm = FormGroup<{
  affichage: FormControl<Affichage>;
  modeTravail: FormControl<ModeTravail>;
  entiteId: FormControl<string | null>;
  compteId: FormControl<string | null>;
}>;

@Component({
  selector: 'app-gestion-taches-filters',
  templateUrl: './gestion-taches-filters.html',
})
export class GestionTachesFiltersComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) viewState!: GestionTachesViewState;

  @Output() affichageChange = new EventEmitter<Affichage>();
  @Output() modeTravailChange = new EventEmitter<ModeTravail>();
  @Output() entiteChange = new EventEmitter<string | null>();
  @Output() compteChange = new EventEmitter<string | null>();
  @Output() submit = new EventEmitter<void>();

  form: FiltersForm = this.fb.group({
    affichage: this.fb.control<Affichage>('GESTION_TACHES', { nonNullable: true }),
    modeTravail: this.fb.control<ModeTravail>('ENTITE', { nonNullable: true }),
    entiteId: this.fb.control<string | null>(null, { validators: [Validators.required] }),
    compteId: this.fb.control<string | null>(null, { validators: [Validators.required] }),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['viewState']?.currentValue) return;

    const vm = this.viewState;

    // patch sans déclencher valueChanges
    this.form.patchValue(
      {
        affichage: vm.affichage,
        modeTravail: vm.modeTravail,
        entiteId: vm.selectedEntiteId,
        compteId: vm.selectedCompteId,
      },
      { emitEvent: false }
    );

    // activer / désactiver les validators selon le mode
    this.syncValidators(vm.modeTravail);
  }

  private syncValidators(mode: ModeTravail) {
    const entiteCtrl = this.form.controls.entiteId;
    const compteCtrl = this.form.controls.compteId;

    if (mode === 'ENTITE') {
      entiteCtrl.setValidators([Validators.required]);
      compteCtrl.clearValidators();
      // UX: reset compte si on est en ENTITE
      compteCtrl.setValue(null, { emitEvent: false });
    } else {
      compteCtrl.setValidators([Validators.required]);
      entiteCtrl.clearValidators();
      entiteCtrl.setValue(null, { emitEvent: false });
    }

    entiteCtrl.updateValueAndValidity({ emitEvent: false });
    compteCtrl.updateValueAndValidity({ emitEvent: false });
  }

  onAffichageRadio(value: Affichage) {
    this.affichageChange.emit(value);
  }

  onModeTravailRadio(value: ModeTravail) {
    this.modeTravailChange.emit(value);
  }

  // Ces handlers sont appelés par tes dsd-combobox
  onEntiteSelect(entiteId: string | null) {
    this.entiteChange.emit(entiteId);
  }

  onCompteSelect(compteId: string | null) {
    this.compteChange.emit(compteId);
  }

  onSubmit() {
    this.submit.emit();
  }
}


import { Component, inject } from '@angular/core';
import { GestionTachesFacade } from '../facade/gestion-taches.facade';
import { Affichage, ModeTravail } from '../domain/gestion-taches.models';

@Component({
  selector: 'app-gestion-taches-page',
  templateUrl: './gestion-taches-page.html',
  providers: [GestionTachesFacade],
})
export class GestionTachesPageComponent {
  readonly facade = inject(GestionTachesFacade);

  onAffichageChange(v: Affichage) {
    this.facade.setAffichage(v);
  }

  onModeTravailChange(v: ModeTravail) {
    this.facade.setModeTravail(v);
  }

  onEntiteChange(id: string | null) {
    this.facade.setEntiteId(id);
  }

  onCompteChange(id: string | null) {
    this.facade.setCompteId(id);
  }

  onSubmit() {
    // optionnel : tu peux forcer un refresh en ré-emettant le même criteria
    // ou créer une action refresh dédiée si tu veux
  }
}



--------


export type Affichage = 'GESTION_TACHES' | 'TOUS_COMPTES';
export type ModeTravail = 'ENTITE' | 'COMPTE';

/** DTOs existants (adapte si tes noms sont différents) */
export interface TransitBffDto {
  transitEntite: string; // ou id
  libelle?: string;
}

export interface InformationCompteGlBffDto {
  numeroCompte: string; // ou id
  libelle?: string;
}

/** Ce que ta grid affiche (adapte) */
export interface GestionTacheRowDto {
  entiteId?: string;
  compteId?: string;
  // ... autres colonnes
}

export interface GestionTachesCriteria {
  affichage: Affichage;
  modeTravail: ModeTravail;
  entiteId: string | null;
  compteId: string | null;
}

export interface GestionTachesViewState {
  // radios
  affichage: Affichage;
  modeTravail: ModeTravail;

  // options initiales (toujours chargées)
  entiteOptions: string[][];
  compteOptions: string[][];

  // selections
  selectedEntiteId: string | null;
  selectedCompteId: string | null;

  // options dépendantes (quand tu sélectionnes)
  dependentEntiteOptions: string[][];
  dependentCompteOptions: string[][];

  // grid
  rows: GestionTacheRowDto[];
}

export const initialCriteria: GestionTachesCriteria = {
  affichage: 'GESTION_TACHES',
  modeTravail: 'ENTITE',
  entiteId: null,
  compteId: null,
};

export const initialVm: GestionTachesViewState = {
  affichage: 'GESTION_TACHES',
  modeTravail: 'ENTITE',

  entiteOptions: [],
  compteOptions: [],

  selectedEntiteId: null,
  selectedCompteId: null,

  dependentEntiteOptions: [],
  dependentCompteOptions: [],

  rows: [],
};




------------------------------------------------------------------------------------
<div class="gestion-taches-page dsd-color-background-page dsd-pl-sm">
  @if (facade.alerts$ | async; as alert) {
    @if (alert) {
      <dsd-alert [variant]="alert.variant" dynamic="true">
        <h2 slot="title">{{ alert.title ?? 'Message' }}</h2>
        <p>{{ alert.message }}</p>
      </dsd-alert>
    }
  }

  @if (facade.viewState$ | async; as vm) {
    <app-gestion-taches-filters
      [viewState]="vm"
      (affichageChange)="onAffichageChange($event)"
      (modeTravailChange)="onModeTravailChange($event)"
      (entiteChange)="onEntiteChange($event)"
      (compteChange)="onCompteChange($event)"
      (submit)="onSubmit()">
    </app-gestion-taches-filters>

    <app-gestion-taches-grid [rows]="vm.rows"></app-gestion-taches-grid>
  }
</div>



function isIsoDateStrict(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === (m - 1) &&
    dt.getUTCDate() === d
  );
}

function lastDayOfPreviousMonthIso(fromIso: string): string {
  const [y, m] = fromIso.split('-').map(Number);
  const lastPrev = new Date(Date.UTC(y, m - 1, 0));

  const yyyy = lastPrev.getUTCFullYear();
  const mm = String(lastPrev.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(lastPrev.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

onDateChange(evt: CustomEvent): void {
  const raw = (evt as any).detail?.value as string;

  // 1) vide -> clear
  if (!raw) {
    this.facade.setSelectedDate('');
    return;
  }

  // 2) saisie incomplète -> on ignore (pas de conversion)
  if (!isIsoDateStrict(raw)) {
    return;
  }

  // 3) saisie complète et valide -> conversion safe
  const converted = lastDayOfPreviousMonthIso(raw);
  this.facade.setSelectedDate(converted);
}

export function withGlobalSpinner<T>(store: Store): MonoTypeOperatorFunction<T> {
  return (source) =>
    defer(() => {
      store.dispatch(new UpdateActiveCalls(true));
      return source.pipe(
        finalize(() => store.dispatch(new UpdateActiveCalls(false)))
      );
    });
}



import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';

private normalizeBody(err: HttpErrorResponse): unknown {
  const body = err.error;

  // Déjà un objet JSON
  if (body !== null && typeof body === 'object') return body;

  // String (souvent JSON stringifié)
  if (typeof body === 'string') {
    const trimmed = body.trim();

    // essaye de parser si ça ressemble à du JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return body; // string non JSON ou JSON invalide
      }
    }

    return body; // texte simple/HTML
  }

  return body; // null/undefined/other
}


static endOfMonthIso(dateIso: string): string {
  if (!dateIso || !/^\d{4}-\d{2}/.test(dateIso)) {
    return '';
  }

  const [y, m] = dateIso.split('-').map(Number);
  if (!y || !m) return '';

  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}
