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
