<!-- components/gestion-taches-filters/gestion-taches-filters.component.html -->
<dsd-container class="gt-filters">
  <dsd-form name="gestion-taches-filters" (dsdSubmit)="onSubmit()">

    <div class="gt-filters__layout">

      <div class="gt-filters__left">
        <dsd-fieldset legend="Affichage" class="gt-fs">
          <dsd-radio-group name="affichage" formControlName="affichage" flex-direction="column">
            <dsd-radio value="GESTION_TACHES">Gestion des tâches</dsd-radio>
            <dsd-radio value="TOUS_COMPTES">Tous les comptes</dsd-radio>
            <span slot="error">
              @if (form.controls.affichage.touched && form.controls.affichage.invalid) { Choix obligatoire }
            </span>
          </dsd-radio-group>
        </dsd-fieldset>

        <dsd-vspacer all="3"></dsd-vspacer>

        <dsd-fieldset legend="Mode de travail" class="gt-fs">
          <dsd-radio-group name="modeTravail" formControlName="modeTravail" flex-direction="column">
            <dsd-radio value="ENTITE">Entité</dsd-radio>
            <dsd-radio value="COMPTE">Compte</dsd-radio>
            <span slot="error">
              @if (form.controls.modeTravail.touched && form.controls.modeTravail.invalid) { Choix obligatoire }
            </span>
          </dsd-radio-group>
        </dsd-fieldset>
      </div>

      <div class="gt-filters__right">

        <dsd-combobox
          class="gt-filters__ctrl"
          data-cy-dsd="form-input-entite"
          name="entite"
          [options]="vm.entiteOptions"
          [value]="form.controls.entiteId.value"
          [disabled]="vm.disabled || form.controls.modeTravail.value !== 'ENTITE'"
          required="true"
          (dsdComboboxClear)="onEntiteClear()"
          (dsdComboboxSelect)="onEntiteSelect($event)"
        >
          <span slot="label">Entité</span>
          <span slot="error">
            @if (form.controls.entiteId.touched && form.controls.entiteId.invalid) { Entité obligatoire }
          </span>
        </dsd-combobox>

        <dsd-combobox
          class="gt-filters__ctrl"
          data-cy-dsd="form-input-compte"
          name="compte"
          [options]="vm.compteOptions"
          [value]="form.controls.compteId.value"
          [disabled]="vm.disabled || form.controls.modeTravail.value !== 'COMPTE'"
          required="true"
          (dsdComboboxClear)="onCompteClear()"
          (dsdComboboxSelect)="onCompteSelect($event)"
        >
          <span slot="label">Compte</span>
          <span slot="error">
            @if (form.controls.compteId.touched && form.controls.compteId.invalid) { Compte obligatoire }
          </span>
        </dsd-combobox>

        <div class="gt-filters__actions">
          <dsd-button type="submit" variant="tertiary" [disabled]="vm.disabled || form.invalid">
            Actualiser
          </dsd-button>
        </div>

      </div>

    </div>
  </dsd-form>
</dsd-container>



/* components/gestion-taches-filters/gestion-taches-filters.component.scss */
.gt-filters { padding: 16px; }

.gt-filters__layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.gt-filters__left {
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
}

.gt-filters__right {
  flex: 1 1 auto;
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.gt-filters__ctrl {
  flex: 1 1 320px;
  min-width: 260px;
}

.gt-filters__actions {
  flex: 0 0 auto;
  white-space: nowrap;
  display: flex;
  align-items: flex-end;
}

@media (max-width: 900px) {
  .gt-filters__layout { flex-direction: column; }
  .gt-filters__left { width: 100%; flex: 1 1 auto; }
  .gt-filters__right { flex-direction: column; align-items: stretch; }
  .gt-filters__ctrl { min-width: 100%; }
  .gt-filters__actions { align-items: flex-start; }
}


// components/gestion-taches-filters/gestion-taches-filters.component.ts
import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, map, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GestionTachesSearchCriteria, ModeTravail, Affichage, ComboboxOption } from '../../models/gestion-taches.models';

export type SearchTrigger = 'AUTO' | 'MANUAL';

export interface FiltersVm {
  disabled: boolean;
  entiteOptions: ComboboxOption[];
  compteOptions: ComboboxOption[];
  selectedEntiteId: string | null;
  selectedCompteId: string | null;
  criteria: GestionTachesSearchCriteria;
}

export interface SearchPayload {
  trigger: SearchTrigger;
  criteria: GestionTachesSearchCriteria;
}

@Component({
  selector: 'app-gestion-taches-filters',
  templateUrl: './gestion-taches-filters.component.html',
  styleUrls: ['./gestion-taches-filters.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionTachesFiltersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) vm!: FiltersVm;
  @Output() search = new EventEmitter<SearchPayload>();

  form = this.fb.group({
    affichage: this.fb.control<Affichage>('GESTION_TACHES', { validators: [Validators.required], nonNullable: true }),
    modeTravail: this.fb.control<ModeTravail>('ENTITE', { validators: [Validators.required], nonNullable: true }),
    entiteId: this.fb.control<string | null>(null),
    compteId: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    // sync initial values from vm
    queueMicrotask(() => this.applyVmToForm());

    // validators conditionnels
    this.form.controls.modeTravail.valueChanges
      .pipe(startWith(this.form.controls.modeTravail.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((mode) => this.applyConditionalValidators(mode));

    // AUTO SEARCH quand valid + change (et pas disabled)
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        filter(() => !this.vm?.disabled),
        filter(() => this.form.valid),
        map(() => this.normalizedCriteria()),
        distinctUntilChanged((a, b) => stableStringify(a) === stableStringify(b)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((criteria) => this.search.emit({ trigger: 'AUTO', criteria }));
  }

  ngOnChanges(): void {
    // quand facade met à jour selected values
    this.applyVmToForm();
  }

  private applyVmToForm(): void {
    if (!this.vm) return;
    const c = this.vm.criteria;

    this.form.patchValue(
      {
        affichage: c.affichage,
        modeTravail: c.modeTravail,
        entiteId: this.vm.selectedEntiteId,
        compteId: this.vm.selectedCompteId,
      },
      { emitEvent: false },
    );

    this.applyConditionalValidators(c.modeTravail);
  }

  private applyConditionalValidators(mode: ModeTravail): void {
    const ent = this.form.controls.entiteId;
    const cpt = this.form.controls.compteId;

    ent.clearValidators();
    cpt.clearValidators();

    if (mode === 'ENTITE') ent.addValidators([Validators.required]);
    if (mode === 'COMPTE') cpt.addValidators([Validators.required]);

    ent.updateValueAndValidity({ emitEvent: false });
    cpt.updateValueAndValidity({ emitEvent: false });
  }

  // DSD combobox events
  onEntiteSelect(e: { value: string }) {
    this.form.controls.entiteId.setValue(e.value);
    this.form.controls.entiteId.markAsTouched();
  }
  onEntiteClear() {
    this.form.controls.entiteId.setValue(null);
  }

  onCompteSelect(e: { value: string }) {
    this.form.controls.compteId.setValue(e.value);
    this.form.controls.compteId.markAsTouched();
  }
  onCompteClear() {
    this.form.controls.compteId.setValue(null);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.vm.disabled) return;

    this.search.emit({ trigger: 'MANUAL', criteria: this.normalizedCriteria() });
  }

  private normalizedCriteria(): GestionTachesSearchCriteria {
    const raw = this.form.getRawValue();
    return {
      affichage: raw.affichage,
      modeTravail: raw.modeTravail,
      entiteId: raw.modeTravail === 'ENTITE' ? raw.entiteId : null,
      compteId: raw.modeTravail === 'COMPTE' ? raw.compteId : null,
    };
  }
}

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj);
}



// models/gestion-taches.models.ts
export type Affichage = 'GESTION_TACHES' | 'TOUS_COMPTES';
export type ModeTravail = 'ENTITE' | 'COMPTE';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface GestionTachesSearchCriteria {
  affichage: Affichage;
  modeTravail: ModeTravail;
  entiteId: string | null;
  compteId: string | null;
}

export interface Paging {
  pageIndex: number;
  pageSize: number;
}
export interface Sorting {
  active: string;
  direction: 'asc' | 'desc' | '';
}

export interface TacheRow {
  id: string;
  entite: string;
  compte: string;
  typeCompte: string;
}

export interface SearchResult {
  rows: TacheRow[];
  total: number;
}


// facade/gestion-taches.state.ts
import { ComboboxOption, GestionTachesSearchCriteria, Paging, SearchResult, Sorting } from '../models/gestion-taches.models';

export interface GestionTachesViewState {
  // options initiales
  entiteOptions: ComboboxOption[];
  compteOptions: ComboboxOption[];

  // critères + table state
  criteria: GestionTachesSearchCriteria;
  paging: Paging;
  sorting: Sorting;

  // data
  result: SearchResult;

  // ui
  loadingInit: boolean;
  loadingSearch: boolean;
  error: string | null;

  disabled: boolean; // ex: selon rôle / permission / loading global
}

export const initialCriteria: GestionTachesSearchCriteria = {
  affichage: 'GESTION_TACHES',
  modeTravail: 'ENTITE',
  entiteId: null,
  compteId: null,
};

export const initialState: GestionTachesViewState = {
  entiteOptions: [],
  compteOptions: [],

  criteria: initialCriteria,
  paging: { pageIndex: 0, pageSize: 10 },
  sorting: { active: 'entite', direction: 'asc' },

  result: { rows: [], total: 0 },

  loadingInit: false,
  loadingSearch: false,
  error: null,
  disabled: false,
};




<!-- page/gestion-taches-page.component.html -->
<section class="gestion-taches-page">
  <app-gestion-taches-filters
    [vm]="filtersVm$ | async"
    (search)="onFiltersSearch($event)"
  />

  <app-gestion-taches-grid
    [vm]="gridVm$ | async"
    (pagingChange)="facade.changePaging($event)"
    (sortingChange)="facade.changeSorting($event)"
    (refresh)="facade.refresh()"
  />
</section>




// facade/gestion-taches.facade.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, combineLatest, forkJoin } from 'rxjs';
import { catchError, distinctUntilChanged, finalize, map, switchMap, take, tap } from 'rxjs/operators';
import { CompteRepository } from '../data/compte.repository';
import { EntiteRepository } from '../data/entite.repository';
import { GestionTachesRepository } from '../data/gestion-taches.repository';
import { GestionTachesSearchCriteria, Paging, Sorting } from '../models/gestion-taches.models';
import { GestionTachesViewState, initialState } from './gestion-taches.state';

export type SearchTrigger = 'AUTO' | 'MANUAL';

@Injectable()
export class GestionTachesFacade {
  private readonly stateSubject = new BehaviorSubject<GestionTachesViewState>(initialState);
  readonly state$ = this.stateSubject.asObservable();

  // VM Filters
  readonly filtersVm$ = this.state$.pipe(
    map((s) => ({
      disabled: s.disabled || s.loadingInit || s.loadingSearch,
      entiteOptions: s.entiteOptions,
      compteOptions: s.compteOptions,
      selectedEntiteId: s.criteria.entiteId,
      selectedCompteId: s.criteria.compteId,
      criteria: s.criteria,
    })),
  );

  // VM Grid
  readonly gridVm$ = this.state$.pipe(
    map((s) => ({
      loading: s.loadingSearch,
      error: s.error,
      rows: s.result.rows,
      total: s.result.total,
      paging: s.paging,
      sorting: s.sorting,
    })),
  );

  constructor(
    private readonly entiteRepo: EntiteRepository,
    private readonly compteRepo: CompteRepository,
    private readonly repo: GestionTachesRepository,
  ) {}

  init(): void {
    this.patch({ loadingInit: true, error: null });

    forkJoin({
      entites: this.entiteRepo.listEntites().pipe(take(1)),
      comptes: this.compteRepo.listComptes().pipe(take(1)),
    })
      .pipe(
        tap(({ entites, comptes }) => {
          this.patch({
            entiteOptions: entites,
            compteOptions: comptes,
          });
        }),
        catchError(() => {
          this.patch({ error: 'Erreur lors du chargement initial.' });
          return EMPTY;
        }),
        finalize(() => this.patch({ loadingInit: false })),
      )
      .subscribe();
  }

  /** appelé par Filters (auto ou manuel) */
  onSearch(criteria: GestionTachesSearchCriteria, trigger: SearchTrigger): void {
    // normalisation: éviter des critères incohérents
    const normalized = this.normalizeCriteria(criteria);

    // on reset la page si criteria change
    const current = this.snapshot();
    const criteriaChanged = stableStringify(current.criteria) !== stableStringify(normalized);

    this.patch({
      criteria: normalized,
      paging: criteriaChanged ? { ...current.paging, pageIndex: 0 } : current.paging,
      error: null,
    });

    // MANUAL: tu peux forcer même si mêmes critères (refresh)
    // AUTO: si mêmes critères, ne pas relancer
    if (trigger === 'AUTO' && !criteriaChanged) return;

    this.executeSearch();
  }

  changePaging(paging: Paging): void {
    this.patch({ paging });
    this.executeSearch();
  }

  changeSorting(sorting: Sorting): void {
    this.patch({ sorting, paging: { ...this.snapshot().paging, pageIndex: 0 } });
    this.executeSearch();
  }

  refresh(): void {
    this.executeSearch();
  }

  private executeSearch(): void {
    const s = this.snapshot();

    // sécurité : ne pas chercher si critères pas complets selon mode
    if (!this.isCriteriaSearchable(s.criteria)) return;

    this.patch({ loadingSearch: true, error: null });

    this.repo
      .search(s.criteria, s.paging, s.sorting)
      .pipe(
        take(1),
        tap((result) => this.patch({ result })),
        catchError(() => {
          this.patch({ error: 'Erreur lors de la recherche.' });
          return EMPTY;
        }),
        finalize(() => this.patch({ loadingSearch: false })),
      )
      .subscribe();
  }

  private isCriteriaSearchable(c: GestionTachesSearchCriteria): boolean {
    if (c.modeTravail === 'ENTITE') return !!c.entiteId;
    if (c.modeTravail === 'COMPTE') return !!c.compteId;
    return false;
  }

  private normalizeCriteria(c: GestionTachesSearchCriteria): GestionTachesSearchCriteria {
    return {
      ...c,
      entiteId: c.modeTravail === 'ENTITE' ? c.entiteId : null,
      compteId: c.modeTravail === 'COMPTE' ? c.compteId : null,
    };
  }

  private patch(partial: Partial<GestionTachesViewState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }

  private snapshot(): GestionTachesViewState {
    return this.stateSubject.value;
  }
}

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj);
}
